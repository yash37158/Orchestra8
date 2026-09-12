// orchestr8-devkit simulates a GPU fleet running inference, so the ingest
// pipeline can be developed and demonstrated without hardware.
//
// It is not a mock of Orchestr8. It is a stand-in for the *hardware*: it speaks
// the DCGM exporter and vLLM metrics formats, and the collector scrapes it with
// the config it would use in production.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"time"
)

func main() {
	addr := flag.String("addr", ":9400", "listen address (9400 = DCGM exporter's port)")
	interval := flag.Duration("interval", 5*time.Second, "simulation tick interval")
	start := flag.String("scenario", "healthy", "initial scenario")
	seed := flag.Int64("seed", 1, "RNG seed; fixed by default so runs are reproducible")
	flag.Parse()

	sc, ok := ParseScenario(*start)
	if !ok {
		log.Fatalf("unknown scenario %q; one of %v", *start, AllScenarios())
	}

	fleet := NewFleet(DefaultTunables(), *seed)
	fleet.SetTickSeconds(interval.Seconds())
	fleet.SetScenario(sc)
	fleet.Tick() // populate before first scrape, so /metrics is never empty

	go func() {
		t := time.NewTicker(*interval)
		defer t.Stop()
		for range t.C {
			fleet.Tick()
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
		fmt.Fprint(w, fleet.Render())
	})

	// Drive the fleet into a fault. This is the demo control, and later the
	// hook the chaos feature (F-24) calls to prove the correlation engine works.
	mux.HandleFunc("/scenario", func(w http.ResponseWriter, r *http.Request) {
		if name := r.URL.Query().Get("set"); name != "" {
			next, ok := ParseScenario(name)
			if !ok {
				http.Error(w, fmt.Sprintf("unknown scenario %q; one of %v", name, AllScenarios()), http.StatusBadRequest)
				return
			}
			fleet.SetScenario(next)
			log.Printf("scenario → %s", next)
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"scenario":  fleet.Scenario(),
			"available": AllScenarios(),
		})
	})

	// Human-readable view of what the simulator currently believes, for
	// eyeballing a scenario without parsing exposition format.
	mux.HandleFunc("/debug", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(fleet.Snapshot())
	})

	srv := &http.Server{
		Addr:              *addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("orchestr8-devkit on %s · scenario=%s · tick=%s", *addr, sc, *interval)
	log.Printf("  scrape:  curl localhost%s/metrics", *addr)
	log.Printf("  fault:   curl 'localhost%s/scenario?set=thermal-throttle'", *addr)
	log.Fatal(srv.ListenAndServe())
}
