package cmd

import (
	"fmt"
	"os"

	"cuisson/internal/discover"
	"cuisson/internal/validation"

	"github.com/spf13/cobra"
)

// recipesValidateCmd is the "recipes validate" subcommand
var recipesValidateCmd = &cobra.Command{
	Use:   "validate [recipe-name]",
	Short: "Validate recipe composition for issues",
	Long: `Validate a recipe and all its transitive children for common issues.

Checks performed:
  - Circular dependencies between recipes
  - Unknown recipe references in extends
  - Missing variables not available in the parent chain
  - Duplicate output paths across composition trees

Examples:
  cuisson recipes validate                    # Validate all recipes
  cuisson recipes validate my-page            # Validate specific recipe and its children`,
	Args: cobra.MaximumNArgs(1),
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

		var recipeName string
		if len(args) > 0 {
			recipeName = args[0]
		}

		results := validation.Validate(recipeName, recipes)
		hasIssues := false
		for _, r := range results {
			if len(r.Errors) > 0 || len(r.Warnings) > 0 {
				hasIssues = true
			}
		}

		if hasIssues {
			fmt.Println()
		}
		validation.PrintResults(results)

		if hasIssues {
			os.Exit(1)
		}

		return nil
	},
}

func init() {
	recipesCmd.AddCommand(recipesValidateCmd)
}
