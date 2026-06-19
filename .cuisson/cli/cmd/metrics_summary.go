package cmd

import (
	"fmt"
	"os"
	"text/tabwriter"

	"cuisson/internal/metrics"

	"github.com/spf13/cobra"
)

var metricsProject string

// metricsSummaryCmd is the "metrics summary" subcommand
var metricsSummaryCmd = &cobra.Command{
	Use:   "summary",
	Short: "Show aggregated metrics from cuisson launches",
	Long: `Display a summary table of all recorded cuisson launch metrics.

Shows per-recipe statistics including number of launches, input characters,
output characters, files written, and estimated tokens saved.

If --project is specified, shows metrics for that project only.
Otherwise, discovers all projects with recorded metrics and shows them grouped.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		mgr, err := metrics.NewManager()
		if err != nil {
			return fmt.Errorf("failed to create metrics manager: %w", err)
		}

		if metricsProject != "" {
			return showSingleProject(mgr, metricsProject)
		}

		return showAllProjects(mgr)
	},
}

func init() {
	metricsCmd.AddCommand(metricsSummaryCmd)
	metricsSummaryCmd.Flags().StringVarP(&metricsProject, "project", "p", "", "project name to show metrics for")
}

func showSingleProject(mgr *metrics.Manager, projectName string) error {
	stats, total, err := mgr.Aggregate(projectName)
	if err != nil {
		return fmt.Errorf("failed to aggregate metrics: %w", err)
	}

	fmt.Printf("Cuisson Metrics — %s\n", projectName)
	printTable(stats, total)

	return nil
}

func showAllProjects(mgr *metrics.Manager) error {
	projects, err := mgr.DiscoverProjects()
	if err != nil {
		return fmt.Errorf("failed to discover projects: %w", err)
	}

	if len(projects) == 0 {
		fmt.Println("No metrics recorded yet. Launch some recipes to get started.")
		return nil
	}

	for i, name := range projects {
		stats, total, err := mgr.Aggregate(name)
		if err != nil {
			fmt.Fprintf(os.Stderr, "⚠ Skipping project %q: %v\n", name, err)
			continue
		}

		if i > 0 {
			fmt.Println()
		}
		fmt.Printf("Cuisson Metrics — %s\n", name)
		printTable(stats, total)
	}

	return nil
}

func printTable(stats []metrics.RecipeStat, total metrics.TotalStat) {
	w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "Recipe\tLaunches\tInput Chars\tOutput Chars\tEst Tokens Saved")
	fmt.Fprintln(w, "------\t--------\t-----------\t------------\t----------------")

	for _, s := range stats {
		fmt.Fprintf(w, "%s\t%d\t%d\t%d\t~%d\n",
			s.Recipe, s.Launches, s.InputChars, s.OutputChars, estTokensSaved(s.OutputChars))
	}

	fmt.Fprintln(w, "------\t--------\t-----------\t------------\t----------------")
	fmt.Fprintf(w, "%s\t%d\t%d\t%d\t~%d\n",
		"Total", total.Launches, total.InputChars, total.OutputChars, estTokensSaved(total.OutputChars))
	fmt.Fprintln(w)
	fmt.Fprintln(os.Stderr, "Est Tokens Saved = Output Chars / 4 (rough approximation)")
	w.Flush()
}

func estTokensSaved(chars int) int {
	return chars / 4
}
