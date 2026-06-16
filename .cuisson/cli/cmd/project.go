package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"cuisson/internal/project"

	"github.com/spf13/cobra"
)

var projectName string

// projectCmd is the parent command group for project management
var projectCmd = &cobra.Command{
	Use:   "project",
	Short: "Manage cuisson projects (create, list, delete, info)",
}

// projectCreateCmd creates a new cuisson project
var projectCreateCmd = &cobra.Command{
	Use:   "create [name]",
	Short: "Create a new cuisson project",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		cwd, err := os.Getwd()
		if err != nil {
			return fmt.Errorf("failed to get current directory: %w", err)
		}

		name := projectName
		if name == "" {
			if len(args) > 0 {
				name = args[0]
			} else {
				// Try to auto-detect from package.json
				pkgPath := filepath.Join(cwd, "package.json")
				data, err := os.ReadFile(pkgPath)
				if err == nil {
					var pkg struct {
						Name string `json:"name"`
					}
					if err := json.Unmarshal(data, &pkg); err == nil && pkg.Name != "" {
						name = pkg.Name
					} else {
						// Fall back to directory name
						name = filepath.Base(cwd)
					}
				} else {
					// Fall back to directory name
					name = filepath.Base(cwd)
				}
			}
		}

		mgr, err := project.NewManager()
		if err != nil {
			return fmt.Errorf("failed to create manager: %w", err)
		}

		if err := mgr.CreateProject(cwd, name); err != nil {
			return fmt.Errorf("failed to create project: %w", err)
		}

		fmt.Printf("[+] Created project %q\n", name)
		fmt.Printf("    Templates: %s\n", project.TemplatesDir(name))
		fmt.Printf("    Config:    %s/.cuisson.config.json\n", cwd)

		return nil
	},
}

// projectListCmd lists all registered projects
var projectListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all registered cuisson projects",
	RunE: func(cmd *cobra.Command, args []string) error {
		mgr, err := project.NewManager()
		if err != nil {
			return fmt.Errorf("failed to create manager: %w", err)
		}

		projects, err := mgr.ListProjects()
		if err != nil {
			return fmt.Errorf("failed to list projects: %w", err)
		}

		if len(projects) == 0 {
			fmt.Println("No projects registered.")
			return nil
		}

		for _, p := range projects {
			fmt.Printf("  %-20s %s\n", p.Name, p.TemplateDir)
		}

		return nil
	},
}

// projectDeleteCmd deletes a registered project
var projectDeleteCmd = &cobra.Command{
	Use:   "delete <name>",
	Short: "Delete a registered cuisson project",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]

		mgr, err := project.NewManager()
		if err != nil {
			return fmt.Errorf("failed to create manager: %w", err)
		}

		if err := mgr.DeleteProject(name); err != nil {
			return fmt.Errorf("failed to delete project: %w", err)
		}

		fmt.Printf("[+] Deleted project %q\n", name)
		return nil
	},
}

// projectInfoCmd shows details about a registered project
var projectInfoCmd = &cobra.Command{
	Use:   "info <name>",
	Short: "Show details about a registered cuisson project",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name := args[0]

		mgr, err := project.NewManager()
		if err != nil {
			return fmt.Errorf("failed to create manager: %w", err)
		}

		info, err := mgr.Info(name)
		if err != nil {
			return fmt.Errorf("failed to get project info: %w", err)
		}

		fmt.Printf("  Name:        %s\n", info.Name)
		fmt.Printf("  Templates:   %s\n", info.TemplateDir)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(projectCmd)
	projectCmd.AddCommand(projectCreateCmd)
	projectCmd.AddCommand(projectListCmd)
	projectCmd.AddCommand(projectDeleteCmd)
	projectCmd.AddCommand(projectInfoCmd)

	projectCreateCmd.Flags().StringVarP(&projectName, "name", "n", "", "project name (auto-detected from package.json or directory if omitted)")
}
