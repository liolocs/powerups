package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"cuisson/internal/discover"
	"cuisson/internal/metrics"
	"cuisson/internal/project"
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

		// Calculate input characters from resolved variables
		inputChars := 0
		for _, v := range resolved {
			inputChars += len(v)
		}

		// Get project name for metrics logging
		var projectName string
		if outputDir != "" {
			cfg, err := project.LoadConfig(outputDir)
			if err == nil {
				projectName = cfg.Name
			}
		}

		// Resolve composition tree (parent + all children in pre-order)
		nodes, err := render.ResolveCompositionTree(entry, resolved, recipes)
		if err != nil {
			return fmt.Errorf("failed to resolve composition: %w", err)
		}

		// Render each file from each node in the composition tree, tracking output metrics
		var fileResults []metrics.FileResult
		for _, node := range nodes {
			fmt.Printf("  Rendering recipe: %s\n", node.Entry.Recipe.Name)

			for _, rf := range node.Entry.Recipe.Output.Files {
				written, err := render.RenderFile(node.Entry.DirPath, rf, node.Variables, outputDir)
				if err != nil {
					fmt.Printf("[x] Error rendering %s/%s: %v\n", node.Entry.Recipe.Name, rf.Name, err)
					// Continue with other files instead of failing entirely
				}

				// Resolve the output path to get file size info
				outputPath := resolveOutputPath(rf.OutputPath, node.Variables)
				if outputDir != "" {
					outputPath = filepath.Join(outputDir, outputPath)
				}

				var fileChars int
				if stat, err := os.Stat(outputPath); err == nil {
					fileChars = int(stat.Size())
				}

				fileResults = append(fileResults, metrics.FileResult{
					Path:    outputPath,
					Chars:   fileChars,
					Written: written,
				})
			}
		}

		// Log metrics if any files were written
		if projectName != "" {
			mgr, err := metrics.NewManager()
			if err != nil {
				fmt.Printf("[!] Failed to create metrics manager: %v\n", err)
			} else {
				writtenCount, err := mgr.Log(projectName, entry.Recipe.Name, inputChars, fileResults)
				if err != nil {
					fmt.Printf("[!] Failed to log metrics: %v\n", err)
				} else if writtenCount > 0 {
					fmt.Printf("[+] Metrics logged: %d file(s) generated\n", writtenCount)
				}
			}
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(launchCmd)
	launchCmd.Flags().StringArrayVarP(&varFlags, "var", "v", []string{}, "variable in key=value format (can be repeated)")
}

// resolveOutputPath replaces {{var}} patterns in the output path with variable values.
func resolveOutputPath(path string, variables map[string]string) string {
	result := path
	for key, value := range variables {
		result = strings.ReplaceAll(result, fmt.Sprintf("{{%s}}", key), value)
	}
	return result
}
