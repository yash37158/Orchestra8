package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Security scanning, backed by Trivy.
//
// Trivy rather than a bespoke integration because one binary covers
// vulnerabilities, secrets, misconfiguration, IaC and SBOM generation, and it
// is the de-facto default. The value this service adds on top is PERSISTENCE:
// storing the SBOM per target means a newly published CVE can be re-matched
// against what is already deployed without rebuilding or re-pulling anything.

type scanner struct {
	org    string
	ch     *chClient
	audit  *auditLog
	bin    string // trivy
	docker string // DOCKER_CONFIG dir, isolated from the user's own
}

type Finding struct {
	VulnID       string `json:"vulnId"`
	Severity     string `json:"severity"`
	Package      string `json:"package"`
	Installed    string `json:"installed"`
	FixedVersion string `json:"fixedVersion"`
	Title        string `json:"title"`
	PrimaryURL   string `json:"primaryUrl"`
	Fixable      bool   `json:"fixable"`
}

type ScanResult struct {
	ID         string    `json:"id"`
	At         string    `json:"at"`
	Target     string    `json:"target"`
	TargetKind string    `json:"targetKind"`
	Scanner    string    `json:"scanner"`
	DurationMs int       `json:"durationMs"`
	Critical   int       `json:"critical"`
	High       int       `json:"high"`
	Medium     int       `json:"medium"`
	Low        int       `json:"low"`
	Fixable    int       `json:"fixable"`
	Findings   []Finding `json:"findings"`
	Outcome    string    `json:"outcome"`
	Error      string    `json:"error,omitempty"`
}

var severityRank = map[string]int{"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "UNKNOWN": 4}

// Run executes a scan and persists it. A failure is recorded as a failed scan
// with the reason, never as an empty result — "no findings" and "the scanner
// could not run" must never look the same to the person reading the page.
func (s *scanner) Run(ctx context.Context, target, kind, actor string) (*ScanResult, error) {
	started := time.Now()
	id := fmt.Sprintf("scan-%d", started.UTC().UnixNano()/1e6)
	res := &ScanResult{
		ID: id, At: started.UTC().Format(time.RFC3339Nano),
		Target: target, TargetKind: kind, Scanner: "trivy", Outcome: "ok",
		Findings: []Finding{},
	}

	mode := "fs"
	if kind == "image" {
		mode = "image"
	}
	ctx, cancel := context.WithTimeout(ctx, 4*time.Minute)
	defer cancel()

	sbomPath := filepath.Join(os.TempDir(), id+"-sbom.json")
	defer os.Remove(sbomPath)

	raw, err := s.exec(ctx, mode, "--scanners", "vuln", "--format", "json", "--quiet", target)
	if err != nil {
		res.Outcome = "failed"
		res.Error = err.Error()
		_ = s.persist(ctx, res, "")
		_, _ = s.audit.Append(ctx, actor, "scan.run", target, "", "failed",
			map[string]any{"scanId": id, "error": err.Error()})
		return res, nil
	}

	var out struct {
		Results []struct {
			Vulnerabilities []struct {
				VulnerabilityID  string `json:"VulnerabilityID"`
				Severity         string `json:"Severity"`
				PkgName          string `json:"PkgName"`
				InstalledVersion string `json:"InstalledVersion"`
				FixedVersion     string `json:"FixedVersion"`
				Title            string `json:"Title"`
				PrimaryURL       string `json:"PrimaryURL"`
			} `json:"Vulnerabilities"`
		} `json:"Results"`
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		res.Outcome = "failed"
		res.Error = "could not parse scanner output: " + err.Error()
		_ = s.persist(ctx, res, "")
		return res, nil
	}
	for _, r := range out.Results {
		for _, v := range r.Vulnerabilities {
			f := Finding{
				VulnID: v.VulnerabilityID, Severity: strings.ToUpper(v.Severity),
				Package: v.PkgName, Installed: v.InstalledVersion, FixedVersion: v.FixedVersion,
				Title: v.Title, PrimaryURL: v.PrimaryURL, Fixable: v.FixedVersion != "",
			}
			res.Findings = append(res.Findings, f)
			switch f.Severity {
			case "CRITICAL":
				res.Critical++
			case "HIGH":
				res.High++
			case "MEDIUM":
				res.Medium++
			case "LOW":
				res.Low++
			}
			if f.Fixable {
				res.Fixable++
			}
		}
	}
	// Severity first, then fixability: a critical with a patched version is a
	// version bump, a critical without one is an architectural conversation.
	sort.SliceStable(res.Findings, func(i, j int) bool {
		a, b := res.Findings[i], res.Findings[j]
		if severityRank[a.Severity] != severityRank[b.Severity] {
			return severityRank[a.Severity] < severityRank[b.Severity]
		}
		if a.Fixable != b.Fixable {
			return a.Fixable
		}
		return a.VulnID < b.VulnID
	})

	// The SBOM is the durable artefact. Findings age the moment a new CVE is
	// published; the bill of materials does not.
	sbom := ""
	if b, err := s.exec(ctx, mode, "--format", "cyclonedx", "--quiet", target); err == nil {
		sbom = string(b)
	}

	res.DurationMs = int(time.Since(started).Milliseconds())
	if err := s.persist(ctx, res, sbom); err != nil {
		return res, err
	}
	_, _ = s.audit.Append(ctx, actor, "scan.run", target, "", "allowed", map[string]any{
		"scanId": id, "critical": res.Critical, "high": res.High,
		"findings": len(res.Findings), "sbomBytes": len(sbom),
	})
	return res, nil
}

func (s *scanner) exec(ctx context.Context, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, s.bin, args...)
	// Trivy reads ~/.docker/config.json for registry credentials. On a machine
	// where Docker Desktop was removed, that file points at a credential helper
	// that no longer exists and every scan dies. Pointing at an isolated empty
	// config sidesteps it without touching the user's own file.
	cmd.Env = append(os.Environ(), "DOCKER_CONFIG="+s.docker)
	var stderr strings.Builder
	cmd.Stderr = &stderr
	out, err := cmd.Output()
	if err != nil {
		msg := strings.TrimSpace(stderr.String())
		if msg == "" {
			msg = err.Error()
		}
		if i := strings.LastIndex(msg, "FATAL"); i >= 0 {
			msg = strings.TrimSpace(msg[i+5:])
		}
		return nil, fmt.Errorf("%s", firstLine(msg))
	}
	return out, nil
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return s[:i]
	}
	return s
}

func (s *scanner) persist(ctx context.Context, r *ScanResult, sbom string) error {
	at := time.Now().UTC().Format("2006-01-02 15:04:05.000")
	head, err := json.Marshal(map[string]any{
		"OrgId": s.org, "Id": r.ID, "At": at, "Target": r.Target, "TargetKind": r.TargetKind,
		"Scanner": r.Scanner, "DurationMs": r.DurationMs,
		"Critical": r.Critical, "High": r.High, "Medium": r.Medium, "Low": r.Low,
		"Fixable": r.Fixable, "SbomJson": sbom, "Outcome": r.Outcome,
	})
	if err != nil {
		return err
	}
	if err := s.ch.exec(ctx, "INSERT INTO orchestr8.scans FORMAT JSONEachRow\n"+string(head)+"\n"); err != nil {
		return err
	}
	if len(r.Findings) == 0 {
		return nil
	}
	var b strings.Builder
	b.WriteString("INSERT INTO orchestr8.scan_findings FORMAT JSONEachRow\n")
	for _, f := range r.Findings {
		line, _ := json.Marshal(map[string]any{
			"OrgId": s.org, "ScanId": r.ID, "At": at, "Target": r.Target, "VulnId": f.VulnID,
			"Severity": f.Severity, "Package": f.Package, "Installed": f.Installed,
			"FixedVersion": f.FixedVersion, "Title": f.Title, "PrimaryUrl": f.PrimaryURL,
			"Fixable": boolToUint8(f.Fixable),
		})
		b.Write(line)
		b.WriteByte('\n')
	}
	return s.ch.exec(ctx, b.String())
}

func boolToUint8(b bool) uint8 {
	if b {
		return 1
	}
	return 0
}

// ------------------------------------------------------------------- reads

type scanSummary struct {
	ID       string `json:"id"`
	At       string `json:"at"`
	Target   string `json:"target"`
	Critical int    `json:"critical"`
	High     int    `json:"high"`
	Medium   int    `json:"medium"`
	Fixable  int    `json:"fixable"`
	Outcome  string `json:"outcome"`
}

// latestScanFor backs the deploy preflight gate.
func latestScanFor(ctx context.Context, c *chClient, org, target string) (*scanSummary, error) {
	var rows []struct {
		Id       string `json:"Id"`
		At       string `json:"At"`
		Target   string `json:"Target"`
		Critical int    `json:"Critical"`
		High     int    `json:"High"`
		Medium   int    `json:"Medium"`
		Fixable  int    `json:"Fixable"`
		Outcome  string `json:"Outcome"`
	}
	q := fmt.Sprintf(`SELECT Id, toString(At) AS At, Target, Critical, High, Medium, Fixable, Outcome
FROM orchestr8.scans WHERE %s AND Target = %s AND Outcome = 'ok' ORDER BY At DESC LIMIT 1`, orgClause(org), chQuote(target))
	if err := c.query(ctx, q, &rows); err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, nil
	}
	r := rows[0]
	return &scanSummary{ID: r.Id, At: isoFromCH(r.At), Target: r.Target,
		Critical: r.Critical, High: r.High, Medium: r.Medium, Fixable: r.Fixable, Outcome: r.Outcome}, nil
}

func listScans(ctx context.Context, c *chClient, org string, limit int) ([]scanSummary, error) {
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	var rows []struct {
		Id       string `json:"Id"`
		At       string `json:"At"`
		Target   string `json:"Target"`
		Critical int    `json:"Critical"`
		High     int    `json:"High"`
		Medium   int    `json:"Medium"`
		Fixable  int    `json:"Fixable"`
		Outcome  string `json:"Outcome"`
	}
	q := fmt.Sprintf(`SELECT Id, toString(At) AS At, Target, Critical, High, Medium, Fixable, Outcome
FROM orchestr8.scans WHERE %s ORDER BY At DESC LIMIT %d`, orgClause(org), limit)
	if err := c.query(ctx, q, &rows); err != nil {
		return nil, err
	}
	out := make([]scanSummary, 0, len(rows))
	for _, r := range rows {
		out = append(out, scanSummary{ID: r.Id, At: isoFromCH(r.At), Target: r.Target,
			Critical: r.Critical, High: r.High, Medium: r.Medium, Fixable: r.Fixable, Outcome: r.Outcome})
	}
	return out, nil
}

func scanFindings(ctx context.Context, c *chClient, org, scanID string) ([]Finding, error) {
	var rows []struct {
		VulnId       string `json:"VulnId"`
		Severity     string `json:"Severity"`
		Package      string `json:"Package"`
		Installed    string `json:"Installed"`
		FixedVersion string `json:"FixedVersion"`
		Title        string `json:"Title"`
		PrimaryUrl   string `json:"PrimaryUrl"`
		Fixable      uint8  `json:"Fixable"`
	}
	q := fmt.Sprintf(`SELECT VulnId, Severity, Package, Installed, FixedVersion, Title, PrimaryUrl, Fixable
FROM orchestr8.scan_findings WHERE %s AND ScanId = %s
ORDER BY multiIf(Severity='CRITICAL',0,Severity='HIGH',1,Severity='MEDIUM',2,3), Fixable DESC, VulnId`, orgClause(org), chQuote(scanID))
	if err := c.query(ctx, q, &rows); err != nil {
		return nil, err
	}
	out := make([]Finding, 0, len(rows))
	for _, r := range rows {
		out = append(out, Finding{
			VulnID: r.VulnId, Severity: r.Severity, Package: r.Package, Installed: r.Installed,
			FixedVersion: r.FixedVersion, Title: r.Title, PrimaryURL: r.PrimaryUrl, Fixable: r.Fixable == 1,
		})
	}
	return out, nil
}
