package cmd

import (
	"fmt"
	"os"

	"cuisson/internal/recipesearch"

	"github.com/spf13/cobra"
)

var searchIntent string
var searchLimit int

// recipesSearchCmd is the "recipes search" subcommand
var recipesSearchCmd = &cobra.Command{
	Use:   "search",
	Short: "Search recipes by intent description",
	Long: `Search all recipes by keyword overlap on their intent descriptions.

Returns full recipe.json content ranked by match relevance, suitable for AI agent consumption.

Examples:
  cuisson recipes search --intent "new base ui component"
  cuisson recipes search --intent "shadcn button" --limit 3`,
	Args: cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		if searchIntent == "" {
			fmt.Fprintln(os.Stderr, "Error: --intent flag is required")
			cmd.Usage()
			os.Exit(1)
		}

		// Resolve templates directory
		templatesDir := os.Getenv("CUISSON_TEMPLATES_DIR")
		if templatesDir == "" {
			var err error
			templatesDir, err = recipesearch.FindTemplatesDir()
			if err != nil {
				return fmt.Errorf("failed to find templates directory: %w", err)
			}
		}

		// Search recipes
		results, err := recipesearch.SearchRecipes(templatesDir, searchIntent, searchLimit)
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			os.Exit(1)
		}

		// Print results in human-readable format, then JSON
		recipesearch.PrintResults(results)

		return nil
	},
}

func init() {
	recipesCmd.AddCommand(recipesSearchCmd)
	recipesSearchCmd.Flags().StringVarP(&searchIntent, "intent", "i", "", "search query for intent matching (required)")
	recipesSearchCmd.Flags().IntVarP(&searchLimit, "limit", "l", 5, "maximum number of results to return")
	_ = recipesSearchCmd.MarkFlagRequired("intent")
}
