package detect

import (
	"math"
	"reflect"
	"testing"
)

func TestComputeJaccard(t *testing.T) {
	tests := []struct {
		name     string
		a        [][]string
		b        [][]string
		expected float64
	}{
		{
			name:     "identical sets",
			a:        [][]string{{"a", "b", "c"}, {"d", "e", "f"}},
			b:        [][]string{{"a", "b", "c"}, {"d", "e", "f"}},
			expected: 1.0,
		},
		{
			name:     "no overlap",
			a:        [][]string{{"a", "b", "c"}},
			b:        [][]string{{"x", "y", "z"}},
			expected: 0.0,
		},
		{
			name:     "partial overlap",
			a:        [][]string{{"a", "b", "c"}, {"d", "e", "f"}},
			b:        [][]string{{"a", "b", "c"}, {"x", "y", "z"}},
			expected: 1.0 / 3.0,
		},
		{
			name:     "empty sets",
			a:        [][]string{},
			b:        [][]string{},
			expected: 1.0,
		},
		{
			name:     "one empty",
			a:        [][]string{{"a", "b", "c"}},
			b:        [][]string{},
			expected: 0.0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ComputeJaccard(tt.a, tt.b)
			if math.Abs(got-tt.expected) > 0.001 {
				t.Errorf("ComputeJaccard() = %v, want %v", got, tt.expected)
			}
		})
	}
}

func TestClusterByJaccard(t *testing.T) {
	members := []ClusterMember{
		{Path: "src/a.ts", Shingles: [][]string{{"a", "b", "c"}, {"d", "e", "f"}}},
		{Path: "src/b.ts", Shingles: [][]string{{"a", "b", "c"}, {"g", "h", "i"}}},
		{Path: "src/c.ts", Shingles: [][]string{{"x", "y", "z"}}},
	}

	results := ClusterByJaccard(members, 0.1, 2)

	if len(results) != 1 {
		t.Fatalf("Expected 1 cluster, got %d", len(results))
	}

	if results[0].ID != "src-a.ts" {
		t.Errorf("Cluster ID = %q, want %q", results[0].ID, "src-a.ts")
	}

	if len(results[0].Members) != 2 {
		t.Errorf("Cluster member count = %d, want 2", len(results[0].Members))
	}

	for _, m := range results[0].Members {
		if m.Path == "src/c.ts" {
			t.Error("c.ts should not be in the cluster")
		}
	}
}

func TestClusterByJaccardMinSizeFilter(t *testing.T) {
	members := []ClusterMember{
		{Path: "src/a.ts", Shingles: [][]string{{"a", "b", "c"}}},
		{Path: "src/b.ts", Shingles: [][]string{{"a", "b", "c"}}},
	}

	results := ClusterByJaccard(members, 0.1, 3)

	if len(results) != 0 {
		t.Errorf("Expected 0 clusters (filtered by min size), got %d", len(results))
	}
}

func TestClusterByJaccardNoClusters(t *testing.T) {
	members := []ClusterMember{
		{Path: "src/a.ts", Shingles: [][]string{{"a", "b", "c"}}},
		{Path: "src/b.ts", Shingles: [][]string{{"x", "y", "z"}}},
	}

	results := ClusterByJaccard(members, 0.9, 2)

	if len(results) != 0 {
		t.Errorf("Expected 0 clusters (high threshold), got %d", len(results))
	}
}

func TestClusterByJaccardEmptyMembers(t *testing.T) {
	results := ClusterByJaccard([]ClusterMember{}, 0.5, 2)

	if len(results) != 0 {
		t.Errorf("Expected 0 clusters for empty input, got %d", len(results))
	}
}

func TestClusterByJaccardSorting(t *testing.T) {
	// Two distinct groups: group1 shares "a","b","c" and group2 shares "x","y","z"
	members := []ClusterMember{
		{Path: "src/a.ts", Shingles: [][]string{{"a", "b", "c"}, {"d", "e", "f"}}},
		{Path: "src/b.ts", Shingles: [][]string{{"a", "b", "c"}, {"d", "e", "f"}}},
		{Path: "src/c.ts", Shingles: [][]string{{"x", "y", "z"}, {"g", "h", "i"}}},
		{Path: "src/d.ts", Shingles: [][]string{{"x", "y", "z"}, {"g", "h", "i"}}},
	}

	results := ClusterByJaccard(members, 0.1, 2)

	if len(results) != 2 {
		t.Fatalf("Expected 2 clusters, got %d", len(results))
	}

	// Results should be sorted by confidence descending
	if results[0].Confidence < results[1].Confidence {
		t.Errorf("Expected clusters sorted by confidence descending, got %v then %v", results[0].Confidence, results[1].Confidence)
	}
}

func TestExtractClusterName(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"src/lib/components/button.svelte", "components"},
		{"frontend/src/stores/user.ts", "stores"},
		{"button.svelte", "button.svelte"},
		{"a/b/c/d/e.ts", "d"},
	}

	for _, tt := range tests {
		got := extractClusterName(tt.input)
		if got != tt.expected {
			t.Errorf("extractClusterName(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestGenerateClusterID(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"src/lib/components/button.svelte", "components-button.svelte"},
		{"frontend/src/stores/user.ts", "stores-user.ts"},
		{"button.svelte", "button.svelte"},
	}

	for _, tt := range tests {
		got := generateClusterID(tt.input)
		if got != tt.expected {
			t.Errorf("generateClusterID(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestSplitPath(t *testing.T) {
	tests := []struct {
		input    string
		expected []string
	}{
		{"src/lib/components/button.svelte", []string{"src", "lib", "components", "button.svelte"}},
		{"frontend/src/stores/user.ts", []string{"frontend", "src", "stores", "user.ts"}},
		{"button.svelte", []string{"button.svelte"}},
		{"a/b/c", []string{"a", "b", "c"}},
	}

	for _, tt := range tests {
		got := splitPath(tt.input)
		if !reflect.DeepEqual(got, tt.expected) {
			t.Errorf("splitPath(%q) = %v, want %v", tt.input, got, tt.expected)
		}
	}
}

func TestClusterByJaccardLargeCluster(t *testing.T) {
	// Create 5 files with high similarity (share "a", "b", "c" shingles)
	members := make([]ClusterMember, 5)
	for i := range members {
		members[i] = ClusterMember{
			Path:     "src/file" + string(rune('a'+i)) + ".ts",
			Shingles: [][]string{{"a", "b", "c"}, {"d", "e", "f"}},
		}
	}

	results := ClusterByJaccard(members, 0.5, 2)

	if len(results) != 1 {
		t.Fatalf("Expected 1 cluster, got %d", len(results))
	}

	if len(results[0].Members) != 5 {
		t.Errorf("Cluster members = %d, want 5", len(results[0].Members))
	}

	if results[0].Confidence != 1.0 {
		t.Errorf("Cluster confidence = %v, want 1.0", results[0].Confidence)
	}
}
