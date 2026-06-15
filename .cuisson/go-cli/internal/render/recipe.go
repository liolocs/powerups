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

// FuncMap returns a template.FuncMap with strcase functions
func FuncMap() template.FuncMap {
	fm := template.FuncMap{
		"camelCase":  strcase.ToLowerCamel,
		"PascalCase": strcase.ToCamel,
		"snake_case": strcase.ToSnake,
		"kebabCase":  strcase.ToKebab,
	}
	return fm
}

// RenderFile renders a template file with the given variables and writes to outputPath
func RenderFile(recipeDir string, recipeFile discover.RecipeFile, variables map[string]string) error {
	// Read template file
	templatePath := filepath.Join(recipeDir, recipeFile.Template)
	tmplContent, err := os.ReadFile(templatePath)
	if err != nil {
		return fmt.Errorf("failed to read template %s: %w", recipeFile.Template, err)
	}

	// Resolve output path (replace {{var}} patterns)
	outputPath := resolveOutputPath(recipeFile.OutputPath, variables)

	// Create template with strcase functions
	tmpl, err := template.New(recipeFile.Name).Funcs(FuncMap()).Parse(string(tmplContent))
	if err != nil {
		return fmt.Errorf("failed to parse template %s: %w", recipeFile.Template, err)
	}

	// Execute template
	var buf strings.Builder
	if err := tmpl.Execute(&buf, variables); err != nil {
		return fmt.Errorf("failed to execute template %s: %w", recipeFile.Template, err)
	}

	// Ensure output directory exists
	outputDir := filepath.Dir(outputPath)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory %s: %w", outputDir, err)
	}

	// Write file (skip if exists, like TS version)
	if _, err := os.Stat(outputPath); err == nil {
		fmt.Printf("[-] File %s already exists\n", outputPath)
		return nil
	}

	if err := os.WriteFile(outputPath, []byte(buf.String()), 0644); err != nil {
		return fmt.Errorf("failed to write %s: %w", outputPath, err)
	}

	fmt.Printf("[+] Created file %s\n", outputPath)
	return nil
}

// resolveOutputPath replaces {{var}} patterns in the output path with variable values
func resolveOutputPath(path string, variables map[string]string) string {
	result := path
	for key, value := range variables {
		result = strings.ReplaceAll(result, fmt.Sprintf("{{%s}}", key), value)
	}
	return result
}
