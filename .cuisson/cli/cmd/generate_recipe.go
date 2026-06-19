package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"cuisson/internal/patterns"
	"cuisson/internal/recipegen"

	"github.com/spf13/cobra"
)

var generateOutputDir string

// generateRecipeCmd is the "generate-recipe" subcommand
var generateRecipeCmd = &cobra.Command{
	Use:   "generate-recipe [cluster-id]",
	Short: "Generate a recipe from a detected pattern cluster",
	Long: `Reads a detected cluster from ~/.cuisson/projects/<project-name>/patterns.json,
extracts skeleton templates with inferred slot names, and writes a recipe
directory (recipe.json + .tmpl files) to the templates folder.

The generated recipe can then be used with 'cuisson launch' or discovered
by 'cuisson recipes search'.

Examples:
  cuisson generate-recipe ui-component-1
  cuisson generate-recipe ui-component-1 --output-dir templates/`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		clusterID := args[0]

		// Resolve project name from config or cwd
		projectName, err := resolveProjectName()
		if err != nil {
			return fmt.Errorf("failed to resolve project name: %w", err)
		}

		// Read patterns.json
		pf, err := patterns.Read(projectName)
		if err != nil {
			return fmt.Errorf("failed to read patterns.json: %w", err)
		}

		if len(pf.Clusters) == 0 {
			fmt.Println("No patterns detected. Run 'cuisson detect-patterns' first.")
			return nil
		}

		// Find the cluster by ID
		found := false
		for _, c := range pf.Clusters {
			if c.ID == clusterID {
				found = true
				break
			}
		}

		if !found {
			fmt.Printf("Invalid cluster ID: %q\n", clusterID)
			fmt.Println("\nAvailable clusters:")
			for _, c := range pf.Clusters {
				fmt.Printf("  - %s (%q, confidence: %.2f, %d files)\n", c.ID, c.Name, c.Confidence, c.MemberCount)
			}
			os.Exit(1)
		}

		// Resolve templates directory
		templatesDir := os.Getenv("CUISSON_TEMPLATES_DIR")
		if templatesDir == "" {
			templatesDir = generateOutputDir
		}

		if templatesDir == "" {
			return fmt.Errorf("templates directory not found. Set CUISSON_TEMPLATES_DIR or use --output-dir")
		}

		// Generate recipe
		generator := &recipegen.Generator{TemplatesDir: templatesDir}
		output, err := generator.Generate(pf, clusterID)
		if err != nil {
			return fmt.Errorf("failed to generate recipe: %w", err)
		}

		fmt.Printf("Recipe generated at %s\n", filepath.Dir(output.RecipePath))
		fmt.Printf("  recipe.json: %s\n", output.RecipePath)
		for _, tmpl := range output.TmplFiles {
			fmt.Printf("  %s\n", filepath.Base(tmpl))
		}
		fmt.Println("\nEdit files as needed, then use 'cuisson launch' or 'cuisson recipes search'.")

		return nil
	},
}

func init() {
	rootCmd.AddCommand(generateRecipeCmd)
	generateRecipeCmd.Flags().StringVarP(&generateOutputDir, "output-dir", "o", "", "Directory to write the generated recipe (default: CUISSON_TEMPLATES_DIR)")
}
