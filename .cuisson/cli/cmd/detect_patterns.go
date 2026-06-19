package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"cuisson/internal/detect"
	"cuisson/internal/patterns"

	"github.com/spf13/cobra"
)

var detectThreshold float64
var detectMinClusterSize int
var detectRefine bool

// detectPatternsCmd is the "detect-patterns" subcommand
var detectPatternsCmd = &cobra.Command{
	Use:   "detect-patterns",
	Short: "Scan a project for repetitive file patterns and cluster them",
	Long: `Scans the output directory for repetitive file patterns, clusters similar files,
and writes results to ~/.cuisson/projects/<project-name>/patterns.json.

Pipeline:
  Phase 1 — Tokenization (always): strips comments, replaces literals with placeholders,
            generates token shingles for each file.
  Phase 2 — Clustering (always): computes Jaccard similarity between files, applies
            union-find with threshold cutoff to form clusters.
  Phase 3 — Skeleton extraction (only with --refine): lazily loads tree-sitter WASM
            grammars to parse ASTs, aligns structurally equivalent nodes, marks divergent
            positions as slots.

Output is written to ~/.cuisson/projects/<project-name>/patterns.json and a summary is printed
to stdout.`,
	Args: cobra.NoArgs,
	RunE: func(cmd *cobra.Command, args []string) error {
		// outputDir is resolved in root.go PersistentPreRun from CUISSON_OUTPUT_DIR
		// or auto-discovered from cuisson.config.json

		// Resolve project name from config or cwd
		projectName, err := resolveProjectName()
		if err != nil {
			return fmt.Errorf("failed to resolve project name: %w", err)
		}

		// Phase 1: Tokenization — collect files and tokenize
		files, err := collectFiles(outputDir)
		if err != nil {
			return fmt.Errorf("failed to collect files: %w", err)
		}

		if len(files) == 0 {
			fmt.Println("No supported files found in", outputDir)
			return nil
		}

		fmt.Printf("Tokenizing %d files...\n", len(files))

		var members []detect.ClusterMember
		for _, path := range files {
			content, err := os.ReadFile(path)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Warning: failed to read %s: %v\n", path, err)
				continue
			}

			_, shingles := detect.TokenizeFile(string(content), path)
			members = append(members, detect.ClusterMember{
				Path:     path,
				Shingles: shingles,
			})
		}

		if len(members) == 0 {
			fmt.Println("No files could be tokenized")
			return nil
		}

		// Phase 2: Clustering
		fmt.Printf("Clustering with threshold %.2f, min cluster size %d...\n", detectThreshold, detectMinClusterSize)
		clusters := detect.ClusterByJaccard(members, detectThreshold, detectMinClusterSize)

		if len(clusters) == 0 {
			fmt.Println("No patterns detected (try lowering --threshold)")
			return nil
		}

		fmt.Printf("Detected %d pattern clusters\n", len(clusters))

		// Phase 3: Skeleton extraction (only with --refine)
		var patternClusters []patterns.Cluster
		for _, cluster := range clusters {
			pc := patterns.Cluster{
				ID:          cluster.ID,
				Name:        cluster.Name,
				Confidence:  cluster.Confidence,
				MemberCount: len(cluster.Members),
			}

			if detectRefine {
				fmt.Printf("  Refining cluster %q with tree-sitter...\n", pc.Name)
				var filePaths []string
				for _, m := range cluster.Members {
					filePaths = append(filePaths, m.Path)
				}

				skeletons, err := detect.ExtractSkeletons(cluster.ID, filePaths)
				if err != nil {
					fmt.Fprintf(os.Stderr, "  Warning: skeleton extraction failed for %q: %v\n", pc.Name, err)
					// Continue without refinement data
				} else {
					for i, skel := range skeletons {
						if i < len(cluster.Members) {
							// Convert detect.Slot to patterns.Slot
							patternSlots := make([]patterns.Slot, len(skel.Slots))
							for j, s := range skel.Slots {
								patternSlots[j] = patterns.Slot{
									Name:         s.Name,
									Positions:    s.Positions,
									InferredFrom: s.InferredFrom,
								}
							}
							filePattern := patterns.FilePattern{
								Path:             cluster.Members[i].Path,
								SkeletonTemplate: skel.TemplateFile,
								Slots:            patternSlots,
							}
							pc.Files = append(pc.Files, filePattern)
						}
					}

					// Infer intent from cluster analysis
					pc.Intent = inferIntentFromCluster(&cluster, skeletons)
				}
			} else {
				// Token-level intent inference (lighter)
				pc.Intent = inferTokenIntentFromCluster(&cluster)

				// Add file patterns without skeleton data
				for _, m := range cluster.Members {
					pc.Files = append(pc.Files, patterns.FilePattern{
						Path: m.Path,
					})
				}
			}

			patternClusters = append(patternClusters, pc)
		}

		// Phase 4: Output — write patterns.json
		pf := &patterns.PatternsFile{
			Version:    1,
			Project:    projectName,
			DetectedAt: patternsFileDetectedAt(),
			Clusters:   patternClusters,
		}

		if err := patterns.Write(projectName, pf); err != nil {
			return fmt.Errorf("failed to write patterns.json: %w", err)
		}

		// Print summary to stdout
		printSummary(clusters, outputDir)

		return nil
	},
}

func init() {
	rootCmd.AddCommand(detectPatternsCmd)
	detectPatternsCmd.Flags().Float64VarP(&detectThreshold, "threshold", "", 0.7, "Jaccard similarity threshold for clustering (0-1)")
	detectPatternsCmd.Flags().IntVarP(&detectMinClusterSize, "min-cluster-size", "m", 2, "Minimum files per cluster to report")
	detectPatternsCmd.Flags().BoolVarP(&detectRefine, "refine", "r", false, "Enable tree-sitter refinement for higher precision")
}

// collectFiles walks the output directory and returns files with supported extensions.
func collectFiles(rootDir string) ([]string, error) {
	var files []string

	err := filepath.Walk(rootDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(path))
		if detect.SupportedExtensions[ext] {
			files = append(files, path)
		}

		return nil
	})

	return files, err
}

// inferIntentFromCluster generates intent strings from cluster analysis with skeleton data.
func inferIntentFromCluster(cluster *detect.ClusterResult, skeletons []detect.SkeletonResult) []string {
	var intents []string

	// File type keywords
	fileTypes := make(map[string]bool)
	for _, m := range cluster.Members {
		ext := strings.ToLower(filepath.Ext(m.Path))
		fileTypes[ext] = true
	}

	for ext := range fileTypes {
		switch ext {
		case ".svelte":
			intents = append(intents, "component")
		case ".ts":
			intents = append(intents, "typescript module")
		case ".js":
			intents = append(intents, "javascript module")
		}
	}

	// Directory context
	if len(cluster.Members) > 0 {
		dir := filepath.Dir(cluster.Members[0].Path)
		if strings.Contains(dir, "components/ui/") {
			intents = append(intents, "ui component")
			intents = append(intents, "shadcn-style")
		} else if strings.Contains(dir, "components/") {
			intents = append(intents, "ui component")
		} else if strings.Contains(dir, "stores/") {
			intents = append(intents, "store")
		}
	}

	// Filename patterns
	filenameSet := make(map[string]bool)
	for _, m := range cluster.Members {
		base := filepath.Base(m.Path)
		ext := filepath.Ext(base)
		name := strings.TrimSuffix(base, ext)
		filenameSet[name] = true
	}

	for name := range filenameSet {
		intents = append(intents, name)
	}

	// Structural patterns from skeletons
	for _, skel := range skeletons {
		if skel.HasScriptBlock && len(skel.Slots) > 0 {
			intents = append(intents, "base component")
		}
	}

	return deduplicateStrings(intents)
}

// inferTokenIntentFromCluster generates intent strings from token-level analysis only.
func inferTokenIntentFromCluster(cluster *detect.ClusterResult) []string {
	var intents []string

	// File type keywords
	for _, m := range cluster.Members {
		ext := strings.ToLower(filepath.Ext(m.Path))
		switch ext {
		case ".svelte":
			intents = append(intents, "component")
		case ".ts":
			intents = append(intents, "typescript module")
		case ".js":
			intents = append(intents, "javascript module")
		}
	}

	// Filename patterns
	for _, m := range cluster.Members {
		base := filepath.Base(m.Path)
		ext := filepath.Ext(base)
		name := strings.TrimSuffix(base, ext)
		intents = append(intents, name)
	}

	return deduplicateStrings(intents)
}

// printSummary prints a human-readable summary of detected clusters.
func printSummary(clusters []detect.ClusterResult, outputDir string) {
	fmt.Printf("\nDetected %d pattern clusters in %s (threshold: %.2f):\n", len(clusters), outputDir, detectThreshold)

	for i, cluster := range clusters {
		fmt.Printf("\n[%s] %q — confidence: %.2f (%d files)\n", cluster.ID, cluster.Name, cluster.Confidence, len(cluster.Members))

		for j, m := range cluster.Members {
			if j >= 10 {
				fmt.Printf("  ... (%d more files)\n", len(cluster.Members)-10)
				break
			}
			fmt.Printf("  - %s\n", m.Path)
		}

		if i < len(clusters)-1 {
			fmt.Println()
		}
	}

	// Determine patterns.json path for display
	home, _ := os.UserHomeDir()
	projectName := "unknown"
	if len(clusters) > 0 {
		// Extract project name from output dir or use a default
		parts := strings.Split(outputDir, string(filepath.Separator))
		if len(parts) > 0 {
			projectName = parts[len(parts)-1]
		}
	}

	patternsPath := filepath.Join(home, ".cuisson", "projects", projectName, "patterns.json")
	fmt.Printf("\nResults written to %s\n", patternsPath)
}

// resolveProjectName finds the project name from cuisson.config.json.
func resolveProjectName() (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "default-project", nil // fallback
	}

	dir := cwd
	for {
		configPath := filepath.Join(dir, "cuisson.config.json")
		data, err := os.ReadFile(configPath)
		if err == nil {
			var cfg struct{ Name string }
			if json.Unmarshal(data, &cfg) == nil && cfg.Name != "" {
				return cfg.Name, nil
			}
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "default-project", nil
}

// patternsFileDetectedAt returns the current time for the patterns file.
func patternsFileDetectedAt() time.Time {
	return time.Now().UTC()
}

// deduplicateStrings removes duplicate strings while preserving order.
func deduplicateStrings(items []string) []string {
	seen := make(map[string]bool)
	var result []string
	for _, item := range items {
		if !seen[item] {
			seen[item] = true
			result = append(result, item)
		}
	}
	return result
}
