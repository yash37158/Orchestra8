package main

import "testing"

// Advisories list fixes across release branches. Picking the first entry
// recommends a DOWNGRADE whenever the installed version is on a later branch
// than the earliest patched one — reintroducing every bug fixed in between.
func TestBestFixNeverRecommendsADowngrade(t *testing.T) {
	cases := []struct {
		name, fixed, installed, want string
	}{
		{
			name:      "real next.js advisory",
			fixed:     "15.0.5, 15.1.9, 15.2.6, 15.3.6, 15.4.8, 15.5.7, 16.0.7",
			installed: "15.2.4",
			want:      "15.2.6", // the patch on the branch already in use
		},
		{"single fix", "3.4.11", "3.4.8", "3.4.11"},
		{"already on a later branch", "1.2.3, 2.0.1", "2.0.0", "2.0.1"},
		// Contradictory advisory data: say "no applicable fix" rather than
		// propose a downgrade.
		{"no fix at or above installed", "1.0.1, 1.0.2", "9.9.9", ""},
		{"exact match is acceptable", "2.0.0", "2.0.0", "2.0.0"},
		{"prerelease suffix ignored", "1.4.0-rc1, 1.5.0", "1.3.0", "1.4.0-rc1"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := bestFix(c.fixed, c.installed)
			if got != c.want {
				t.Errorf("bestFix(%q, installed=%q) = %q, want %q", c.fixed, c.installed, got, c.want)
			}
			if got != "" && compareVersions(got, c.installed) < 0 {
				t.Errorf("recommended %q which is BELOW installed %q — a downgrade", got, c.installed)
			}
		})
	}
}

func TestCompareVersions(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"1.2.3", "1.2.3", 0},
		{"1.2.4", "1.2.3", 1},
		{"1.10.0", "1.9.0", 1}, // numeric, not lexicographic
		{"15.2.4", "15.0.5", 1},
		{"2.0", "2.0.0", 0},
	}
	for _, c := range cases {
		if got := compareVersions(c.a, c.b); got != c.want {
			t.Errorf("compareVersions(%q,%q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}
