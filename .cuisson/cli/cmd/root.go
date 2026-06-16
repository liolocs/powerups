package cmd

import (
	"fmt"
	"os"

	"cuisson/internal/project"

	"github.com/spf13/cobra"
)

var templatesDir string
var outputDir string

// rootCmd is the root cobra command
var rootCmd = &cobra.Command{
	Use:   "cuisson",
	Short: "Cuisson recipe-driven code generator CLI",
}

// Execute runs the root command
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

// commandsThatRequireProject lists subcommands that need a registered project
var commandsThatRequireProject = map[string]bool{
	"launch":  true,
	"create":  true,
}

func init() {
	rootCmd.PersistentFlags().StringVarP(&templatesDir, "templates", "t", "", "path to templates directory (or set CUISSON_TEMPLATES_DIR env var)")
	_ = rootCmd.PersistentFlags().MarkHidden("templates") // env var only, hidden flag

	rootCmd.PersistentPreRun = func(cmd *cobra.Command, args []string) {
		// Resolve output dir
		outputDir = os.Getenv("CUISSON_OUTPUT_DIR")

		// Resolve templates dir: explicit flag/env first, then project config discovery
		if templatesDir == "" {
			templatesDir = os.Getenv("CUISSON_TEMPLATES_DIR")
		}

		// If no explicit templates dir, try to discover via project config
		if templatesDir == "" {
			// Skip discovery for project subcommands (project create/list/delete/info)
			if isProjectSubcommand(cmd) {
				return
			}

			// Skip discovery for commands that don't need it
			if !commandsThatRequireProject[cmd.Name()] {
				return
			}

			cwd, err := os.Getwd()
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error: failed to get current directory: %v\n", err)
				os.Exit(1)
			}

			cfg, err := project.LoadConfig(cwd)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Error: %v\n", err)
				os.Exit(1)
			}

			templatesDir = project.TemplatesDir(cfg.Name)
		}
	}
}

// isProjectSubcommand returns true if the command is a child of the project subcommand group
func isProjectSubcommand(cmd *cobra.Command) bool {
	for c := cmd; c != nil; c = c.Parent() {
		if c.Name() == "project" {
			return true
		}
		if c == rootCmd {
			break
		}
	}
	return false
}
