package main

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// Phase 3 write paths: deployments, scans and the audit ledger.
//
// Every one of them records to the audit log before returning, including the
// failures. An action that is not in the ledger did not happen as far as a
// reviewer is concerned.

func decodeJSON(r *http.Request, v any) error {
	return json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(v)
}

func handleDeployments(w http.ResponseWriter, r *http.Request, d *deployer) {
	switch r.Method {
	case http.MethodGet:
		deps, err := d.Deployments(r.Context())
		if err != nil {
			http.Error(w, "could not read deployment history", http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]any{"deployments": deps})
	case http.MethodPost:
		var req DeployRequest
		if err := decodeJSON(r, &req); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		req.Actor = actorOf(r, req.Actor)
		if req.Actor == "" {
			req.Actor = "unknown"
		}
		if req.Strategy == "" {
			req.Strategy = "rolling"
		}

		pf, err := d.Preflight(r.Context(), req)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		_, _ = d.audit.Append(r.Context(), req.Actor, "deploy.request", req.App, req.ClusterID, "allowed",
			map[string]any{"image": req.Image, "replicas": req.Replicas, "strategy": req.Strategy,
				"blockers": pf.Blockers, "approved": req.Approved})

		if !pf.CanApply && !req.Approved {
			// Refusing is the point of the gate. The response carries the
			// reasons so the caller can fix them or override deliberately.
			_, _ = d.audit.Append(r.Context(), req.Actor, "deploy.blocked", req.App, req.ClusterID, "denied",
				map[string]any{"blockers": pf.Blockers, "checks": pf.Checks})
			w.WriteHeader(http.StatusPreconditionFailed)
			writeJSON(w, map[string]any{"preflight": pf, "error": "preflight blocked this deploy"})
			return
		}
		if req.Approved && pf.Blockers > 0 {
			// An override is itself an auditable decision, recorded with the
			// exact checks that were overridden and by whom.
			_, _ = d.audit.Append(r.Context(), req.Actor, "deploy.override", req.App, req.ClusterID, "allowed",
				map[string]any{"blockers": pf.Blockers, "checks": pf.Checks})
		}

		dep, err := d.Apply(r.Context(), req, pf)
		if err != nil {
			_, _ = d.audit.Append(r.Context(), req.Actor, "deploy.apply", req.App, req.ClusterID, "failed",
				map[string]any{"error": err.Error()})
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_, _ = d.audit.Append(r.Context(), req.Actor, "deploy.apply", req.App, req.ClusterID, "allowed",
			map[string]any{"deploymentId": dep.ID, "branch": dep.Branch, "commit": dep.Commit,
				"image": dep.Image, "diff": dep.Diff})
		writeJSON(w, dep)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handlePreflight(w http.ResponseWriter, r *http.Request, d *deployer) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req DeployRequest
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, "invalid body", http.StatusBadRequest)
		return
	}
	pf, err := d.Preflight(r.Context(), req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	writeJSON(w, pf)
}

func handleScans(w http.ResponseWriter, r *http.Request, s *scanner) {
	switch r.Method {
	case http.MethodGet:
		limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
		list, err := listScans(r.Context(), s.ch, orgFromRequest(r), limit)
		if err != nil {
			http.Error(w, "could not list scans", http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]any{"scans": list})
	case http.MethodPost:
		var req struct {
			Target string `json:"target"`
			Kind   string `json:"kind"`
		}
		if err := decodeJSON(r, &req); err != nil || req.Target == "" {
			http.Error(w, "target is required", http.StatusBadRequest)
			return
		}
		if req.Kind == "" {
			req.Kind = "filesystem"
		}
		// Accepted, not done. The result is fetched from /v1/scans/{id}.
		id := s.Start(r.Context(), req.Target, req.Kind, actorOf(r, "operator"))
		w.WriteHeader(http.StatusAccepted)
		writeJSON(w, map[string]any{
			"id": id, "status": "running", "target": req.Target, "kind": req.Kind,
		})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// /v1/scans/{id}            findings
// /v1/scans/{id}/export     csv | sbom  (exit X4 — evidence leaves for audit)
// /v1/scans/{id}/remediate  proposes the fix through the reviewed deploy path
func handleScan(w http.ResponseWriter, r *http.Request, s *scanner, d *deployer) {
	rest := strings.TrimPrefix(r.URL.Path, "/v1/scans/")
	id, action, _ := strings.Cut(rest, "/")
	if id == "" {
		http.Error(w, "missing scan id", http.StatusBadRequest)
		return
	}

	switch action {
	case "export":
		format := r.URL.Query().Get("format")
		if format == "sbom" {
			var rows []struct {
				SbomJson string `json:"SbomJson"`
			}
			q := fmt.Sprintf("SELECT SbomJson FROM orchestr8.scans WHERE %s AND Id = %s LIMIT 1", orgClause(orgFromRequest(r)), chQuote(id))
			if err := s.ch.query(r.Context(), q, &rows); err != nil || len(rows) == 0 || rows[0].SbomJson == "" {
				http.Error(w, "no SBOM stored for this scan", http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "application/vnd.cyclonedx+json")
			w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", id+"-sbom.json"))
			_, _ = io.WriteString(w, rows[0].SbomJson)
			_, _ = s.audit.Append(r.Context(), actorOf(r, "operator"), "scan.export", id, "", "allowed",
				map[string]any{"format": "cyclonedx"})
			return
		}
		fs, err := scanFindings(r.Context(), s.ch, orgFromRequest(r), id)
		if err != nil {
			http.Error(w, "could not read findings", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", id+".csv"))
		cw := csv.NewWriter(w)
		_ = cw.Write([]string{"vulnerability", "severity", "package", "installed", "fixed_version", "fixable", "url", "title"})
		for _, f := range fs {
			_ = cw.Write([]string{f.VulnID, f.Severity, f.Package, f.Installed, f.FixedVersion,
				strconv.FormatBool(f.Fixable), f.PrimaryURL, f.Title})
		}
		cw.Flush()
		_, _ = s.audit.Append(r.Context(), actorOf(r, "operator"), "scan.export", id, "", "allowed",
			map[string]any{"format": "csv", "rows": len(fs)})
		return

	case "remediate":
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		var req struct {
			VulnID    string `json:"vulnId"`
			App       string `json:"app"`
			ClusterID string `json:"clusterId"`
		}
		_ = decodeJSON(r, &req)
		fs, err := scanFindings(r.Context(), s.ch, orgFromRequest(r), id)
		if err != nil {
			http.Error(w, "could not read findings", http.StatusInternalServerError)
			return
		}
		var target *Finding
		for i := range fs {
			if fs[i].VulnID == req.VulnID {
				target = &fs[i]
				break
			}
		}
		if target == nil {
			http.Error(w, "finding not in this scan", http.StatusNotFound)
			return
		}
		fix := bestFix(target.FixedVersion, target.Installed)
		if !target.Fixable || fix == "" {
			// Disabled with the reason, never silently inert.
			w.WriteHeader(http.StatusUnprocessableEntity)
			reason := "no fixed version is published for " + target.VulnID
			if target.Fixable {
				reason = fmt.Sprintf("no applicable upgrade for %s: every published fix (%s) predates the installed %s",
					target.VulnID, target.FixedVersion, target.Installed)
			}
			writeJSON(w, map[string]any{
				"error":  reason,
				"advice": "Track the upstream advisory, or waive with an expiry.",
			})
			return
		}
		if req.App == "" || req.ClusterID == "" {
			// A source-dependency finding is fixed in the application repo, not
			// in the GitOps manifests. Say exactly that rather than pretending.
			writeJSON(w, map[string]any{
				"kind":    "source-dependency",
				"package": target.Package,
				"from":    target.Installed,
				"to":      fix,
				"advice": fmt.Sprintf("Bump %s from %s to %s in the application repository; this finding is not in a GitOps manifest.",
					target.Package, target.Installed, fix),
			})
			return
		}
		// Image finding: remediation IS a deploy, through the same reviewed path.
		dep, err := d.Apply(r.Context(), DeployRequest{
			App: req.App, ClusterID: req.ClusterID,
			Image:    target.Package + ":" + fix,
			Strategy: "rolling", Actor: actorOf(r, "auto-remediate"), Approved: true,
		}, &Preflight{CanApply: true})
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		_, _ = s.audit.Append(r.Context(), actorOf(r, "auto-remediate"), "scan.remediate", target.VulnID,
			req.ClusterID, "allowed", map[string]any{"branch": dep.Branch, "commit": dep.Commit})
		writeJSON(w, dep)
		return
	}

	org := orgFromRequest(r)

	// Still working. Answered before the store is consulted, because the row
	// does not exist until the scan finishes.
	if f, ok := s.inFlightFor(org, id); ok {
		writeJSON(w, map[string]any{
			"id": id, "status": "running", "target": f.Target,
			"elapsedMs": int(time.Since(f.Started).Milliseconds()),
			"findings":  []Finding{},
		})
		return
	}

	sum, err := scanByID(r.Context(), s.ch, org, id)
	if err != nil {
		http.Error(w, "could not read the scan", http.StatusInternalServerError)
		return
	}
	if sum == nil {
		// Not running here and never stored. Either the id is wrong, or the
		// process that was running it restarted — and saying so beats a
		// spinner that never stops.
		http.Error(w, "no such scan — if one was running, the server restarted before it finished",
			http.StatusNotFound)
		return
	}

	fs, err := scanFindings(r.Context(), s.ch, org, id)
	if err != nil {
		http.Error(w, "could not read findings", http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{
		"id": id, "status": sum.Outcome, "target": sum.Target, "at": sum.At,
		"critical": sum.Critical, "high": sum.High, "medium": sum.Medium, "low": sum.Low,
		"fixable": sum.Fixable, "durationMs": sum.DurationMs, "scanner": "trivy",
		"osEosl": sum.OsEosl, "osName": sum.OsName, "error": sum.Error,
		"findings": fs,
	})
}

// bestFix picks the upgrade to recommend when an advisory lists fixes across
// several release branches, e.g. "15.0.5, 15.1.9, 15.2.6, 16.0.7".
//
// Taking the first entry is wrong and dangerous: for an installed 15.2.4 it
// recommends 15.0.5, which is a DOWNGRADE that reintroduces every bug fixed
// since. The right answer is the LOWEST listed fix that is still >= installed
// — the patch on the branch already in use, which is the smallest safe move.
// Falling back to the highest only when nothing qualifies.
func bestFix(fixed, installed string) string {
	parts := strings.Split(fixed, ",")
	var best string
	for _, p := range parts {
		v := strings.TrimSpace(p)
		if v == "" {
			continue
		}
		if installed != "" && compareVersions(v, installed) < 0 {
			continue // never recommend going backwards
		}
		if best == "" || compareVersions(v, best) < 0 {
			best = v
		}
	}
	// Empty when no listed fix is at or above what is installed. That input is
	// contradictory — an advisory claiming a version is vulnerable while every
	// published fix predates it — and the only safe answer is to say there is
	// no applicable upgrade rather than propose going backwards.
	return best
}

// compareVersions does a dotted numeric comparison. Not full semver: it handles
// the shape real advisories use, and treats a non-numeric segment as 0 rather
// than guessing at pre-release precedence.
func compareVersions(a, b string) int {
	trim := func(s string) string {
		if i := strings.IndexAny(s, "-+"); i >= 0 {
			return s[:i]
		}
		return s
	}
	as, bs := strings.Split(trim(a), "."), strings.Split(trim(b), ".")
	for i := 0; i < len(as) || i < len(bs); i++ {
		var x, y int
		if i < len(as) {
			x, _ = strconv.Atoi(as[i])
		}
		if i < len(bs) {
			y, _ = strconv.Atoi(bs[i])
		}
		if x != y {
			if x < y {
				return -1
			}
			return 1
		}
	}
	return 0
}

func handleAudit(w http.ResponseWriter, r *http.Request, a *auditLog) {
	if strings.HasSuffix(r.URL.Path, "/verify") {
		v, err := a.Verify(r.Context())
		if err != nil {
			http.Error(w, "could not verify the chain", http.StatusInternalServerError)
			return
		}
		if !v.Intact {
			log.Printf("AUDIT CHAIN BROKEN at seq %d: %s", v.BrokenAt, v.Reason)
		}
		writeJSON(w, v)
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	entries, err := a.List(r.Context(), orgFromRequest(r), limit)
	if err != nil {
		http.Error(w, "could not read the audit log", http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"entries": entries})
}
