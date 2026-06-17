package recipegen

import (
	"encoding/json"
	"os"
	"strings"
	"testing"

	"cuisson/internal/detect"
	"cuisson/internal/patterns"
)

func TestInferIntent(t *testing.T) {
	g := &Generator{}

	t.Run("svelte component in ui directory", func(t *testing.T) {
		cluster := &patterns.Cluster{
			Files: []patterns.FilePattern{
				{Path: "frontend/src/lib/components/ui/button.svelte"},
				{Path: "frontend/src/lib/components/ui/input.svelte"},
			},
		}

		intents := g.inferIntent(cluster, nil)

		if !containsAny(intents, []string{"component", "ui component"}) {
			t.Errorf("Expected intent to contain 'component' or 'ui component', got: %v", intents)
		}

		if !containsAny(intents, []string{"shadcn-style"}) {
			t.Errorf("Expected intent to contain 'shadcn-style' for ui/ directory, got: %v", intents)
		}
	})

	t.Run("store with writable", func(t *testing.T) {
		tmpDir := t.TempDir()

		storeFile := tmpDir + "/user.ts"
		content := `import { writable } from 'svelte/store';
export const user = writable(null);`
		os.WriteFile(storeFile, []byte(content), 0644)

		cluster := &patterns.Cluster{
			Files: []patterns.FilePattern{
				{Path: storeFile},
			},
		}

		intents := g.inferIntent(cluster, nil)

		if !containsAny(intents, []string{"store", "state management"}) {
			t.Errorf("Expected intent to contain 'store' or 'state management', got: %v", intents)
		}
	})

	t.Run("barrel export", func(t *testing.T) {
		tmpDir := t.TempDir()

		indexFile := tmpDir + "/index.ts"
		content := `export { Button } from './button';
export { Input } from './input';`
		os.WriteFile(indexFile, []byte(content), 0644)

		cluster := &patterns.Cluster{
			Files: []patterns.FilePattern{
				{Path: indexFile},
			},
		}

		intents := g.inferIntent(cluster, nil)

		if !containsAny(intents, []string{"export barrel", "re-export"}) {
			t.Errorf("Expected intent to contain 'export barrel' or 're-export', got: %v", intents)
		}
	})

	t.Run("deduplicates intents", func(t *testing.T) {
		cluster := &patterns.Cluster{
			Files: []patterns.FilePattern{
				{Path: "frontend/src/lib/components/ui/button.svelte"},
				{Path: "frontend/src/lib/components/ui/input.svelte"},
			},
		}

		intents := g.inferIntent(cluster, nil)

		if len(intents) != len(deduplicate(intents)) {
			t.Errorf("Expected no duplicate intents, got: %v", intents)
		}
	})
}

func TestInferVariables(t *testing.T) {
	g := &Generator{}

	slots := []detect.Slot{
		{Name: "ComponentName"},
		{Name: "VariantType"},
		{Name: "ComponentName"}, // duplicate
	}

	variables := g.inferVariables(slots)

	if len(variables) != 2 {
		t.Errorf("Expected 2 variables, got %d", len(variables))
	}

	if variables[0] != "ComponentName" || variables[1] != "VariantType" {
		t.Errorf("Expected [ComponentName, VariantType], got: %v", variables)
	}
}

func TestBuildRecipeJSON(t *testing.T) {
	g := &Generator{}

	files := []patterns.RecipeFile{
		{Name: "button.svelte", Template: "button.svelte.tmpl", OutputPath: "src/{{ComponentName}}.svelte"},
	}

	data := g.buildRecipeJSON("ui-component", []string{"ComponentName"}, []string{"component", "ui"}, files)

	var recipe map[string]interface{}
	if err := json.Unmarshal(data, &recipe); err != nil {
		t.Fatalf("Failed to unmarshal recipe: %v", err)
	}

	if recipe["name"] != "ui-component" {
		t.Errorf("Recipe name = %v, want 'ui-component'", recipe["name"])
	}

	vars := recipe["variables"].([]interface{})
	if len(vars) != 1 || vars[0] != "ComponentName" {
		t.Errorf("Variables = %v, want ['ComponentName']", vars)
	}

	intent := recipe["intent"].([]interface{})
	if len(intent) != 2 {
		t.Errorf("Intent length = %d, want 2", len(intent))
	}

	output := recipe["output"].(map[string]interface{})
	outputFiles := output["files"].([]interface{})
	if len(outputFiles) != 1 {
		t.Errorf("Output files length = %d, want 1", len(outputFiles))
	}
}

func TestWriteTemplates(t *testing.T) {
	g := &Generator{}

	tmpDir := t.TempDir()

	skeletons := []detect.SkeletonResult{
		{TemplateFile: "button.svelte.tmpl", Template: "<div>{{ComponentName}}</div>"},
	}

	tmplFiles := g.writeTemplates(tmpDir, skeletons, "<div>{{ComponentName}}</div>")

	if len(tmplFiles) != 1 {
		t.Errorf("Expected 1 template file, got %d", len(tmplFiles))
	}

	content, err := os.ReadFile(tmplFiles[0])
	if err != nil {
		t.Fatalf("Failed to read template: %v", err)
	}

	if !strings.Contains(string(content), "{{ComponentName}}") {
		t.Errorf("Template content = %q, expected {{ComponentName}} placeholder", string(content))
	}
}

func TestGenerate(t *testing.T) {
	tmpDir := t.TempDir()

	// Create source files for the cluster
	srcDir := tmpDir + "/src"
	os.MkdirAll(srcDir, 0755)

	buttonFile := srcDir + "/button.svelte"
	inputFile := srcDir + "/input.svelte"

	buttonContent := `<script lang="ts">
  export let variant: "default" | "destructive";
</script>
<button class="btn {{variant}}">Button</button>`

	inputContent := `<script lang="ts">
  export let variant: "default" | "outline";
</script>
<input class="input {{variant}}" />`

	os.WriteFile(buttonFile, []byte(buttonContent), 0644)
	os.WriteFile(inputFile, []byte(inputContent), 0644)

	// Create patterns file
	pf := &patterns.PatternsFile{
		Version: 1,
		Project: "test",
		Clusters: []patterns.Cluster{
			{
				ID:          "ui-component-1",
				Name:        "ui-component",
				Confidence:  0.85,
				MemberCount: 2,
				Intent:      []string{"test"},
				Files: []patterns.FilePattern{
					{Path: buttonFile},
					{Path: inputFile},
				},
			},
		},
	}

	// Create templates directory
	templatesDir := tmpDir + "/templates"
	os.MkdirAll(templatesDir, 0755)

	g := &Generator{TemplatesDir: templatesDir}
	output, err := g.Generate(pf, "ui-component-1")

	if err != nil {
		t.Fatalf("Generate() error = %v", err)
	}

	if output.RecipePath == "" {
		t.Error("Expected non-empty RecipePath")
	}

	if !strings.Contains(output.RecipePath, "recipe.json") {
		t.Errorf("RecipePath = %q, expected to contain 'recipe.json'", output.RecipePath)
	}

	// Verify recipe.json exists and is valid JSON
	data, err := os.ReadFile(output.RecipePath)
	if err != nil {
		t.Fatalf("Failed to read generated recipe.json: %v", err)
	}

	var recipe map[string]interface{}
	if err := json.Unmarshal(data, &recipe); err != nil {
		t.Fatalf("Generated recipe.json is not valid JSON: %v", err)
	}

	if recipe["name"] != "ui-component" {
		t.Errorf("Recipe name = %v, want 'ui-component'", recipe["name"])
	}

	if _, ok := recipe["intent"]; !ok {
		t.Error("Expected 'intent' field in generated recipe")
	}

	if _, ok := recipe["variables"]; !ok {
		t.Error("Expected 'variables' field in generated recipe")
	}

	if len(output.TmplFiles) == 0 {
		t.Error("Expected at least one template file")
	}

	for _, tmplPath := range output.TmplFiles {
		if !strings.HasSuffix(tmplPath, ".tmpl") {
			t.Errorf("Template file %q should have .tmpl extension", tmplPath)
		}

		if _, err := os.Stat(tmplPath); os.IsNotExist(err) {
			t.Errorf("Template file %q does not exist", tmplPath)
		}
	}
}

func TestGenerateClusterNotFound(t *testing.T) {
	tmpDir := t.TempDir()

	pf := &patterns.PatternsFile{
		Version: 1,
		Project: "test",
		Clusters: []patterns.Cluster{
			{ID: "existing-cluster", Name: "existing"},
		},
	}

	g := &Generator{TemplatesDir: tmpDir + "/templates"}
	_, err := g.Generate(pf, "nonexistent-cluster")

	if err == nil {
		t.Error("Expected error for nonexistent cluster")
	}

	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("Error message = %q, expected 'not found'", err.Error())
	}

	if !strings.Contains(err.Error(), "existing-cluster") {
		t.Errorf("Error message should list available clusters, got: %q", err.Error())
	}
}

func TestDeduplicate(t *testing.T) {
	items := []string{"component", "ui component", "component", "shadcn-style"}

	result := deduplicate(items)

	if len(result) != 3 {
		t.Errorf("Expected 3 unique items, got %d", len(result))
	}

	if result[0] != "component" || result[1] != "ui component" || result[2] != "shadcn-style" {
		t.Errorf("Expected [component, ui component, shadcn-style], got: %v", result)
	}
}

func TestCollectFileTypes(t *testing.T) {
	g := &Generator{}

	cluster := &patterns.Cluster{
		Files: []patterns.FilePattern{
			{Path: "button.svelte"},
			{Path: "input.svelte"},
			{Path: "index.ts"},
		},
	}

	types := g.collectFileTypes(cluster)

	if len(types) != 2 {
		t.Errorf("Expected 2 file types, got %d: %v", len(types), types)
	}

	typeSet := make(map[string]bool)
	for _, t := range types {
		typeSet[t] = true
	}

	if !typeSet[".svelte"] || !typeSet[".ts"] {
		t.Errorf("Expected .svelte and .ts, got: %v", types)
	}
}

func TestExtractFilenamePatterns(t *testing.T) {
	g := &Generator{}

	cluster := &patterns.Cluster{
		Files: []patterns.FilePattern{
			{Path: "button.svelte"},
			{Path: "input.svelte"},
			{Path: "sheet-content.svelte"},
		},
	}

	patterns := g.extractFilenamePatterns(cluster)

	if len(patterns) != 3 {
		t.Errorf("Expected 3 filename patterns, got %d", len(patterns))
	}

	if !contains(patterns, "button") || !contains(patterns, "input") || !contains(patterns, "sheet-content") {
		t.Errorf("Expected [button, input, sheet-content], got: %v", patterns)
	}
}

func TestExtractDirectoryContext(t *testing.T) {
	g := &Generator{}

	cluster := &patterns.Cluster{
		Files: []patterns.FilePattern{
			{Path: "frontend/src/lib/components/ui/button.svelte"},
			{Path: "frontend/src/lib/components/ui/input.svelte"},
		},
	}

	context := g.extractDirectoryContext(cluster)

	if context != "frontend/src/lib/components/ui/" {
		t.Errorf("Directory context = %q, want 'frontend/src/lib/components/ui/'", context)
	}
}

// Helper functions

func contains(items []string, item string) bool {
	for _, i := range items {
		if i == item {
			return true
		}
	}
	return false
}

func containsAny(items []string, targets []string) bool {
	for _, target := range targets {
		if contains(items, target) {
			return true
		}
	}
	return false
}
