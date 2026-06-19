package project

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Manager handles CRUD operations for cuisson projects
type Manager struct {
	homeDir string // ~/.cuisson/projects directory
}

// NewManager creates a new Manager pointing to the user's .cuisson/projects home directory
func NewManager() (*Manager, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}
	return &Manager{homeDir: filepath.Join(home, ".cuisson", "projects")}, nil
}

// CreateProject creates a new project: initializes ~/.cuisson/projects/<name>/templates/ and writes cuisson.config.json in cwd
func (m *Manager) CreateProject(cwd, name string) error {
	// Check for name conflict
	if _, err := os.Stat(filepath.Join(m.homeDir, name)); err == nil {
		return fmt.Errorf("project %q already exists in ~/.cuisson/projects/", name)
	}

	// Create templates directory with parents
	tmplDir := filepath.Join(m.homeDir, name, "templates")
	if err := os.MkdirAll(tmplDir, 0755); err != nil {
		return fmt.Errorf("failed to create templates directory %s: %w", tmplDir, err)
	}

	// Write cuisson.config.json in CWD
	configPath := filepath.Join(cwd, "cuisson.config.json")
	configData, err := json.MarshalIndent(map[string]string{"name": name}, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}
	if err := os.WriteFile(configPath, append(configData, '\n'), 0644); err != nil {
		return fmt.Errorf("failed to write config file %s: %w", configPath, err)
	}

	return nil
}

// ListProjects returns all registered project names and their template directories
func (m *Manager) ListProjects() ([]struct {
	Name        string `json:"name"`
	TemplateDir string `json:"template_dir"`
}, error) {
	entries, err := os.ReadDir(m.homeDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to read ~/.cuisson/projects/: %w", err)
	}

	var projects []struct {
		Name        string `json:"name"`
		TemplateDir string `json:"template_dir"`
	}

	for _, entry := range entries {
		if entry.IsDir() && len(entry.Name()) > 0 && entry.Name()[0] != '.' {
			tmplDir := filepath.Join(m.homeDir, entry.Name(), "templates")
			if _, err := os.Stat(tmplDir); err == nil {
				projects = append(projects, struct {
					Name        string `json:"name"`
					TemplateDir string `json:"template_dir"`
				}{
					Name:        entry.Name(),
					TemplateDir: tmplDir,
				})
			}
		}
	}

	return projects, nil
}

// DeleteProject removes a project's templates directory from ~/.cuisson/projects/<name>/
func (m *Manager) DeleteProject(name string) error {
	projectDir := filepath.Join(m.homeDir, name)
	if _, err := os.Stat(projectDir); os.IsNotExist(err) {
		return fmt.Errorf("project %q not found in ~/.cuisson/projects/", name)
	}

	if err := os.RemoveAll(projectDir); err != nil {
		return fmt.Errorf("failed to remove project directory %s: %w", projectDir, err)
	}

	return nil
}

// Info returns details about a registered project
func (m *Manager) Info(name string) (*struct {
	Name        string `json:"name"`
	TemplateDir string `json:"template_dir"`
}, error) {
	projectDir := filepath.Join(m.homeDir, name)

	// Check project exists
	if _, err := os.Stat(projectDir); os.IsNotExist(err) {
		return nil, fmt.Errorf("project %q not found in ~/.cuisson/projects/", name)
	}

	tmplDir := filepath.Join(projectDir, "templates")
	if _, err := os.Stat(tmplDir); os.IsNotExist(err) {
		return nil, fmt.Errorf("templates directory not found for project %q", name)
	}

	return &struct {
		Name        string `json:"name"`
		TemplateDir string `json:"template_dir"`
	}{
		Name:        name,
		TemplateDir: tmplDir,
	}, nil
}
