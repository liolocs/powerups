package discover

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Recipe represents a recipe.json file structure
type Recipe struct {
	Name       string `json:"name"`
	Variables  []string `json:"variables"`
	Output     Output   `json:"output"`
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

// DiscoverRecipes scans a directory for recipe.json files and returns a map of command name to Recipe
func DiscoverRecipes(templatesDir string) (map[string]Recipe, error) {
	recipes := make(map[string]Recipe)

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
			recipes[parentDir] = recipe
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	return recipes, nil
}
