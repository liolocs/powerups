package metrics

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// testTime is a fixed time for test reproducibility.
var testTime = time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)

func TestLog(t *testing.T) {
	tmpDir := t.TempDir()
	mgr := NewManagerWithBase(tmpDir)

	projectName := "test-project"
	files := []FileResult{
		{Path: "src/Component.ts", Chars: 500, Written: true},
		{Path: "src/Component.test.ts", Chars: 300, Written: true},
		{Path: "src/unused.ts", Chars: 100, Written: false},
	}

	writtenCount, err := mgr.Log(projectName, "new-component", 42, files)
	if err != nil {
		t.Fatalf("Log() error = %v", err)
	}

	if writtenCount != 2 {
		t.Errorf("writtenCount = %d, want 2", writtenCount)
	}

	// Verify the metrics file was created with valid JSONL
	metricsFile := filepath.Join(tmpDir, projectName, "metrics.jsonl")
	data, err := os.ReadFile(metricsFile)
	if err != nil {
		t.Fatalf("failed to read metrics file: %v", err)
	}

	var entry Entry
	if err := json.Unmarshal(data, &entry); err != nil {
		t.Fatalf("metrics file is not valid JSON: %v", err)
	}

	if entry.Project != projectName {
		t.Errorf("project = %q, want %q", entry.Project, projectName)
	}

	if entry.Recipe != "new-component" {
		t.Errorf("recipe = %q, want %q", entry.Recipe, "new-component")
	}

	if entry.InputChars != 42 {
		t.Errorf("inputChars = %d, want 42", entry.InputChars)
	}

	if entry.TotalOutputChars != 900 {
		t.Errorf("totalOutputChars = %d, want 900", entry.TotalOutputChars)
	}

	if len(entry.Files) != 3 {
		t.Errorf("files count = %d, want 3", len(entry.Files))
	}

	if entry.RunID == "" {
		t.Error("runId should not be empty")
	}

	if len(entry.RunID) != 36 {
		t.Errorf("runId length = %d, want 36", len(entry.RunID))
	}

	if entry.RunID[14] != '4' {
		t.Errorf("runId version marker = %c, want 4", entry.RunID[14])
	}
}

func TestLogSkipsWhenNoFilesWritten(t *testing.T) {
	tmpDir := t.TempDir()
	mgr := NewManagerWithBase(tmpDir)

	projectName := "empty-project"
	files := []FileResult{
		{Path: "src/old.ts", Chars: 100, Written: false},
	}

	writtenCount, err := mgr.Log(projectName, "old-recipe", 10, files)
	if err != nil {
		t.Fatalf("Log() error = %v", err)
	}

	if writtenCount != 0 {
		t.Errorf("writtenCount = %d, want 0", writtenCount)
	}

	// Verify no metrics file was created
	metricsFile := filepath.Join(tmpDir, projectName, "metrics.jsonl")
	if _, err := os.Stat(metricsFile); !os.IsNotExist(err) {
		t.Error("metrics file should not exist when no files were written")
	}
}

func TestAggregate(t *testing.T) {
	tmpDir := t.TempDir()
	mgr := NewManagerWithBase(tmpDir)

	projectName := "test-project"
	metricsFile := filepath.Join(tmpDir, projectName, "metrics.jsonl")

	// Create project directory
	if err := os.MkdirAll(filepath.Join(tmpDir, projectName), 0755); err != nil {
		t.Fatal(err)
	}

	// Write multiple entries
	entries := []Entry{
		{RunID: "1", Timestamp: testTime, Project: projectName, Recipe: "new-component", InputChars: 42, Files: []FileResult{{Path: "a.ts", Chars: 500, Written: true}, {Path: "b.ts", Chars: 300, Written: true}}, TotalOutputChars: 800},
		{RunID: "2", Timestamp: testTime, Project: projectName, Recipe: "new-component", InputChars: 30, Files: []FileResult{{Path: "c.ts", Chars: 200, Written: true}}, TotalOutputChars: 200},
		{RunID: "3", Timestamp: testTime, Project: projectName, Recipe: "new-store", InputChars: 15, Files: []FileResult{{Path: "d.ts", Chars: 600, Written: true}}, TotalOutputChars: 600},
	}

	var content string
	for _, e := range entries {
		data, _ := json.Marshal(e)
		content += string(append(data, '\n'))
	}

	if err := os.WriteFile(metricsFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write metrics file: %v", err)
	}

	stats, total, err := mgr.Aggregate(projectName)
	if err != nil {
		t.Fatalf("Aggregate() error = %v", err)
	}

	if len(stats) != 2 {
		t.Fatalf("expected 2 recipe stats, got %d", len(stats))
	}

	// First should be new-component (800+200=1000 output chars)
	if stats[0].Recipe != "new-component" {
		t.Errorf("first recipe = %q, want %q", stats[0].Recipe, "new-component")
	}

	if stats[0].Launches != 2 {
		t.Errorf("new-component launches = %d, want 2", stats[0].Launches)
	}

	if stats[0].InputChars != 72 {
		t.Errorf("new-component inputChars = %d, want 72", stats[0].InputChars)
	}

	if stats[0].OutputChars != 1000 {
		t.Errorf("new-component outputChars = %d, want 1000", stats[0].OutputChars)
	}

	if stats[0].FilesWritten != 3 {
		t.Errorf("new-component filesWritten = %d, want 3", stats[0].FilesWritten)
	}

	// Second should be new-store (600 output chars)
	if stats[1].Recipe != "new-store" {
		t.Errorf("second recipe = %q, want %q", stats[1].Recipe, "new-store")
	}

	if stats[1].Launches != 1 {
		t.Errorf("new-store launches = %d, want 1", stats[1].Launches)
	}

	if total.Launches != 3 {
		t.Errorf("total launches = %d, want 3", total.Launches)
	}

	if total.InputChars != 87 {
		t.Errorf("total inputChars = %d, want 87", total.InputChars)
	}

	if total.OutputChars != 1600 {
		t.Errorf("total outputChars = %d, want 1600", total.OutputChars)
	}

	if total.FilesWritten != 4 {
		t.Errorf("total filesWritten = %d, want 4", total.FilesWritten)
	}
}

func TestAggregateSkipsCorruptEntries(t *testing.T) {
	tmpDir := t.TempDir()
	mgr := NewManagerWithBase(tmpDir)

	projectName := "corrupt-project"
	metricsFile := filepath.Join(tmpDir, projectName, "metrics.jsonl")

	if err := os.MkdirAll(filepath.Join(tmpDir, projectName), 0755); err != nil {
		t.Fatal(err)
	}

	validEntry := Entry{RunID: "v1", Timestamp: testTime, Project: projectName, Recipe: "good", InputChars: 10, Files: []FileResult{{Path: "a.ts", Chars: 100, Written: true}}, TotalOutputChars: 100}
	validData, _ := json.Marshal(validEntry)

	corruptEntry := Entry{RunID: "v2", Timestamp: testTime, Project: projectName, Recipe: "good", InputChars: 5, Files: []FileResult{{Path: "b.ts", Chars: 50, Written: true}}, TotalOutputChars: 50}
	corruptData, _ := json.Marshal(corruptEntry)

	content := string(append(validData, '\n')) + "this is corrupt\n" + string(append(corruptData, '\n'))

	if err := os.WriteFile(metricsFile, []byte(content), 0644); err != nil {
		t.Fatalf("failed to write metrics file: %v", err)
	}

	stats, total, err := mgr.Aggregate(projectName)
	if err != nil {
		t.Fatalf("Aggregate() error = %v", err)
	}

	if len(stats) != 1 {
		t.Fatalf("expected 1 recipe stat, got %d", len(stats))
	}

	if stats[0].Launches != 2 {
		t.Errorf("launches = %d, want 2", stats[0].Launches)
	}

	if total.Launches != 2 {
		t.Errorf("total launches = %d, want 2", total.Launches)
	}

	if stats[0].OutputChars != 150 {
		t.Errorf("outputChars = %d, want 150", stats[0].OutputChars)
	}
}

func TestAggregateNoMetricsFile(t *testing.T) {
	tmpDir := t.TempDir()
	mgr := NewManagerWithBase(tmpDir)

	_, _, err := mgr.Aggregate("no-metrics-project")
	if err == nil {
		t.Error("expected error for project with no metrics file")
	}

	if err != nil && !strings.Contains(err.Error(), "no metrics recorded") {
		t.Errorf("error = %q, want to contain %q", err.Error(), "no metrics recorded")
	}
}

func TestDiscoverProjects(t *testing.T) {
	tmpDir := t.TempDir()
	mgr := NewManagerWithBase(tmpDir)

	// Create project with metrics
	if err := os.MkdirAll(filepath.Join(tmpDir, "project-a"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, "project-a", "metrics.jsonl"), []byte("{}\n"), 0644); err != nil {
		t.Fatal(err)
	}

	// Create project without metrics
	if err := os.MkdirAll(filepath.Join(tmpDir, "project-b"), 0755); err != nil {
		t.Fatal(err)
	}

	// Create hidden project (should be skipped)
	if err := os.MkdirAll(filepath.Join(tmpDir, ".hidden"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(tmpDir, ".hidden", "metrics.jsonl"), []byte("{}\n"), 0644); err != nil {
		t.Fatal(err)
	}

	projects, err := mgr.DiscoverProjects()
	if err != nil {
		t.Fatalf("DiscoverProjects() error = %v", err)
	}

	if len(projects) != 1 {
		t.Fatalf("expected 1 project, got %d: %v", len(projects), projects)
	}

	if projects[0] != "project-a" {
		t.Errorf("project = %q, want %q", projects[0], "project-a")
	}
}

func TestGenerateRunID(t *testing.T) {
	id1 := generateRunID()
	id2 := generateRunID()

	if id1 == id2 {
		t.Error("generated run IDs should be unique")
	}

	if len(id1) != 36 {
		t.Errorf("run ID length = %d, want 36", len(id1))
	}

	if id1[14] != '4' {
		t.Errorf("run ID version marker = %c, want 4", id1[14])
	}

	// Check format: 8-4-4-4-12 hex digits with dashes
	if id1[8] != '-' || id1[13] != '-' || id1[18] != '-' || id1[23] != '-' {
		t.Errorf("run ID format incorrect: %s", id1)
	}
}
