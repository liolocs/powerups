package render

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"cuisson/internal/discover"
)

func TestRenderFile(t *testing.T) {
	// Create temp directory structure
	tmpDir := t.TempDir()

	// Create a recipe directory with template and recipe.json
	recipeDir := filepath.Join(tmpDir, "test-recipe")
	if err := os.MkdirAll(recipeDir, 0755); err != nil {
		t.Fatal(err)
	}

	// Create template file
	tmplContent := `Hello {{.name}}!`
	if err := os.WriteFile(filepath.Join(recipeDir, "greeting.tmpl"), []byte(tmplContent), 0644); err != nil {
		t.Fatal(err)
	}

	// Create recipe.json
	recipeJSON := `{
  "name": "test-recipe",
  "variables": ["name"],
  "output": {
    "files": [
      {
        "name": "greeting",
        "template": "greeting.tmpl",
        "outputPath": "{{name}}.txt"
      }
    ]
  }
}`
	if err := os.WriteFile(filepath.Join(recipeDir, "recipe.json"), []byte(recipeJSON), 0644); err != nil {
		t.Fatal(err)
	}

	// Parse recipe
	var recipe discover.Recipe
	if err := json.Unmarshal([]byte(recipeJSON), &recipe); err != nil {
		t.Fatal(err)
	}

	variables := map[string]string{"name": "World"}

	// Render the file
	outputPath := filepath.Join(tmpDir, "output")
	if err := os.MkdirAll(outputPath, 0755); err != nil {
		t.Fatal(err)
	}

	// Override output path to use temp dir
	recipe.Output.Files[0].OutputPath = filepath.Join(outputPath, "{{name}}.txt")

	written, err := RenderFile(recipeDir, recipe.Output.Files[0], variables, "")
	if err != nil {
		t.Fatalf("RenderFile() error = %v", err)
	}
	if !written {
		t.Error("RenderFile() should return true when file is written")
	}

	// Verify output file exists and has correct content
	content, err := os.ReadFile(filepath.Join(outputPath, "World.txt"))
	if err != nil {
		t.Fatalf("Failed to read output file: %v", err)
	}

	if string(content) != "Hello World!" {
		t.Errorf("RenderFile() content = %q, want %q", string(content), "Hello World!")
	}

	// Test that existing file is skipped
	written, err = RenderFile(recipeDir, recipe.Output.Files[0], variables, "")
	if err != nil {
		t.Fatalf("RenderFile() on existing file error = %v", err)
	}
	if written {
		t.Error("RenderFile() should return false when file already exists")
	}

	exists, _ := os.Stat(filepath.Join(outputPath, "World.txt"))
	if exists == nil {
		t.Error("Output file should still exist after skip")
	}
}

func TestFuncMap(t *testing.T) {
	fm := FuncMap()

	tests := []struct {
		input    string
		expected string
		fn       string
	}{
		{"myComponent", "myComponent", "camelCase"},
		{"myComponent", "MyComponent", "PascalCase"},
		{"myComponent", "my_component", "snake_case"},
		{"myComponent", "my-component", "kebabCase"},
	}

	for _, tt := range tests {
		t.Run(tt.fn, func(t *testing.T) {
			fn := fm[tt.fn]
			if fn == nil {
				t.Fatalf("Function %q not found in FuncMap", tt.fn)
			}
			result := fn.(func(string) string)(tt.input)
			if result != tt.expected {
				t.Errorf("%s(%q) = %q, want %q", tt.fn, tt.input, result, tt.expected)
			}
		})
	}
}

func TestResolveOutputPath(t *testing.T) {
	variables := map[string]string{
		"componentName": "MyComponent",
	}

	tests := []struct {
		input    string
		expected string
	}{
		{
			input:    "frontend/src/{{componentName}}/index.ts",
			expected: "frontend/src/MyComponent/index.ts",
		},
		{
			input:    "{{componentName}}.ts",
			expected: "MyComponent.ts",
		},
	}

	for _, tt := range tests {
		result := resolveOutputPath(tt.input, variables)
		if result != tt.expected {
			t.Errorf("resolveOutputPath(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}

	// Test with multiple variables
	multiVars := map[string]string{
		"componentName": "MyComponent",
		"storeName":     "CounterStore",
	}
	result := resolveOutputPath("src/{{componentName}}/stores/{{storeName}}.ts", multiVars)
	expected := "src/MyComponent/stores/CounterStore.ts"
	if result != expected {
		t.Errorf("resolveOutputPath(%q) = %q, want %q", "src/{{componentName}}/stores/{{storeName}}.ts", result, expected)
	}
}
