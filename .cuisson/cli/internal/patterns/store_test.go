package patterns

import (
	"os"
	"testing"
	"time"
)

func TestWriteReadRoundTrip(t *testing.T) {
	tmpHome := t.TempDir()
	os.Setenv("HOME", tmpHome)

	pf := &PatternsFile{
		Version:    1,
		Project:    "test-project",
		DetectedAt: time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC),
		Clusters: []Cluster{
			{
				ID:          "test-cluster-1",
				Name:        "test-cluster",
				Confidence:  0.85,
				MemberCount: 3,
				Intent:      []string{"test intent"},
				Files: []FilePattern{
					{
						Path:             "src/a.ts",
						SkeletonTemplate: "a.tmpl",
						Slots: []Slot{
							{Name: "Name", Positions: []int{1, 2}, InferredFrom: "filename"},
						},
					},
				},
			},
		},
	}

	if err := Write("test-project", pf); err != nil {
		t.Fatalf("Write() error = %v", err)
	}

	loaded, err := Read("test-project")
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}

	if loaded.Version != pf.Version {
		t.Errorf("Version = %d, want %d", loaded.Version, pf.Version)
	}
	if loaded.Project != pf.Project {
		t.Errorf("Project = %q, want %q", loaded.Project, pf.Project)
	}
	if len(loaded.Clusters) != 1 {
		t.Fatalf("Clusters length = %d, want 1", len(loaded.Clusters))
	}
	if loaded.Clusters[0].ID != "test-cluster-1" {
		t.Errorf("Cluster ID = %q, want %q", loaded.Clusters[0].ID, "test-cluster-1")
	}
	if len(loaded.Clusters[0].Files) != 1 {
		t.Fatalf("File count = %d, want 1", len(loaded.Clusters[0].Files))
	}
	if loaded.Clusters[0].Files[0].Slots[0].Name != "Name" {
		t.Errorf("Slot name = %q, want %q", loaded.Clusters[0].Files[0].Slots[0].Name, "Name")
	}
}

func TestReadMissingFile(t *testing.T) {
	tmpHome := t.TempDir()
	os.Setenv("HOME", tmpHome)

	_, err := Read("nonexistent")
	if err == nil {
		t.Error("Expected error reading missing patterns.json")
	}
}

func TestStorePathCreatesDirectory(t *testing.T) {
	tmpHome := t.TempDir()
	os.Setenv("HOME", tmpHome)

	path, err := StorePath("my-project")
	if err != nil {
		t.Fatalf("StorePath() error = %v", err)
	}

	expectedDir := tmpHome + "/.cuisson/projects/my-project"
	if _, err := os.Stat(expectedDir); os.IsNotExist(err) {
		t.Errorf("Expected directory %q to be created", expectedDir)
	}

	expectedFile := expectedDir + "/patterns.json"
	if path != expectedFile {
		t.Errorf("StorePath() = %q, want %q", path, expectedFile)
	}
}

func TestWriteReadMultipleClusters(t *testing.T) {
	tmpHome := t.TempDir()
	os.Setenv("HOME", tmpHome)

	pf := &PatternsFile{
		Version:    1,
		Project:    "multi-cluster",
		DetectedAt: time.Date(2026, 6, 17, 12, 0, 0, 0, time.UTC),
		Clusters: []Cluster{
			{ID: "cluster-a", Name: "components", Confidence: 0.9, MemberCount: 5},
			{ID: "cluster-b", Name: "stores", Confidence: 0.75, MemberCount: 3},
		},
	}

	if err := Write("multi-cluster", pf); err != nil {
		t.Fatalf("Write() error = %v", err)
	}

	loaded, err := Read("multi-cluster")
	if err != nil {
		t.Fatalf("Read() error = %v", err)
	}

	if len(loaded.Clusters) != 2 {
		t.Fatalf("Clusters length = %d, want 2", len(loaded.Clusters))
	}

	if loaded.Clusters[0].ID != "cluster-a" {
		t.Errorf("First cluster ID = %q, want %q", loaded.Clusters[0].ID, "cluster-a")
	}
	if loaded.Clusters[1].ID != "cluster-b" {
		t.Errorf("Second cluster ID = %q, want %q", loaded.Clusters[1].ID, "cluster-b")
	}
}
