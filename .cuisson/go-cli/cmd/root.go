package cmd

import (
	"os"

	"github.com/spf13/cobra"
)

var templatesDir string

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

func init() {
	rootCmd.PersistentFlags().StringVarP(&templatesDir, "templates", "t", "", "path to templates directory (or set CUISSON_TEMPLATES_DIR env var)")
	_ = rootCmd.PersistentFlags().MarkHidden("templates") // env var only, hidden flag

	// Default to .cuisson/templates if not set
	rootCmd.PersistentPreRun = func(cmd *cobra.Command, args []string) {
		if templatesDir == "" {
			templatesDir = os.Getenv("CUISSON_TEMPLATES_DIR")
		}
		if templatesDir == "" {
			templatesDir = ".cuisson/templates"
		}
	}
}
