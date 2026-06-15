package cmd

import (
	"fmt"
	"os"

	"cuisson/internal/discover"
	"cuisson/internal/render"
	"cuisson/internal/variables"

	"github.com/spf13/cobra"
)

var varFlags []string

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

		entry, exists := recipes[recipeName]
		if !exists {
			fmt.Printf("Invalid recipe. Available recipes:\n")
			for name := range recipes {
				fmt.Printf("  - %s\n", name)
			}
			os.Exit(1)
		}

		fmt.Printf("Launching recipe: %s\n", entry.Recipe.Name)

		// Parse --var flags
		varMap, err := variables.ParseFlags(varFlags)
		if err != nil {
			return fmt.Errorf("failed to parse variables: %w", err)
		}

		// Resolve all required variables (prompting for missing ones)
		resolved, err := variables.ResolveVariables(entry.Recipe.Variables, varMap)
		if err != nil {
			return fmt.Errorf("failed to resolve variables: %w", err)
		}

		fmt.Printf("Variables resolved: %v\n", resolved)

		// Render each file using the actual recipe directory
		for _, rf := range entry.Recipe.Output.Files {
			if err := render.RenderFile(entry.DirPath, rf, resolved); err != nil {
				fmt.Printf("[x] Error rendering %s: %v\n", rf.Name, err)
				// Continue with other files instead of failing entirely
			}
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(launchCmd)
	launchCmd.Flags().StringArrayVarP(&varFlags, "var", "v", []string{}, "variable in key=value format (can be repeated)")
}
