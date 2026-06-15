package cmd

import (
	"fmt"
	"os"

	"cuisson/internal/discover"

	"github.com/spf13/cobra"
)

var variables []string

// launchCmd is the "launch" subcommand
var launchCmd = &cobra.Command{
	Use:   "launch [recipe-name]",
	Short: "Launch a recipe by name",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		recipeName := args[0]

		// Discover recipes
		recipes, err := discover.DiscoverRecipes(templatesDir)
		if err != nil {
			return fmt.Errorf("failed to discover recipes: %w", err)
		}

		if len(recipes) == 0 {
			return fmt.Errorf("no recipes found in %s", templatesDir)
		}

		recipe, exists := recipes[recipeName]
		if !exists {
			fmt.Printf("Invalid recipe. Available recipes:\n")
			for name := range recipes {
				fmt.Printf("  - %s\n", name)
			}
			os.Exit(1)
		}

		fmt.Printf("Launching recipe: %s\n", recipe.Name)
		fmt.Printf("Variables required: %v\n", recipe.Variables)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(launchCmd)
	launchCmd.Flags().StringArrayVarP(&variables, "var", "v", []string{}, "variable in key=value format (can be repeated)")
}
