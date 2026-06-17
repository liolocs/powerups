package recipegen

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"cuisson/internal/detect"
	"cuisson/internal/patterns"
)

// Generator produces recipe files (recipe.json + .tmpl) from a detected cluster.
type Generator struct {
	TemplatesDir string // base directory for writing recipes (e.g., "templates/")
}

// RecipeOutput is the generated recipe directory structure.
type RecipeOutput struct {
	RecipePath string   // path to the generated recipe.json
	TmplFiles  []string // paths to generated .tmpl files
}

// Generate reads a cluster from patterns and writes recipe.json + .tmpl files.
func (g *Generator) Generate(pf *patterns.PatternsFile, clusterID string) (*RecipeOutput, error) {
	cluster, err := findCluster(pf, clusterID)
	if err != nil {
		return nil, err
	}

	// Generate skeleton templates for each file in the cluster
	skeletons, err := detect.ExtractSkeletons(clusterID, g.filePathsFromCluster(cluster))
	if err != nil {
		return nil, fmt.Errorf("failed to extract skeletons: %w", err)
	}

	// Align skeletons to find a unified template (or separate templates per variant)
	unifiedTemplate, allSlots := detect.AlignSkeletons(skeletons)

	// Infer intent strings from cluster analysis
	intentStrings := g.inferIntent(cluster, skeletons)

	// Infer variable names from slots
	variables := g.inferVariables(allSlots)

	// Determine output file paths from cluster member paths
	outputFiles := g.generateOutputFiles(skeletons, variables)

	// Create recipe directory
	recipeDir := filepath.Join(g.TemplatesDir, cluster.Name)
	if err := os.MkdirAll(recipeDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create recipe directory %s: %w", recipeDir, err)
	}

	// Write recipe.json
	recipe := g.buildRecipeJSON(cluster.Name, variables, intentStrings, outputFiles)
	recipePath := filepath.Join(recipeDir, "recipe.json")
	if err := os.WriteFile(recipePath, recipe, 0644); err != nil {
		return nil, fmt.Errorf("failed to write recipe.json: %w", err)
	}

	// Write .tmpl files (one per unique skeleton variant, or one unified template)
	tmplFiles := g.writeTemplates(recipeDir, skeletons, unifiedTemplate)

	return &RecipeOutput{
		RecipePath: recipePath,
		TmplFiles:  tmplFiles,
	}, nil
}

// findCluster locates a cluster by ID in the patterns file.
func findCluster(pf *patterns.PatternsFile, clusterID string) (*patterns.Cluster, error) {
	for _, c := range pf.Clusters {
		if c.ID == clusterID {
			return &c, nil
		}
	}

	// List available clusters for error message
	var available []string
	for _, c := range pf.Clusters {
		available = append(available, c.ID)
	}

	return nil, fmt.Errorf("cluster %q not found. Available clusters: %v", clusterID, available)
}

// filePathsFromCluster extracts file paths from a cluster.
func (g *Generator) filePathsFromCluster(cluster *patterns.Cluster) []string {
	var paths []string
	for _, f := range cluster.Files {
		paths = append(paths, f.Path)
	}
	return paths
}

// inferIntent generates intent strings from cluster analysis.
func (g *Generator) inferIntent(cluster *patterns.Cluster, skeletons []detect.SkeletonResult) []string {
	var intents []string

	// Rule 1: File type keywords
	fileTypes := g.collectFileTypes(cluster)
	for _, ft := range fileTypes {
		switch ft {
		case ".svelte":
			intents = append(intents, "component")
		case ".ts":
			if g.hasWritableOrDerived(cluster) {
				intents = append(intents, "store")
				intents = append(intents, "state management")
			} else if g.hasFetch(cluster) {
				intents = append(intents, "api service")
			} else if g.isBarrelExport(cluster) {
				intents = append(intents, "export barrel")
				intents = append(intents, "re-export")
			} else {
				intents = append(intents, "typescript module")
			}
		case ".js":
			intents = append(intents, "javascript module")
		}
	}

	// Rule 2: Directory context
	dirContext := g.extractDirectoryContext(cluster)
	switch {
	case strings.Contains(dirContext, "components/ui/"):
		intents = append(intents, "ui component")
		intents = append(intents, "shadcn-style")
	case strings.Contains(dirContext, "components/"):
		intents = append(intents, "ui component")
	case strings.Contains(dirContext, "stores/"):
		if !g.hasWritableOrDerived(cluster) {
			intents = append(intents, "store")
		}
	case strings.Contains(dirContext, "lib/"):
		intents = append(intents, "library module")
	}

	if dirContext != "" {
		intents = append(intents, strings.ReplaceAll(dirContext, "/", " "))
	}

	// Rule 3: Filename patterns
	filenamePatterns := g.extractFilenamePatterns(cluster)
	if len(filenamePatterns) > 0 {
		intents = append(intents, strings.Join(filenamePatterns, " "))
	}

	// Rule 4: Structural patterns (from skeleton analysis)
	if len(skeletons) > 0 {
		for _, skel := range skeletons {
			if skel.HasScriptBlock && len(skel.Slots) > 0 {
				intents = append(intents, "base component")
				intents = append(intents, "composable")
			}
		}
	}

	// Deduplicate while preserving order
	return deduplicate(intents)
}

// collectFileTypes returns the set of file extensions in a cluster.
func (g *Generator) collectFileTypes(cluster *patterns.Cluster) []string {
	seen := make(map[string]bool)
	var types []string
	for _, f := range cluster.Files {
		ext := strings.ToLower(filepath.Ext(f.Path))
		if !seen[ext] {
			seen[ext] = true
			types = append(types, ext)
		}
	}
	return types
}

// hasWritableOrDerived checks if any file contains writable or derived keywords.
func (g *Generator) hasWritableOrDerived(cluster *patterns.Cluster) bool {
	for _, f := range cluster.Files {
		content, err := os.ReadFile(f.Path)
		if err != nil {
			continue
		}
		lower := strings.ToLower(string(content))
		if strings.Contains(lower, "writable") || strings.Contains(lower, "derived") {
			return true
		}
	}
	return false
}

// hasFetch checks if any file contains fetch keywords.
func (g *Generator) hasFetch(cluster *patterns.Cluster) bool {
	for _, f := range cluster.Files {
		content, err := os.ReadFile(f.Path)
		if err != nil {
			continue
		}
		lower := strings.ToLower(string(content))
		if strings.Contains(lower, "fetch") {
			return true
		}
	}
	return false
}

// isBarrelExport checks if all files are barrel exports (index.ts with only re-exports).
func (g *Generator) isBarrelExport(cluster *patterns.Cluster) bool {
	for _, f := range cluster.Files {
		if filepath.Base(f.Path) != "index.ts" {
			return false
		}
		content, err := os.ReadFile(f.Path)
		if err != nil {
			return false
		}
		lower := strings.ToLower(string(content))
		if !strings.Contains(lower, "export") {
			return false
		}
	}
	return true
}

// extractDirectoryContext derives the directory context from file paths.
func (g *Generator) extractDirectoryContext(cluster *patterns.Cluster) string {
	if len(cluster.Files) == 0 {
		return ""
	}

	// Get the directory of the first file, relative to common prefix
	firstPath := cluster.Files[0].Path

	// Find common directory prefix across all files
	dirPrefix := filepath.Dir(firstPath)
	for _, f := range cluster.Files[1:] {
		common := filepath.Dir(f.Path)
		for !strings.HasPrefix(common, dirPrefix) && len(dirPrefix) > 0 {
			dirPrefix = filepath.Dir(dirPrefix)
		}
	}

	return dirPrefix + "/"
}

// extractFilenamePatterns extracts the varying parts of filenames.
func (g *Generator) extractFilenamePatterns(cluster *patterns.Cluster) []string {
	var names []string
	for _, f := range cluster.Files {
		base := filepath.Base(f.Path)
		ext := filepath.Ext(base)
		name := strings.TrimSuffix(base, ext)
		names = append(names, name)
	}

	// Return the varying parts (the names themselves are the pattern indicators)
	return deduplicate(names)
}

// inferVariables extracts variable names from slot information.
func (g *Generator) inferVariables(slots []detect.Slot) []string {
	var variables []string
	seen := make(map[string]bool)

	for _, slot := range slots {
		if !seen[slot.Name] {
			seen[slot.Name] = true
			variables = append(variables, slot.Name)
		}
	}

	return variables
}

// generateOutputFiles creates output file specifications from skeletons.
func (g *Generator) generateOutputFiles(skeletons []detect.SkeletonResult, variables []string) []patterns.RecipeFile {
	var files []patterns.RecipeFile

	for i, skel := range skeletons {
		// Use the first skeleton's template name as the base
		tmplName := skel.TemplateFile
		if i > 0 {
			// For additional skeletons, add a variant suffix
			tmplName = fmt.Sprintf("variant%d_%s", i, skel.TemplateFile)
		}

		// Derive output path from the skeleton template name
		outputPath := strings.TrimSuffix(skel.TemplateFile, ".tmpl")

		files = append(files, patterns.RecipeFile{
			Name:       outputPath,
			Template:   tmplName,
			OutputPath: outputPath,
		})
	}

	return files
}

// buildRecipeJSON creates the recipe.json content.
func (g *Generator) buildRecipeJSON(name string, variables []string, intent []string, files []patterns.RecipeFile) []byte {
	recipe := struct {
		Name      string                  `json:"name"`
		Variables []string                `json:"variables"`
		Intent    []string                `json:"intent"`
		Output    patterns.Output         `json:"output"`
	}{
		Name:      name,
		Variables: variables,
		Intent:    intent,
		Output: patterns.Output{
			Files: files,
		},
	}

	data, err := json.MarshalIndent(recipe, "", "  ")
	if err != nil {
		panic(fmt.Sprintf("failed to marshal recipe: %v", err))
	}

	return append(data, '\n')
}

// writeTemplates writes .tmpl files to the recipe directory.
func (g *Generator) writeTemplates(recipeDir string, skeletons []detect.SkeletonResult, unifiedTemplate string) []string {
	var tmplFiles []string

	// Write the first skeleton as the primary template
	if len(skeletons) > 0 {
		tmplPath := filepath.Join(recipeDir, skeletons[0].TemplateFile)
		if err := os.WriteFile(tmplPath, []byte(unifiedTemplate), 0644); err != nil {
			fmt.Fprintf(os.Stderr, "Warning: failed to write template %s: %v\n", tmplPath, err)
		} else {
			tmplFiles = append(tmplFiles, tmplPath)
		}

		// Write additional variant templates if they differ significantly
		for i := 1; i < len(skeletons); i++ {
			if skeletons[i].Template != unifiedTemplate {
				variantPath := filepath.Join(recipeDir, skeletons[i].TemplateFile)
				if err := os.WriteFile(variantPath, []byte(skeletons[i].Template), 0644); err != nil {
					fmt.Fprintf(os.Stderr, "Warning: failed to write variant template %s: %v\n", variantPath, err)
				} else {
					tmplFiles = append(tmplFiles, variantPath)
				}
			}
		}
	}

	return tmplFiles
}

// deduplicate removes duplicate strings while preserving order.
func deduplicate(items []string) []string {
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
