package metrics

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

// RecipeStat holds aggregated metrics for a single recipe.
type RecipeStat struct {
	Recipe           string `json:"recipe"`
	Launches         int    `json:"launches"`
	InputChars       int    `json:"inputChars"`
	OutputChars      int    `json:"outputChars"`
	FilesWritten     int    `json:"filesWritten"`
}

// TotalStat holds the overall totals across all recipes.
type TotalStat struct {
	Launches     int `json:"launches"`
	InputChars   int `json:"inputChars"`
	OutputChars  int `json:"outputChars"`
	FilesWritten int `json:"filesWritten"`
}

// Aggregate reads the metrics JSONL file for a project and returns per-recipe stats plus totals.
func (m *Manager) Aggregate(projectName string) ([]RecipeStat, TotalStat, error) {
	metricsFile := filepath.Join(m.baseDir, projectName, "metrics.jsonl")

	// Check if metrics file exists
	if _, err := os.Stat(metricsFile); os.IsNotExist(err) {
		return nil, TotalStat{}, fmt.Errorf("no metrics recorded for project %q", projectName)
	}

	f, err := os.Open(metricsFile)
	if err != nil {
		return nil, TotalStat{}, fmt.Errorf("failed to open metrics file %s: %w", metricsFile, err)
	}
	defer f.Close()

	// recipeName -> accumulated stats
	stats := make(map[string]*RecipeStat)
	var total TotalStat
	var corruptCount int

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var entry Entry
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			corruptCount++
			continue
		}

		rs, ok := stats[entry.Recipe]
		if !ok {
			rs = &RecipeStat{Recipe: entry.Recipe}
			stats[entry.Recipe] = rs
		}

		rs.Launches++
		rs.InputChars += entry.InputChars
		rs.OutputChars += entry.TotalOutputChars

		for _, f := range entry.Files {
			if f.Written {
				rs.FilesWritten++
			}
		}

		total.Launches++
		total.InputChars += entry.InputChars
		total.OutputChars += entry.TotalOutputChars
		for _, f := range entry.Files {
			if f.Written {
				total.FilesWritten++
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, TotalStat{}, fmt.Errorf("failed to read metrics file: %w", err)
	}

	if corruptCount > 0 {
		fmt.Fprintf(os.Stderr, "⚠ %d corrupt entries skipped\n", corruptCount)
	}

	// Sort recipes by output chars descending for a useful table order
	var result []RecipeStat
	for _, rs := range stats {
		result = append(result, *rs)
	}
	slices.SortFunc(result, func(a, b RecipeStat) int {
		return b.OutputChars - a.OutputChars
	})

	return result, total, nil
}

// DiscoverProjects returns all project names that have a metrics.jsonl file.
func (m *Manager) DiscoverProjects() ([]string, error) {
	entries, err := os.ReadDir(m.baseDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to read %s: %w", m.baseDir, err)
	}

	var projects []string
	for _, entry := range entries {
		if !entry.IsDir() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		metricsFile := filepath.Join(m.baseDir, entry.Name(), "metrics.jsonl")
		if _, err := os.Stat(metricsFile); err == nil {
			projects = append(projects, entry.Name())
		}
	}

	return projects, nil
}
