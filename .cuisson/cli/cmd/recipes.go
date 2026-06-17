package cmd

import (
	"github.com/spf13/cobra"
)

// recipesCmd is the "recipes" parent command group
var recipesCmd = &cobra.Command{
	Use:   "recipes",
	Short: "Manage and search recipes",
	Long:  `Commands for managing and searching recipe collections.`,
}

func init() {
	rootCmd.AddCommand(recipesCmd)
}
