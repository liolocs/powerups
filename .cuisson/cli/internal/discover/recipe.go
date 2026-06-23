package discover

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Recipe represents a recipe.json file structure
type Recipe struct {
	Name      string        `json:"name"`
	Variables []string      `json:"variables"`
	Intent    []string      `json:"intent"`
	Output    Output        `json:"output"`
	Extends   []RecipeChild `json:"extends,omitempty"`
}

// Output represents the output section of a recipe
type Output struct {
	Files []RecipeFile `json:"files"`
}

// RecipeFile represents a single file output in a recipe
type RecipeFile struct {
	Name       string `json:"name"`
	Template   string `json:"template"`
	OutputPath string `json:"outputPath"`
}

// RecipeChild represents a child recipe that this recipe extends.
type RecipeChild struct {
	Recipe    string            `json:"recipe"`
	Variables []string          `json:"variables,omitempty"`
	Map       map[string]string `json:"map,omitempty"`
}

// RecipeEntry holds a recipe and the directory containing its template files
type RecipeEntry struct {
	Recipe    Recipe
	DirPath   string // directory containing recipe.json and template files
}

// DiscoverRecipes scans a directory for recipe.json files and returns a map of command name to RecipeEntry
func DiscoverRecipes(templatesDir string) (map[string]RecipeEntry, error) {
	recipes := make(map[string]RecipeEntry)

	err := filepath.Walk(templatesDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.Name() == "recipe.json" && !info.IsDir() {
			data, err := os.ReadFile(path)
			if err != nil {
				return err
			}
			var recipe Recipe
			if err := json.Unmarshal(data, &recipe); err != nil {
				return err
			}

			// Command name is the parent directory of recipe.json
			parentDir := filepath.Base(filepath.Dir(path))
			recipes[parentDir] = RecipeEntry{
				Recipe:  recipe,
				DirPath: filepath.Dir(path),
			}
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return recipes, nil
}
