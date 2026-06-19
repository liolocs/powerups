package metrics

import (
	"crypto/rand"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// FileResult holds per-file metrics from a launch run.
type FileResult struct {
	Path    string `json:"path"`
	Chars   int    `json:"chars"`
	Written bool   `json:"written"`
}

// Entry is one JSON line in the metrics.jsonl file.
type Entry struct {
	RunID            string        `json:"runId"`
	Timestamp        time.Time     `json:"timestamp"`
	Project          string        `json:"project"`
	Recipe           string        `json:"recipe"`
	InputChars       int           `json:"inputChars"`
	Files            []FileResult  `json:"files"`
	TotalOutputChars int           `json:"totalOutputChars"`
}

// Manager handles metrics logging and reading for a base directory.
type Manager struct {
	baseDir string // ~/.cuisson/projects directory
}

// NewManager creates a new Manager pointing to the user's .cuisson/projects home directory.
func NewManager() (*Manager, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}
	return &Manager{baseDir: filepath.Join(home, ".cuisson", "projects")}, nil
}

// NewManagerWithBase creates a Manager with an explicit base directory (for testing).
func NewManagerWithBase(baseDir string) *Manager {
	return &Manager{baseDir: baseDir}
}

// Log appends a metrics entry to ~/.cuisson/projects/<project>/metrics.jsonl.
// It returns the number of files actually written (written == true).
func (m *Manager) Log(projectName, recipeName string, inputChars int, files []FileResult) (int, error) {
	projectDir := filepath.Join(m.baseDir, projectName)
	metricsFile := filepath.Join(projectDir, "metrics.jsonl")

	// Ensure project directory exists
	if err := os.MkdirAll(projectDir, 0755); err != nil {
		return 0, fmt.Errorf("failed to create metrics directory %s: %w", projectDir, err)
	}

	// Calculate total output chars and count written files
	var totalOutputChars int
	writtenCount := 0
	for _, f := range files {
		totalOutputChars += f.Chars
		if f.Written {
			writtenCount++
		}
	}

	// Only log if at least one file was written
	if writtenCount == 0 {
		return 0, nil
	}

	entry := Entry{
		RunID:            generateRunID(),
		Timestamp:        time.Now().UTC(),
		Project:          projectName,
		Recipe:           recipeName,
		InputChars:       inputChars,
		Files:            files,
		TotalOutputChars: totalOutputChars,
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal metrics entry: %w", err)
	}

	// Append (create file if it doesn't exist)
	f, err := os.OpenFile(metricsFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return 0, fmt.Errorf("failed to open metrics file %s: %w", metricsFile, err)
	}
	defer f.Close()

	if _, err := fmt.Fprintln(f, string(data)); err != nil {
		return 0, fmt.Errorf("failed to write metrics entry: %w", err)
	}

	return writtenCount, nil
}

// generateRunID creates a simple UUID v4-like identifier using crypto/rand.
func generateRunID() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	b[6] = (b[6] & 0x0f) | 0x40 // version 4
	b[8] = (b[8] & 0x3f) | 0x80 // variant 1
	return fmt.Sprintf("%08x-%04x-%04x-%04x-%012x",
		b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}
