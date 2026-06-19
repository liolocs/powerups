package patterns

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// StorePath returns the patterns.json path for a project
func StorePath(projectName string) (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(home, ".cuisson", "projects", projectName)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", err
	}
	return filepath.Join(dir, "patterns.json"), nil
}

// Write saves patterns to disk
func Write(projectName string, pf *PatternsFile) error {
	path, err := StorePath(projectName)
	if err != nil {
		return err
	}
	data, err := json.MarshalIndent(pf, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

// Read loads patterns from disk
func Read(projectName string) (*PatternsFile, error) {
	path, err := StorePath(projectName)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var pf PatternsFile
	if err := json.Unmarshal(data, &pf); err != nil {
		return nil, err
	}
	return &pf, nil
}
