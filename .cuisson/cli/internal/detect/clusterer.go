package detect

import (
	"math"
	"sort"
	"strings"
)

// ClusterResult holds the output of clustering
type ClusterResult struct {
	ID         string
	Name       string
	Confidence float64
	Members    []ClusterMember
}

// ClusterMember holds a file path and its shingles for similarity comparison
type ClusterMember struct {
	Path     string
	Shingles [][]string
}

// ComputeJaccard returns the Jaccard similarity between two sets of shingles.
func ComputeJaccard(a, b [][]string) float64 {
	if len(a) == 0 && len(b) == 0 {
		return 1.0
	}
	if len(a) == 0 || len(b) == 0 {
		return 0.0
	}

	setA := make(map[string]bool, len(a))
	for _, s := range a {
		setA[shingleKey(s)] = true
	}

	intersection := 0
	for _, s := range b {
		if setA[shingleKey(s)] {
			intersection++
		}
	}

	union := len(setA) + len(b) - intersection
	return float64(intersection) / float64(union)
}

// shingleKey converts a string slice to a unique key for set membership.
func shingleKey(s []string) string {
	return s[0] + "\x00" + s[1] + "\x00" + s[2]
}

// ClusterByJaccard groups files into clusters based on Jaccard similarity.
func ClusterByJaccard(members []ClusterMember, threshold float64, minClusterSize int) []ClusterResult {
	n := len(members)
	parent := make([]int, n)
	for i := range parent {
		parent[i] = i
	}

	find := func(x int) int {
		for parent[x] != x {
			parent[x] = parent[parent[x]]
			x = parent[x]
		}
		return x
	}

	union := func(a, b int) {
		ra, rb := find(a), find(b)
		if ra != rb {
			parent[ra] = rb
		}
	}

	for i := 0; i < n; i++ {
		for j := i + 1; j < n; j++ {
			sim := ComputeJaccard(members[i].Shingles, members[j].Shingles)
			if sim >= threshold {
				union(i, j)
			}
		}
	}

	groups := make(map[int][]int)
	for i := 0; i < n; i++ {
		root := find(i)
		groups[root] = append(groups[root], i)
	}

	var results []ClusterResult
	for _, indices := range groups {
		if len(indices) < minClusterSize {
			continue
		}

		var totalSim float64
		pairs := 0
		for i := 0; i < len(indices); i++ {
			for j := i + 1; j < len(indices); j++ {
				totalSim += ComputeJaccard(
					members[indices[i]].Shingles,
					members[indices[j]].Shingles,
				)
				pairs++
			}
		}
		avgSim := totalSim / float64(pairs)

		path := members[indices[0]].Path
		clusterID := generateClusterID(path)
		clusterName := extractClusterName(path)

		var membersList []ClusterMember
		for _, idx := range indices {
			membersList = append(membersList, members[idx])
		}

		results = append(results, ClusterResult{
			ID:         clusterID,
			Name:       clusterName,
			Confidence: math.Round(avgSim*100) / 100,
			Members:    membersList,
		})
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Confidence > results[j].Confidence
	})

	return results
}

// generateClusterID creates a deterministic ID from file path.
func generateClusterID(path string) string {
	parts := splitPath(path)
	if len(parts) >= 2 {
		return parts[len(parts)-2] + "-" + parts[len(parts)-1]
	}
	return path
}

// extractClusterName derives a human-readable name from file paths.
func extractClusterName(path string) string {
	parts := splitPath(path)
	if len(parts) >= 2 {
		return parts[len(parts)-2]
	}
	if len(parts) == 1 {
		return parts[0]
	}
	return "unknown"
}

// splitPath splits a file path into components.
func splitPath(path string) []string {
	var parts []string
	var current strings.Builder
	for _, ch := range path {
		if ch == '/' || ch == '\\' {
			if current.Len() > 0 {
				parts = append(parts, current.String())
				current.Reset()
			}
		} else {
			current.WriteRune(ch)
		}
	}
	if current.Len() > 0 {
		parts = append(parts, current.String())
	}
	return parts
}
