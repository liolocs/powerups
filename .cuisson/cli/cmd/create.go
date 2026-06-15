package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"cuisson/internal/variables"

	"github.com/spf13/cobra"
)

var createVariables []string

// createCmd is the "create" subcommand
var createCmd = &cobra.Command{
	Use:   "create [recipe-name]",
	Short: "Create a new recipe directory with scaffolded files",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		recipeName := args[0]

		// Parse --var flags for variable names
		varNames, err := variables.ParseNames(createVariables)
		if err != nil {
			return fmt.Errorf("failed to parse variables: %w", err)
		}

		if len(varNames) == 0 {
			return fmt.Errorf("at least one --var name is required")
		}

		// Create recipe directory
		recipeDir := filepath.Join(templatesDir, recipeName)
		if err := os.MkdirAll(recipeDir, 0755); err != nil {
			return fmt.Errorf("failed to create recipe directory: %w", err)
		}

		// Write recipe.json
		var filesSection strings.Builder
		for i, varName := range varNames {
			if i > 0 {
				filesSection.WriteString(",\n")
			}
			filesSection.WriteString(fmt.Sprintf(`      {
        "name": "%s",
        "template": "%s.tmpl",
        "outputPath": "{{%s}}"
      }`, varName, varName, varName))
		}

		var varsSection strings.Builder
		for i, varName := range varNames {
			if i > 0 {
				varsSection.WriteString(", ")
			}
			varsSection.WriteString(fmt.Sprintf(`"%s"`, varName))
		}

		recipeJSON := fmt.Sprintf(`{
  "name": "%s",
  "variables": [%s],
  "output": {
    "files": [
%s
    ]
  }
}`, recipeName, varsSection.String(), filesSection.String())

		recipePath := filepath.Join(recipeDir, "recipe.json")
		if err := os.WriteFile(recipePath, []byte(recipeJSON), 0644); err != nil {
			return fmt.Errorf("failed to write recipe.json: %w", err)
		}

		fmt.Printf("[+] Created file %s\n", recipePath)

		// Create .tmpl files for each variable
		for _, varName := range varNames {
			tmplContent := fmt.Sprintf(`{{.%s}}`, varName)
			tmplPath := filepath.Join(recipeDir, fmt.Sprintf("%s.tmpl", varName))
			if err := os.WriteFile(tmplPath, []byte(tmplContent), 0644); err != nil {
				return fmt.Errorf("failed to write %s: %w", varName, err)
			}

			fmt.Printf("[+] Created file %s\n", tmplPath)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(createCmd)
	createCmd.Flags().StringArrayVarP(&createVariables, "var", "v", []string{}, "variable name (can be repeated)")
}
