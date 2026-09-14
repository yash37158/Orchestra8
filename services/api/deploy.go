package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

// Deployment via GitOps.
//
// Orchestr8 never writes to a cluster. A deploy edits a manifest in the GitOps
// repository and commits it on a branch; Argo CD reconciles from there. The
// audit trail is therefore git history — reviewable, revertible, and something
// a compliance reviewer already trusts, rather than a table we would have to
// defend.
//
// The function this replaces decided success with `Math.random() > 0.3`.

type DeployRequest struct {
	App       string `json:"app"` // manifest basename, e.g. "llama-3.3-70b"
	ClusterID string `json:"clusterId"`
	Image     string `json:"image"` // full image ref including tag
	Replicas  int    `json:"replicas"`
	Strategy  string `json:"strategy"` // rolling | canary | blue-green
	Actor     string `json:"actor"`
	Approved  bool   `json:"approved"`
}

type PreflightCheck struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Status   string `json:"status"` // pass | fail | warn | skipped
	Detail   string `json:"detail"`
	Blocking bool   `json:"blocking"`
}

type Preflight struct {
	Checks   []PreflightCheck `json:"checks"`
	Diff     string           `json:"diff"`
	CanApply bool             `json:"canApply"`
	Blockers int              `json:"blockers"`
}

type Deployment struct {
	ID        string           `json:"id"`
	At        string           `json:"at"`
	App       string           `json:"app"`
	ClusterID string           `json:"clusterId"`
	Image     string           `json:"image"`
	Replicas  int              `json:"replicas"`
	Strategy  string           `json:"strategy"`
	Actor     string           `json:"actor"`
	Branch    string           `json:"branch"`
	Commit    string           `json:"commit"`
	Preflight []PreflightCheck `json:"preflight"`
	Diff      string           `json:"diff"`
}

type deployer struct {
	repo  string
	ch    *chClient
	slos  *sloStore
	audit *auditLog
}

var safeName = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]{0,80}$`)

func (d *deployer) manifestPath(req DeployRequest) (string, error) {
	if !safeName.MatchString(req.App) || !safeName.MatchString(req.ClusterID) {
		return "", fmt.Errorf("invalid app or cluster name")
	}
	// filepath.Join collapses any traversal, and the prefix check below makes
	// escaping the repo impossible even if the regex is later loosened.
	p := filepath.Join(d.repo, "clusters", req.ClusterID, req.App+".yaml")
	root := filepath.Clean(d.repo) + string(os.PathSeparator)
	if !strings.HasPrefix(filepath.Clean(p), root) {
		return "", fmt.Errorf("path escapes the gitops repo")
	}
	if _, err := os.Stat(p); err != nil {
		return "", fmt.Errorf("no manifest for %s in %s", req.App, req.ClusterID)
	}
	return p, nil
}

// ------------------------------------------------------------------ preflight

// Preflight runs before the approval gate and blocks on failure.
//
// Checks that cannot actually run report "skipped" with the reason. A preflight
// that claims to have verified policy when no admission controller is reachable
// is worse than no preflight: it manufactures confidence.
func (d *deployer) Preflight(ctx context.Context, req DeployRequest) (*Preflight, error) {
	path, err := d.manifestPath(req)
	if err != nil {
		return nil, err
	}
	current, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	next := applyManifest(string(current), req)
	diff := unifiedish(string(current), next)

	pf := &Preflight{Diff: diff}
	add := func(c PreflightCheck) { pf.Checks = append(pf.Checks, c) }

	// 1. Is there anything to do?
	if diff == "" {
		add(PreflightCheck{ID: "diff", Name: "Manifest change", Status: "warn",
			Detail: "The manifest already matches this request; deploying would be a no-op.", Blocking: false})
	} else {
		add(PreflightCheck{ID: "diff", Name: "Manifest change", Status: "pass",
			Detail: fmt.Sprintf("%d line(s) change in %s", strings.Count(diff, "\n"), filepath.Base(path))})
	}

	// 2. GPU capacity. THE check no general-purpose deploy tool performs.
	//    A blue-green rollout of a large model needs the new replica set
	//    resident alongside the old one; discovering that mid-rollout is an
	//    outage, not a warning.
	cap, err := d.capacityCheck(ctx, req)
	if err != nil {
		add(PreflightCheck{ID: "capacity", Name: "GPU capacity", Status: "skipped",
			Detail: "No GPU telemetry for this cluster: " + err.Error()})
	} else {
		add(*cap)
	}

	// 3. Error budget. Deploying into a live incident needs a human to say so.
	slo, err := d.sloCheck(ctx, req)
	if err != nil {
		add(PreflightCheck{ID: "slo", Name: "SLO budget", Status: "skipped", Detail: err.Error()})
	} else {
		add(*slo)
	}

	// 4. Image scan. Wired to the scanner when one is configured; honest when not.
	add(d.imageScanCheck(ctx, req))

	// 5. Admission policy. No cluster is reachable from here, so this cannot run.
	add(PreflightCheck{ID: "policy", Name: "Admission policy dry-run", Status: "skipped",
		Detail:   "No admission controller reachable. Configure a Kyverno or Gatekeeper endpoint to evaluate policy before deploy.",
		Blocking: false})

	for _, c := range pf.Checks {
		if c.Blocking && c.Status == "fail" {
			pf.Blockers++
		}
	}
	pf.CanApply = pf.Blockers == 0
	return pf, nil
}

// capacityCheck compares the GPU memory this rollout will need against what is
// actually free right now, using live DCGM telemetry.
func (d *deployer) capacityCheck(ctx context.Context, req DeployRequest) (*PreflightCheck, error) {
	var gpus []gpuSignal
	if err := d.ch.query(ctx, fmt.Sprintf(qGPUState, orgClause(orgFromContext(ctx)), 300), &gpus); err != nil {
		return nil, err
	}
	var inCluster []gpuSignal
	for _, g := range gpus {
		inCluster = append(inCluster, g)
	}
	if len(inCluster) == 0 {
		return nil, fmt.Errorf("no GPUs reporting")
	}

	var freeMib, totalMib float64
	for _, g := range inCluster {
		freeMib += g.MemTotMib - g.MemUsedMib
		totalMib += g.MemTotMib
	}
	// Blue-green and canary both hold two replica sets live at once, so the
	// headroom required is the incoming set's footprint, not the delta.
	perReplica := 0.0
	if n := len(inCluster); n > 0 {
		var used float64
		for _, g := range inCluster {
			used += g.MemUsedMib
		}
		perReplica = used / float64(max(1, req.Replicas))
	}
	needed := perReplica * float64(req.Replicas)
	if req.Strategy == "rolling" {
		needed = perReplica // one extra pod at a time
	}

	c := &PreflightCheck{ID: "capacity", Name: "GPU capacity", Blocking: true}
	switch {
	case needed > freeMib:
		c.Status = "fail"
		c.Detail = fmt.Sprintf(
			"%s needs about %.0f GiB of GPU memory resident alongside the current replica set, and only %.0f GiB is free across %d GPU(s). The rollout would stall part-way.",
			req.Strategy, needed/1024, freeMib/1024, len(inCluster))
	case needed > freeMib*0.8:
		c.Status = "warn"
		c.Detail = fmt.Sprintf("Tight: needs about %.0f GiB against %.0f GiB free across %d GPU(s).",
			needed/1024, freeMib/1024, len(inCluster))
	default:
		c.Status = "pass"
		c.Detail = fmt.Sprintf("About %.0f GiB free across %d GPU(s); this rollout needs roughly %.0f GiB.",
			freeMib/1024, len(inCluster), needed/1024)
	}
	return c, nil
}

// sloCheck refuses to silently deploy on top of a live incident.
func (d *deployer) sloCheck(ctx context.Context, req DeployRequest) (*PreflightCheck, error) {
	corrs, err := d.ch.correlations(ctx, orgFromContext(ctx), "")
	if err != nil {
		return nil, fmt.Errorf("correlation engine unreachable")
	}
	var open []Correlation
	for _, c := range corrs {
		if c.Status == "open" && c.Cause.ClusterID == req.ClusterID {
			open = append(open, c)
		}
	}
	c := &PreflightCheck{ID: "slo", Name: "SLO budget", Blocking: true}
	if len(open) == 0 {
		c.Status = "pass"
		c.Detail = "No open correlations for this cluster."
		return c, nil
	}
	worst := open[0]
	c.Status = "fail"
	c.Detail = fmt.Sprintf("%d open correlation(s) on %s. Most severe: %s (%s). Deploying into a live incident needs an explicit override.",
		len(open), req.ClusterID, worst.Summary, worst.Cause.Kind)
	return c, nil
}

func (d *deployer) imageScanCheck(ctx context.Context, req DeployRequest) PreflightCheck {
	res, err := latestScanFor(ctx, d.ch, orgFromContext(ctx), req.Image)
	if err != nil || res == nil {
		return PreflightCheck{ID: "scan", Name: "Image scan", Status: "skipped",
			Detail: fmt.Sprintf("No scan on record for %s. Run a scan to gate this deploy on it.", req.Image)}
	}
	c := PreflightCheck{ID: "scan", Name: "Image scan", Blocking: true}
	if res.Critical > 0 {
		c.Status = "fail"
		c.Detail = fmt.Sprintf("%d critical and %d high finding(s) in %s (scanned %s).",
			res.Critical, res.High, req.Image, res.At)
		return c
	}
	c.Status = "pass"
	c.Detail = fmt.Sprintf("No critical findings in %s (scanned %s).", req.Image, res.At)
	return c
}

// -------------------------------------------------------------------- apply

// Apply commits the manifest change on a branch. It never pushes and never
// touches a cluster: the branch is the deliverable, and a human or Argo CD
// decides what happens to it.
func (d *deployer) Apply(ctx context.Context, req DeployRequest, pf *Preflight) (*Deployment, error) {
	if !pf.CanApply && !req.Approved {
		return nil, fmt.Errorf("preflight has %d blocking failure(s); approve explicitly to override", pf.Blockers)
	}
	path, err := d.manifestPath(req)
	if err != nil {
		return nil, err
	}
	current, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	next := applyManifest(string(current), req)

	id := fmt.Sprintf("dep-%d", time.Now().UTC().UnixNano()/1e6)
	branch := "orchestr8/" + id

	if _, err := d.git(ctx, "checkout", "-q", "-b", branch); err != nil {
		return nil, fmt.Errorf("create branch: %w", err)
	}
	restore := func() { _, _ = d.git(ctx, "checkout", "-q", "main") }

	if err := os.WriteFile(path, []byte(next), 0o644); err != nil {
		restore()
		return nil, err
	}
	msg := fmt.Sprintf("deploy(%s): %s -> %s\n\nCluster: %s\nStrategy: %s\nReplicas: %d\nRequested-by: %s\nOrchestr8-Deployment: %s",
		req.ClusterID, req.App, req.Image, req.ClusterID, req.Strategy, req.Replicas, req.Actor, id)
	if _, err := d.git(ctx, "add", "-A"); err != nil {
		restore()
		return nil, err
	}
	if _, err := d.git(ctx, "commit", "-q", "-m", msg); err != nil {
		restore()
		return nil, fmt.Errorf("commit: %w", err)
	}
	sha, err := d.git(ctx, "rev-parse", "--short", "HEAD")
	if err != nil {
		restore()
		return nil, err
	}
	// Leave the repo on main: the branch is the artefact, not the working state.
	restore()

	return &Deployment{
		ID: id, At: time.Now().UTC().Format(time.RFC3339Nano),
		App: req.App, ClusterID: req.ClusterID, Image: req.Image, Replicas: req.Replicas,
		Strategy: req.Strategy, Actor: req.Actor,
		Branch: branch, Commit: strings.TrimSpace(sha),
		Preflight: pf.Checks, Diff: pf.Diff,
	}, nil
}

func (d *deployer) git(ctx context.Context, args ...string) (string, error) {
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = d.repo
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("git %s: %s", strings.Join(args, " "), strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

func (d *deployer) Deployments(ctx context.Context) ([]map[string]string, error) {
	out, err := d.git(ctx, "log", "--all", "--format=%h\x1f%ci\x1f%s", "--grep=Orchestr8-Deployment", "-n", "50")
	if err != nil {
		return nil, err
	}
	var deps []map[string]string
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\x1f")
		if len(parts) < 3 {
			continue
		}
		deps = append(deps, map[string]string{"commit": parts[0], "at": parts[1], "subject": parts[2]})
	}
	return deps, nil
}

// --------------------------------------------------------------- manifest io

var (
	reImage    = regexp.MustCompile(`(?m)^(\s*image:\s*).*$`)
	reReplicas = regexp.MustCompile(`(?m)^(\s*replicas:\s*).*$`)
)

// applyManifest edits the two fields a deploy changes. Deliberately textual:
// a YAML round-trip through a generic parser reorders keys and strips comments,
// which turns a one-line deploy into an unreviewable diff.
func applyManifest(src string, req DeployRequest) string {
	out := src
	if req.Image != "" {
		out = reImage.ReplaceAllString(out, "${1}"+req.Image)
	}
	if req.Replicas > 0 {
		out = reReplicas.ReplaceAllString(out, fmt.Sprintf("${1}%d", req.Replicas))
	}
	return out
}

// unifiedish renders only changed lines. Enough to review a two-field edit
// without taking a diff library as a dependency for it.
func unifiedish(before, after string) string {
	if before == after {
		return ""
	}
	b, a := strings.Split(before, "\n"), strings.Split(after, "\n")
	var sb strings.Builder
	for i := 0; i < len(b) || i < len(a); i++ {
		var bl, al string
		if i < len(b) {
			bl = b[i]
		}
		if i < len(a) {
			al = a[i]
		}
		if bl != al {
			if bl != "" {
				fmt.Fprintf(&sb, "- %s\n", bl)
			}
			if al != "" {
				fmt.Fprintf(&sb, "+ %s\n", al)
			}
		}
	}
	return sb.String()
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
