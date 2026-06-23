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

func TestResolveCompositionTree(t *testing.T) {
	// Create mock recipe entries
	allRecipes := map[string]discover.RecipeEntry{
		"new-component": {
			Recipe: discover.Recipe{
				Name:      "new-component",
				Variables: []string{"componentName"},
			},
		},
		"new-store": {
			Recipe: discover.Recipe{
				Name:      "new-store",
				Variables: []string{"storeName"},
			},
		},
	}

	parentEntry := discover.RecipeEntry{
		Recipe: discover.Recipe{
			Name:      "page",
			Variables: []string{"widgetName", "storeName"},
			Extends: []discover.RecipeChild{
				{
					Recipe:    "new-component",
					Variables: []string{"componentName"},
					Map:       map[string]string{"widgetName": "componentName"},
				},
				{
					Recipe:    "new-store",
					Variables: []string{"storeName"},
				},
			},
		},
	}

	parentVars := map[string]string{
		"widgetName":  "MyWidget",
		"storeName":   "CounterStore",
	}

	nodes, err := resolveCompositionTree(parentEntry, parentVars, allRecipes)
	if err != nil {
		t.Fatalf("resolveCompositionTree() error = %v", err)
	}

	if len(nodes) != 3 {
		t.Fatalf("nodes length = %d, want 3", len(nodes))
	}

	// Parent node first (pre-order)
	if nodes[0].Entry.Recipe.Name != "page" {
		t.Errorf("nodes[0] name = %q, want %q", nodes[0].Entry.Recipe.Name, "page")
	}

	// Child 1: new-component with mapped variable
	if nodes[1].Entry.Recipe.Name != "new-component" {
		t.Errorf("nodes[1] name = %q, want %q", nodes[1].Entry.Recipe.Name, "new-component")
	}
	if nodes[1].Variables["componentName"] != "MyWidget" {
		t.Errorf("nodes[1] variables = %v, want componentName=MyWidget", nodes[1].Variables)
	}

	// Child 2: new-store with direct variable (no mapping needed)
	if nodes[2].Entry.Recipe.Name != "new-store" {
		t.Errorf("nodes[2] name = %q, want %q", nodes[2].Entry.Recipe.Name, "new-store")
	}
	if nodes[2].Variables["storeName"] != "CounterStore" {
		t.Errorf("nodes[2] variables = %v, want storeName=CounterStore", nodes[2].Variables)
	}
}

func TestResolveCompositionTreeUnknownRecipe(t *testing.T) {
	allRecipes := map[string]discover.RecipeEntry{}

	parentEntry := discover.RecipeEntry{
		Recipe: discover.Recipe{
			Name: "page",
			Extends: []discover.RecipeChild{
				{Recipe: "nonexistent"},
			},
		},
	}

	parentVars := map[string]string{}

	_, err := resolveCompositionTree(parentEntry, parentVars, allRecipes)
	if err == nil {
		t.Fatal("expected error for unknown recipe")
	}

	expectedMsg := "unknown recipe \"nonexistent\" referenced by \"page\""
	if err.Error() != expectedMsg {
		t.Errorf("error = %q, want %q", err.Error(), expectedMsg)
	}
}

func TestResolveCompositionTreeMissingVariable(t *testing.T) {
	allRecipes := map[string]discover.RecipeEntry{
		"new-component": {
			Recipe: discover.Recipe{
				Name:      "new-component",
				Variables: []string{"componentName"},
			},
		},
	}

	parentEntry := discover.RecipeEntry{
		Recipe: discover.Recipe{
			Name:      "page",
			Variables: []string{"widgetName"},
			Extends: []discover.RecipeChild{
				{
					Recipe:    "new-component",
					Variables: []string{"componentName"},
					Map:       map[string]string{"widgetName": "componentName"},
				},
			},
		},
	}

	parentVars := map[string]string{
		"widgetName": "MyWidget",
	}

	nodes, err := resolveCompositionTree(parentEntry, parentVars, allRecipes)
	if err != nil {
		t.Fatalf("unexpected error = %v", err)
	}

	if len(nodes) != 2 {
		t.Fatalf("nodes length = %d, want 2", len(nodes))
	}

	if nodes[1].Variables["componentName"] != "MyWidget" {
		t.Errorf("nodes[1] variables = %v, want componentName=MyWidget", nodes[1].Variables)
	}

	// Now test missing variable: parent doesn't have the mapped var
	parentVars2 := map[string]string{
		"otherName": "value", // wrong name, no mapping will find it
	}

	parentEntry2 := discover.RecipeEntry{
		Recipe: discover.Recipe{
			Name:      "page",
			Variables: []string{"otherName"},
			Extends: []discover.RecipeChild{
				{
					Recipe:    "new-component",
					Variables: []string{"componentName"},
					Map:       map[string]string{"widgetName": "componentName"}, // widgetName not in parent vars
				},
			},
		},
	}

	_, err = resolveCompositionTree(parentEntry2, parentVars2, allRecipes)
	if err == nil {
		t.Fatal("expected error for missing variable")
	}

	expectedMsg := "child \"new-component\" requires variable \"componentName\", not available in parent"
	if err.Error() != expectedMsg {
		t.Errorf("error = %q, want %q", err.Error(), expectedMsg)
	}
}

func TestResolveCompositionTreeRecursive(t *testing.T) {
	allRecipes := map[string]discover.RecipeEntry{
		"base": {
			Recipe: discover.Recipe{
				Name:      "base",
				Variables: []string{"baseName"},
			},
		},
		"middle": {
			Recipe: discover.Recipe{
				Name:      "middle",
				Variables: []string{"midName"},
				Extends: []discover.RecipeChild{
					{
						Recipe:    "base",
						Variables: []string{"baseName"},
						Map:       map[string]string{"midName": "baseName"},
					},
				},
			},
		},
	}

	parentEntry := discover.RecipeEntry{
		Recipe: discover.Recipe{
			Name:      "top",
			Variables: []string{"midName"},
			Extends: []discover.RecipeChild{
				{
					Recipe:    "middle",
					Variables: []string{"midName"},
				},
			},
		},
	}

	parentVars := map[string]string{
		"midName": "MiddleValue",
	}

	nodes, err := resolveCompositionTree(parentEntry, parentVars, allRecipes)
	if err != nil {
		t.Fatalf("resolveCompositionTree() error = %v", err)
	}

	if len(nodes) != 3 {
		t.Fatalf("nodes length = %d, want 3", len(nodes))
	}

	if nodes[0].Entry.Recipe.Name != "top" {
		t.Errorf("nodes[0] = %q, want top", nodes[0].Entry.Recipe.Name)
	}

	if nodes[1].Entry.Recipe.Name != "middle" {
		t.Errorf("nodes[1] = %q, want middle", nodes[1].Entry.Recipe.Name)
	}

	if nodes[2].Entry.Recipe.Name != "base" {
		t.Errorf("nodes[2] = %q, want base", nodes[2].Entry.Recipe.Name)
	}

	if nodes[2].Variables["baseName"] != "MiddleValue" {
		t.Errorf("nodes[2] variables = %v, want baseName=MiddleValue", nodes[2].Variables)
	}
}

func TestCompositionEndToEnd(t *testing.T) {
	tmpDir := t.TempDir()

	// Create recipe directories
	componentDir := filepath.Join(tmpDir, "templates", "frontend", "src", "lib", "components", "new-component")
	storeDir := filepath.Join(tmpDir, "templates", "frontend", "src", "stores", "new-store")

	for _, dir := range []string{componentDir, storeDir} {
		if err := os.MkdirAll(dir, 0755); err != nil {
			t.Fatal(err)
		}
	}

	// Create new-component recipe.json and template
	componentRecipe := `{
  "name": "new-component",
  "variables": ["componentName"],
  "output": {
    "files": [
      {
        "name": "{{componentName}}.svelte",
        "template": "comp.svelte.tmpl",
        "outputPath": "frontend/src/lib/components/{{componentName}}/comp.svelte"
      }
    ]
  }
}`
	if err := os.WriteFile(filepath.Join(componentDir, "recipe.json"), []byte(componentRecipe), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(componentDir, "comp.svelte.tmpl"), []byte(`export const {{.componentName | PascalCase}} = { name: "{{.componentName}}" };`), 0644); err != nil {
		t.Fatal(err)
	}

	// Create new-store recipe.json and template
	storeRecipe := `{
  "name": "new-store",
  "variables": ["storeName"],
  "output": {
    "files": [
      {
        "name": "{{storeName}}.ts",
        "template": "store.ts.tmpl",
        "outputPath": "frontend/src/stores/{{storeName}}.ts"
      }
    ]
  }
}`
	if err := os.WriteFile(filepath.Join(storeDir, "recipe.json"), []byte(storeRecipe), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(storeDir, "store.ts.tmpl"), []byte(`import { writable } from "svelte/store";
export const {{.storeName}} = writable(null);`), 0644); err != nil {
		t.Fatal(err)
	}

	// Create page recipe with extends
	pageDir := filepath.Join(tmpDir, "templates", "frontend", "src", "pages", "page")
	if err := os.MkdirAll(pageDir, 0755); err != nil {
		t.Fatal(err)
	}

	pageRecipe := `{
  "name": "page",
  "variables": ["widgetName", "storeName"],
  "extends": [
    {
      "recipe": "new-component",
      "variables": ["componentName"],
      "map": {"widgetName": "componentName"}
    },
    {
      "recipe": "new-store",
      "variables": ["storeName"]
    }
  ],
  "output": {
    "files": [
      {
        "name": "page.svelte",
        "template": "page.svelte.tmpl",
        "outputPath": "frontend/src/pages/{{widgetName}}.svelte"
      }
    ]
  }
}`
	if err := os.WriteFile(filepath.Join(pageDir, "recipe.json"), []byte(pageRecipe), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(pageDir, "page.svelte.tmpl"), []byte(`<script>import {{.widgetName | PascalCase}} from "../lib/components/{{.widgetName}}/comp.svelte";</script><{{.widgetName | PascalCase}} />`), 0644); err != nil {
		t.Fatal(err)
	}

	// Discover recipes
	recipes, err := discover.DiscoverRecipes(filepath.Join(tmpDir, "templates"))
	if err != nil {
		t.Fatalf("discover error: %v", err)
	}

	pageEntry, exists := recipes["page"]
	if !exists {
		t.Fatal("page recipe not found")
	}

	// Resolve composition tree
	nodes, err := resolveCompositionTree(pageEntry, map[string]string{
		"widgetName":  "MyWidget",
		"storeName":   "CounterStore",
	}, recipes)
	if err != nil {
		t.Fatalf("resolveCompositionTree() error = %v", err)
	}

	if len(nodes) != 3 {
		t.Fatalf("nodes length = %d, want 3", len(nodes))
	}

	// Render all files from the composition tree
	outputDir := filepath.Join(tmpDir, "output")

	for _, node := range nodes {
		for _, rf := range node.Entry.Recipe.Output.Files {
			written, err := RenderFile(node.Entry.DirPath, rf, node.Variables, outputDir)
			if err != nil {
				t.Fatalf("RenderFile() error = %v", err)
			}
			if !written {
				t.Errorf("expected file to be written for %s", rf.Name)
			}
		}
	}

	// Verify all output files exist with correct content
	checkFile := func(path, expected string) {
		content, err := os.ReadFile(filepath.Join(outputDir, path))
		if err != nil {
			t.Fatalf("Failed to read %s: %v", path, err)
		}
		if string(content) != expected {
			t.Errorf("%s content = %q, want %q", path, string(content), expected)
		}
	}

	checkFile("frontend/src/pages/MyWidget.svelte", `<script>import MyWidget from "../lib/components/MyWidget/comp.svelte";</script><MyWidget />`)
	checkFile("frontend/src/lib/components/MyWidget/comp.svelte", `export const MyWidget = { name: "MyWidget" };`)
	// {{label}} is literal text — not a Go template variable, just Svelte syntax
	checkFile("frontend/src/stores/CounterStore.ts", `import { writable } from "svelte/store";
export const CounterStore = writable(null);`)
}
