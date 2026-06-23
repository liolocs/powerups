package render

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	"github.com/iancoleman/strcase"

	"cuisson/internal/discover"
)

// compositionNode represents a node in the recipe composition tree.
type compositionNode struct {
	Entry     discover.RecipeEntry
	Variables map[string]string
}

// ResolveCompositionTree is the exported version of resolveCompositionTree.
func ResolveCompositionTree(
	parentEntry discover.RecipeEntry,
	parentVars map[string]string,
	allRecipes map[string]discover.RecipeEntry,
) ([]compositionNode, error) {
	return resolveCompositionTree(parentEntry, parentVars, allRecipes)
}

// resolveCompositionTree walks the recipe composition tree in pre-order DFS,
// resolving child variables from parent variables via optional mapping.
func resolveCompositionTree(
	parentEntry discover.RecipeEntry,
	parentVars map[string]string,
	allRecipes map[string]discover.RecipeEntry,
) ([]compositionNode, error) {
	var nodes []compositionNode

	// Add parent node
	nodes = append(nodes, compositionNode{
		Entry:     parentEntry,
		Variables: parentVars,
	})

	// Process children if any
	for _, childDef := range parentEntry.Recipe.Extends {
		childEntry, exists := allRecipes[childDef.Recipe]
		if !exists {
			return nil, fmt.Errorf("unknown recipe %q referenced by %q", childDef.Recipe, parentEntry.Recipe.Name)
		}

		// Resolve child variables from parent variables
		childVars := make(map[string]string)
		varsToResolve := childDef.Variables
		if len(varsToResolve) == 0 {
			varsToResolve = childEntry.Recipe.Variables
		}

		for _, varName := range varsToResolve {
			parentVarName := varName
			// Map is parent→child: find which parent var maps to this child var
			if childDef.Map != nil {
				for pVar, cVar := range childDef.Map {
					if cVar == varName {
						parentVarName = pVar
						break
					}
				}
			}

			val, ok := parentVars[parentVarName]
			if !ok {
				return nil, fmt.Errorf("child %q requires variable %q, not available in parent", childDef.Recipe, varName)
			}

			childVars[varName] = val
		}

		// Recurse into child's children (pre-order)
		childNodes, err := resolveCompositionTree(childEntry, childVars, allRecipes)
		if err != nil {
			return nil, fmt.Errorf("resolving child %q: %w", childDef.Recipe, err)
		}

		nodes = append(nodes, childNodes...)
	}

	return nodes, nil
}

// FuncMap returns a template.FuncMap with strcase functions
func FuncMap() template.FuncMap {
	fm := template.FuncMap{
		"camelCase":  strcase.ToLowerCamel,
		"PascalCase": strcase.ToCamel,
		"snake_case": strcase.ToSnake,
		"kebabCase":  strcase.ToKebab,
		"split":      strings.Split,
		"trim":       strings.TrimSpace,
	}
	return fm
}

// RenderFile renders a template file with the given variables and writes to outputPath.
// Returns true if the file was actually written (false if it already existed and was skipped).
func RenderFile(recipeDir string, recipeFile discover.RecipeFile, variables map[string]string, outputDir string) (bool, error) {
	// Read template file
	templatePath := filepath.Join(recipeDir, recipeFile.Template)
	tmplContent, err := os.ReadFile(templatePath)
	if err != nil {
		return false, fmt.Errorf("failed to read template %s: %w", recipeFile.Template, err)
	}

	// Resolve output path (replace {{var}} patterns)
	outputPath := resolveOutputPath(recipeFile.OutputPath, variables)

	// Create template with strcase functions
	tmpl, err := template.New(recipeFile.Name).Funcs(FuncMap()).Parse(string(tmplContent))
	if err != nil {
		return false, fmt.Errorf("failed to parse template %s: %w", recipeFile.Template, err)
	}

	// Execute template
	var buf strings.Builder
	if err := tmpl.Execute(&buf, variables); err != nil {
		return false, fmt.Errorf("failed to execute template %s: %w", recipeFile.Template, err)
	}

	// Prepend project root if set
	if outputDir != "" {
		outputPath = filepath.Join(outputDir, outputPath)
	}

	// Ensure output directory exists
	oOutputDir := filepath.Dir(outputPath)
	if err := os.MkdirAll(oOutputDir, 0755); err != nil {
		return false, fmt.Errorf("failed to create output directory %s: %w", oOutputDir, err)
	}

	// Write file (skip if exists, like TS version)
	if _, err := os.Stat(outputPath); err == nil {
		fmt.Printf("[-] File %s already exists\n", outputPath)
		return false, nil
	}

	if err := os.WriteFile(outputPath, []byte(buf.String()), 0644); err != nil {
		return false, fmt.Errorf("failed to write %s: %w", outputPath, err)
	}

	fmt.Printf("[+] Created file %s\n", outputPath)
	return true, nil
}

// resolveOutputPath replaces {{var}} patterns in the output path with variable values
func resolveOutputPath(path string, variables map[string]string) string {
	result := path
	for key, value := range variables {
		result = strings.ReplaceAll(result, fmt.Sprintf("{{%s}}", key), value)
	}
	return result
}
