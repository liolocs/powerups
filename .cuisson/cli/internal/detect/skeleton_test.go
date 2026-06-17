package detect

import (
	"os"
	"strings"
	"testing"
)

func TestInferSlotNameFromFilename(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"button", "ButtonName"},
		{"input", "InputName"},
		{"sheet-content", "SheetContentName"},
		{"user-store", "UserStoreName"},
		{"sidebar-menu-item", "SidebarMenuItemName"},
	}

	for _, tt := range tests {
		got := inferSlotNameFromFilename(tt.input)
		if got != tt.expected {
			t.Errorf("inferSlotNameFromFilename(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestInferSlotNameFromFilenameWithExtension(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"button.svelte", "ButtonName"},
		{"input.ts", "InputName"},
		{"user-store.ts", "UserStoreName"},
	}

	for _, tt := range tests {
		got := inferSlotNameFromFilename(tt.input)
		if got != tt.expected {
			t.Errorf("inferSlotNameFromFilename(%q) = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestAlignSkeletons(t *testing.T) {
	skeletons := []SkeletonResult{
		{
			Template:     "const {{ButtonName}} = () => {}",
			Slots:        []Slot{{Name: "ButtonName", InferredFrom: "filename"}},
			TemplateFile: "button.svelte.tmpl",
		},
		{
			Template:     "const {{InputName}} = () => {}",
			Slots:        []Slot{{Name: "InputName", InferredFrom: "filename"}},
			TemplateFile: "input.svelte.tmpl",
		},
	}

	template, slots := AlignSkeletons(skeletons)

	if template != skeletons[0].Template {
		t.Errorf("AlignSkeletons() template = %q, want %q", template, skeletons[0].Template)
	}

	if len(slots) != 2 {
		t.Errorf("AlignSkeletons() slots count = %d, want 2", len(slots))
	}

	slotNames := make(map[string]bool)
	for _, s := range slots {
		slotNames[s.Name] = true
	}

	if !slotNames["ButtonName"] || !slotNames["InputName"] {
		t.Errorf("AlignSkeletons() slots = %v, expected ButtonName and InputName", slots)
	}
}

func TestAlignSkeletonsEmpty(t *testing.T) {
	template, slots := AlignSkeletons([]SkeletonResult{})

	if template != "" {
		t.Errorf("AlignSkeletons() empty = %q, want empty string", template)
	}

	if slots != nil {
		t.Errorf("AlignSkeletons() empty slots = %v, want nil", slots)
	}
}

func TestExtractSingleSkeletonUnsupportedExt(t *testing.T) {
	_, err := extractSingleSkeleton("test.go", "package main")
	if err == nil {
		t.Error("Expected error for unsupported extension")
	}

	if !strings.Contains(err.Error(), "unsupported file extension") {
		t.Errorf("Error message = %q, expected 'unsupported file extension'", err.Error())
	}
}

func TestExtractSvelteSkeletonNoScript(t *testing.T) {
	content := `<div>Hello</div>`
	result, err := extractSvelteSkeleton(content, "test.svelte")
	if err != nil {
		t.Fatalf("Expected no error (fallback), got: %v", err)
	}

	if result == nil {
		t.Fatal("Expected non-nil result")
	}

	if !strings.Contains(result.TemplateFile, ".svelte.tmpl") {
		t.Errorf("Template file = %q, expected .svelte.tmpl suffix", result.TemplateFile)
	}

	if len(result.Slots) == 0 {
		t.Error("Expected at least one slot from filename fallback")
	}

	if result.Slots[0].InferredFrom != "filename" {
		t.Errorf("Slot inferred_from = %q, want 'filename'", result.Slots[0].InferredFrom)
	}
}

func TestExtractSvelteSkeletonWithScript(t *testing.T) {
	content := `<script lang="ts">
  export let variant: "default" | "destructive";
</script>
<button class="btn">Click me</button>`

	result, err := extractSvelteSkeleton(content, "test.svelte")
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if result == nil {
		t.Fatal("Expected non-nil result")
	}

	if !strings.Contains(result.TemplateFile, ".svelte.tmpl") {
		t.Errorf("Template file = %q, expected .svelte.tmpl suffix", result.TemplateFile)
	}

	if !result.HasScriptBlock {
		t.Error("Expected HasScriptBlock to be true")
	}

	if len(result.Slots) == 0 {
		t.Error("Expected at least one slot")
	}
}

func TestExtractTSSkeleton(t *testing.T) {
	content := `const Button = () => {};
export default Button;`

	result, err := extractTSSkeleton(content, "test.ts")
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if result == nil {
		t.Fatal("Expected non-nil result")
	}

	if !strings.Contains(result.TemplateFile, ".ts.tmpl") {
		t.Errorf("Template file = %q, expected .ts.tmpl suffix", result.TemplateFile)
	}

	if len(result.Slots) == 0 {
		t.Error("Expected at least one slot")
	}
}

func TestExtractSkeletons(t *testing.T) {
	tmpDir := t.TempDir()

	// Create test files
	fileA := tmpDir + "/button.svelte"
	fileB := tmpDir + "/input.svelte"

	contentA := `<script lang="ts">
  export let variant: "default" | "destructive";
</script>
<button class="btn {{variant}}">Button</button>`

	contentB := `<script lang="ts">
  export let variant: "default" | "outline";
</script>
<input class="input {{variant}}" />`

	if err := os.WriteFile(fileA, []byte(contentA), 0644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(fileB, []byte(contentB), 0644); err != nil {
		t.Fatal(err)
	}

	results, err := ExtractSkeletons("test-cluster", []string{fileA, fileB})
	if err != nil {
		t.Fatalf("ExtractSkeletons() error = %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("ExtractSkeletons() returned %d results, want 2", len(results))
	}

	for _, r := range results {
		if !strings.Contains(r.TemplateFile, ".svelte.tmpl") {
			t.Errorf("Template file = %q, expected .svelte.tmpl suffix", r.TemplateFile)
		}

		if !r.HasScriptBlock {
			t.Error("Expected HasScriptBlock to be true for Svelte files")
		}

		if len(r.Slots) == 0 {
			t.Error("Expected at least one slot for Svelte files")
		}
	}
}

func TestExtractSkeletonsMissingFile(t *testing.T) {
	_, err := ExtractSkeletons("test-cluster", []string{"/nonexistent/file.svelte"})
	if err == nil {
		t.Error("Expected error for missing file")
	}

	if !strings.Contains(err.Error(), "failed to read") {
		t.Errorf("Error message = %q, expected 'failed to read'", err.Error())
	}
}

func TestExtractSkeletonsMixedExtensions(t *testing.T) {
	tmpDir := t.TempDir()

	tsFile := tmpDir + "/store.ts"
	svelteFile := tmpDir + "/component.svelte"

	tsContent := `export const count = $state(0);`
	svelteContent := `<script>import { count } from './store.ts';</script><p>{count}</p>`

	os.WriteFile(tsFile, []byte(tsContent), 0644)
	os.WriteFile(svelteFile, []byte(svelteContent), 0644)

	results, err := ExtractSkeletons("mixed-cluster", []string{tsFile, svelteFile})
	if err != nil {
		t.Fatalf("ExtractSkeletons() error = %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("Expected 2 results, got %d", len(results))
	}

	if !strings.Contains(results[0].TemplateFile, ".ts.tmpl") {
		t.Errorf("First result template = %q, expected .ts.tmpl", results[0].TemplateFile)
	}

	if !strings.Contains(results[1].TemplateFile, ".svelte.tmpl") {
		t.Errorf("Second result template = %q, expected .svelte.tmpl", results[1].TemplateFile)
	}
}

func TestExtractSlotsFromAST(t *testing.T) {
	// When AST is nil, extractSlotsFromAST returns empty (no identifiers to collect)
	content := `const Button = () => {};`
	slots := extractSlotsFromAST(nil, []byte(content), "button")

	// Nil AST means no identifiers collected, so empty result
	if len(slots) != 0 {
		t.Errorf("Expected 0 slots for nil AST, got %d", len(slots))
	}
}

func TestCollectIdentifiersNilNode(t *testing.T) {
	var out []identInfo
	collectIdentifiers(nil, []byte("test"), &out)

	if len(out) != 0 {
		t.Errorf("Expected empty output for nil node, got %d identifiers", len(out))
	}
}

func TestExtractSingleSkeletonTSX(t *testing.T) {
	content := `export const Button = () => <button>Click</button>;`

	result, err := extractSingleSkeleton("test.tsx", content)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if result == nil {
		t.Fatal("Expected non-nil result")
	}

	if !strings.Contains(result.TemplateFile, ".ts.tmpl") {
		t.Errorf("Template file = %q, expected .ts.tmpl suffix", result.TemplateFile)
	}
}

func TestExtractSingleSkeletonJSX(t *testing.T) {
	content := `export const Button = () => <button>Click</button>;`

	result, err := extractSingleSkeleton("test.jsx", content)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if result == nil {
		t.Fatal("Expected non-nil result")
	}

	if !strings.Contains(result.TemplateFile, ".ts.tmpl") {
		t.Errorf("Template file = %q, expected .ts.tmpl suffix", result.TemplateFile)
	}
}
