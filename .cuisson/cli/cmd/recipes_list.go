package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"cuisson/internal/discover"

	"github.com/spf13/cobra"
)

// recipesListCmd is the "recipes list" subcommand
var recipesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all available recipes for the current project",
	Long: `List all recipes discovered in the templates directory.

Shows each recipe's name, intent descriptions, and output file count.
Suitable for browsing what recipes are available before launching one.

Examples:
  cuisson recipes list
  CUISSON_TEMPLATES_DIR=./my-templates cuisson recipes list`,
	Args: cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		// Resolve templates directory
		templatesDir := os.Getenv("CUISSON_TEMPLATES_DIR")
		if templatesDir == "" {
			var err error
			templatesDir, err = resolveTemplatesDir()
			if err != nil {
				return fmt.Errorf("failed to find templates directory: %w", err)
			}
		}

		// Discover all recipes
		recipes, err := discover.DiscoverRecipes(templatesDir)
		if err != nil {
			return fmt.Errorf("failed to discover recipes: %w", err)
		}

		if len(recipes) == 0 {
			fmt.Println("No recipes found in", templatesDir)
			return nil
		}

		fmt.Printf("Found %d recipe(s) in %s:\n\n", len(recipes), templatesDir)

		for name, entry := range recipes {
			fmt.Printf("  %-25s %d file(s)\n", name, len(entry.Recipe.Output.Files))
			for _, intent := range entry.Recipe.Intent {
				fmt.Printf("    %s\n", intent)
			}
		}

		return nil
	},
}

func init() {
	recipesCmd.AddCommand(recipesListCmd)
}

// resolveTemplatesDir resolves the templates directory from env var or project config.
func resolveTemplatesDir() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get current directory: %w", err)
	}

	dir := cwd
	for {
		configPath := filepath.Join(dir, "cuisson.config.json")
		data, err := os.ReadFile(configPath)
		if err == nil {
			var cfg struct{ Name string }
			if json.Unmarshal(data, &cfg) == nil && cfg.Name != "" {
				home, _ := os.UserHomeDir()
				return filepath.Join(home, ".cuisson", cfg.Name, "templates"), nil
			}
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "", fmt.Errorf("templates directory not found. Set CUISSON_TEMPLATES_DIR or run from a project with cuisson.config.json")
}
