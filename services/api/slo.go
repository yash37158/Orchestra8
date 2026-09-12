package main

import (
	"encoding/json"
	"log"
	"os"
	"sync"
	"time"
)

// SLO thresholds. Config, not telemetry — so they live in a JSON file in the
// repo rather than in ClickHouse. An SLO change becomes a reviewable commit,
// which is the same GitOps principle every write path in this product follows.
//
// ponytail: JSON rather than YAML purely to keep this service dependency-free.
// If humans start hand-editing it often enough to resent the quoting, that is
// the moment to add a YAML parser, not before.

const defaultTtftSloMs = 1200

type sloFile struct {
	Defaults struct {
		TtftP95Ms float64 `json:"ttftP95Ms"`
	} `json:"defaults"`
	Models map[string]struct {
		TtftP95Ms float64 `json:"ttftP95Ms"`
		Note      string  `json:"note"`
	} `json:"models"`
}

type sloStore struct {
	path string
	mu   sync.RWMutex
	byModel map[string]float64
	fallback float64
	loadedAt time.Time
	modTime  time.Time
}

func newSLOStore(path string) *sloStore {
	s := &sloStore{path: path, byModel: map[string]float64{}, fallback: defaultTtftSloMs}
	if err := s.reload(); err != nil {
		log.Printf("slo: %v — falling back to %gms for every model", err, s.fallback)
	}
	return s
}

// reload re-reads the file when it has changed on disk, so editing SLOs does
// not need a restart. Cheap: one stat per request against a file of a few lines.
func (s *sloStore) reload() error {
	fi, err := os.Stat(s.path)
	if err != nil {
		return err
	}
	s.mu.RLock()
	unchanged := fi.ModTime().Equal(s.modTime)
	s.mu.RUnlock()
	if unchanged {
		return nil
	}
	raw, err := os.ReadFile(s.path)
	if err != nil {
		return err
	}
	var f sloFile
	if err := json.Unmarshal(raw, &f); err != nil {
		return err
	}
	next := map[string]float64{}
	for model, cfg := range f.Models {
		if cfg.TtftP95Ms > 0 {
			next[model] = cfg.TtftP95Ms
		}
	}
	fallback := f.Defaults.TtftP95Ms
	if fallback <= 0 {
		fallback = defaultTtftSloMs
	}
	s.mu.Lock()
	s.byModel, s.fallback, s.modTime, s.loadedAt = next, fallback, fi.ModTime(), time.Now()
	s.mu.Unlock()
	log.Printf("slo: loaded %d model thresholds (default %gms)", len(next), fallback)
	return nil
}

// All returns the per-model thresholds, refreshing from disk first.
func (s *sloStore) All() map[string]float64 {
	if err := s.reload(); err != nil {
		log.Printf("slo reload: %v", err)
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := make(map[string]float64, len(s.byModel))
	for k, v := range s.byModel {
		out[k] = v
	}
	return out
}

// Upsert writes a threshold back to the config file.
//
// The file stays the single source of truth rather than the UI writing to a
// database: an SLO change remains a reviewable diff, which is the same GitOps
// principle every other write path in this product follows. Onboarding is
// allowed to seed it because a user with no way to set a threshold has no
// working alerting at all.
func (s *sloStore) Upsert(model string, ttftP95Ms float64, note string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var f sloFile
	if raw, err := os.ReadFile(s.path); err == nil {
		_ = json.Unmarshal(raw, &f)
	}
	if f.Models == nil {
		f.Models = map[string]struct {
			TtftP95Ms float64 `json:"ttftP95Ms"`
			Note      string  `json:"note"`
		}{}
	}
	if f.Defaults.TtftP95Ms <= 0 {
		f.Defaults.TtftP95Ms = defaultTtftSloMs
	}
	entry := f.Models[model]
	entry.TtftP95Ms = ttftP95Ms
	if note != "" {
		entry.Note = note
	}
	f.Models[model] = entry

	out, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return err
	}
	// Write-and-rename: a crash mid-write must not leave a truncated config
	// that silently drops every threshold on the next read.
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, append(out, '\n'), 0o644); err != nil {
		return err
	}
	if err := os.Rename(tmp, s.path); err != nil {
		return err
	}
	s.byModel[model] = ttftP95Ms
	s.modTime = time.Time{} // force a reload on the next read
	return nil
}
