package patterns

import "time"

// PatternsFile is the top-level structure written to ~/.cuisson/projects/<project>/patterns.json
type PatternsFile struct {
	Version    int       `json:"version"`
	Project    string    `json:"project"`
	DetectedAt time.Time `json:"detected_at"`
	Clusters   []Cluster `json:"clusters"`
}

// Cluster represents a detected pattern group
type Cluster struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Confidence  float64       `json:"confidence"`
	MemberCount int           `json:"member_count"`
	Intent      []string      `json:"intent"`
	Files       []FilePattern `json:"files"`
}

// FilePattern represents one file within a cluster
type FilePattern struct {
	Path             string `json:"path"`
	SkeletonTemplate string `json:"skeleton_template"`
	Slots            []Slot `json:"slots"`
}

// Slot represents an inferred variable position in a file
type Slot struct {
	Name         string `json:"name"`
	Positions    []int  `json:"positions"`
	InferredFrom string `json:"inferred_from"` // "filename", "divergence", "literal"
}

// RecipeFile represents a single file output in a recipe
type RecipeFile struct {
	Name       string `json:"name"`
	Template   string `json:"template"`
	OutputPath string `json:"outputPath"`
}

// Output represents the output section of a recipe
type Output struct {
	Files []RecipeFile `json:"files"`
}
