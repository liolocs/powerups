package project

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Config represents a cuisson.config.json file
type Config struct {
	Name string `json:"name"`
}

// LoadConfig walks up from startDir looking for cuisson.config.json and returns the parsed config
func LoadConfig(startDir string) (*Config, error) {
	dir := startDir

	for {
		configPath := filepath.Join(dir, "cuisson.config.json")
		data, err := os.ReadFile(configPath)
		if err == nil {
			var cfg Config
			if err := json.Unmarshal(data, &cfg); err != nil {
				return nil, fmt.Errorf("invalid cuisson.config.json: %w", err)
			}
			if cfg.Name == "" {
				return nil, fmt.Errorf("invalid cuisson.config.json: missing 'name' field")
			}
			return &cfg, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			// Reached filesystem root
			return nil, fmt.Errorf("no cuisson.config.json found. Register this project with 'cuisson project create <name>'")
		}
		dir = parent
	}
}

// ProjectsDir returns the project data directory for a project name (~/.cuisson/projects/<name>)
func ProjectsDir(projectName string) string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".cuisson", "projects", projectName)
}

// TemplatesDir returns the centralized template directory for a project name
func TemplatesDir(projectName string) string {
	return filepath.Join(ProjectsDir(projectName), "templates")
}
