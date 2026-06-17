package detect

import (
	"reflect"
	"testing"
)

func TestStripComments(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "single-line comment",
			input:    "const x = 1; // this is a comment\nreturn x",
			expected: "const x = 1; \nreturn x",
		},
		{
			name:     "multi-line comment",
			input:    "const x = 1; /* multi\nline */ return x",
			expected: "const x = 1;   return x",
		},
		{
			name:     "comment inside string preserved",
			input:    `const s = "// not a comment";`,
			expected: `const s = "// not a comment";`,
		},
		{
			name:     "nested comment-like in string",
			input:    `const s = "/* not a start */"; const x = 1; /* real comment */`,
			expected: `const s = "/* not a start */"; const x = 1;  `,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := stripComments(tt.input)
			if got != tt.expected {
				t.Errorf("stripComments() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestReplaceLiterals(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "string literal",
			input:    `const s = "hello";`,
			expected: `const s = __STR__;`,
		},
		{
			name:     "number literal",
			input:    `const n = 42;`,
			expected: `const n = __NUM__;`,
		},
		{
			name:     "float literal",
			input:    `const f = 3.14;`,
			expected: `const f = __NUM__;`,
		},
		{
			name:     "mixed literals",
			input:    `const s = "hello"; const n = 42;`,
			expected: `const s = __STR__; const n = __NUM__;`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := replaceLiterals(tt.input)
			if got != tt.expected {
				t.Errorf("replaceLiterals() = %q, want %q", got, tt.expected)
			}
		})
	}
}

func TestGenerateShingles(t *testing.T) {
	tokens := []Token{
		{Type: "keyword", Value: "const"},
		{Type: "identifier", Value: "x"},
		{Type: "operator", Value: "="},
		{Type: "identifier", Value: "y"},
	}

	shingles := generateShingles(tokens)

	expected := [][]string{
		{"const", "x", "="},
		{"x", "=", "y"},
	}

	if !reflect.DeepEqual(shingles, expected) {
		t.Errorf("generateShingles() = %v, want %v", shingles, expected)
	}
}

func TestGenerateShinglesTooFewTokens(t *testing.T) {
	tokens := []Token{
		{Type: "keyword", Value: "const"},
		{Type: "identifier", Value: "x"},
	}

	shingles := generateShingles(tokens)
	if shingles != nil {
		t.Errorf("generateShingles() with 2 tokens = %v, want nil", shingles)
	}
}

func TestGenerateShinglesEmpty(t *testing.T) {
	shingles := generateShingles([]Token{})
	if shingles != nil {
		t.Errorf("generateShingles() with 0 tokens = %v, want nil", shingles)
	}
}

func TestTokenizeFile(t *testing.T) {
	content := `const x = 1; // comment
const y = "hello";
return x + y;`

	tokens, shingles := TokenizeFile(content, "test.ts")

	if len(tokens) == 0 {
		t.Error("Expected tokens, got none")
	}

	for _, tok := range tokens {
		if tok.Value == "comment" {
			t.Error("Comment text should be stripped")
		}
	}

	for _, tok := range tokens {
		if tok.Value == "1" || tok.Value == "hello" {
			t.Errorf("Literal %q should be replaced with placeholder", tok.Value)
		}
	}

	if len(shingles) == 0 {
		t.Error("Expected shingles, got none")
	}

	// Verify token types
	hasKeyword := false
	hasIdentifier := false
	for _, tok := range tokens {
		if tok.Type == "keyword" && (tok.Value == "const" || tok.Value == "return") {
			hasKeyword = true
		}
		if tok.Type == "identifier" && (tok.Value == "x" || tok.Value == "y") {
			hasIdentifier = true
		}
	}

	if !hasKeyword {
		t.Error("Expected keyword tokens (const, return)")
	}
	if !hasIdentifier {
		t.Error("Expected identifier tokens (x, y)")
	}
}

func TestTokenizeFileSvelte(t *testing.T) {
	content := `<script lang="ts">
  export let variant: "default" | "destructive";
</script>
<button class="btn">Click me</button>`

	tokens, shingles := TokenizeFile(content, "test.svelte")

	if len(tokens) == 0 {
		t.Error("Expected tokens for Svelte file")
	}

	if len(shingles) == 0 {
		t.Error("Expected shingles for Svelte file")
	}

	// Verify keywords are detected
	hasExport := false
	for _, tok := range tokens {
		if tok.Value == "export" && tok.Type == "keyword" {
			hasExport = true
		}
	}
	if !hasExport {
		t.Error("Expected 'export' keyword token")
	}
}

func TestSupportedExtensions(t *testing.T) {
	if !SupportedExtensions[".ts"] {
		t.Error("Expected .ts to be supported")
	}
	if !SupportedExtensions[".svelte"] {
		t.Error("Expected .svelte to be supported")
	}
	if !SupportedExtensions[".tsx"] {
		t.Error("Expected .tsx to be supported")
	}
	if SupportedExtensions[".go"] {
		t.Error("Expected .go to NOT be supported")
	}
	if SupportedExtensions[".py"] {
		t.Error("Expected .py to NOT be supported")
	}
}

func TestIsOperator(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"=", true}, {"==", true}, {">=", true}, {"&&", true},
		{"{", true}, {"}", true}, {".", true}, {";", true},
		{"const", false}, {"hello", false}, {"123", false},
	}

	for _, tt := range tests {
		got := isOperator(tt.input)
		if got != tt.expected {
			t.Errorf("isOperator(%q) = %v, want %v", tt.input, got, tt.expected)
		}
	}
}

func TestTokenizeFileWithEscapedStrings(t *testing.T) {
	content := `const s = "hello \"world\""; const n = 42;`

	tokens, _ := TokenizeFile(content, "test.ts")

	// The escaped quotes should be handled correctly
	for _, tok := range tokens {
		if tok.Value == "world" {
			t.Error("String content inside escaped quotes should be part of __STR__")
		}
	}

	// Should have a literal token for the string
	hasLiteral := false
	for _, tok := range tokens {
		if tok.Type == "literal" {
			hasLiteral = true
		}
	}
	if !hasLiteral {
		t.Error("Expected literal token for string")
	}

	// Should have a literal token for the number
	hasNum := false
	for _, tok := range tokens {
		if tok.Value == "__num__" {
			hasNum = true
		}
	}
	if !hasNum {
		t.Error("Expected __num__ literal token")
	}
}

func TestTokenizeFileWithTemplateLiterals(t *testing.T) {
	content := `const s = "hello"; const t = 'world';`

	tokens, _ := TokenizeFile(content, "test.ts")

	// Both string types should be replaced
	for _, tok := range tokens {
		if tok.Value == "hello" || tok.Value == "world" {
			t.Errorf("String literal %q should be replaced", tok.Value)
		}
	}

	// Should have two literal tokens (one for each string)
	literalCount := 0
	for _, tok := range tokens {
		if tok.Type == "literal" {
			literalCount++
		}
	}
	if literalCount != 2 {
		t.Errorf("Expected 2 literal tokens, got %d", literalCount)
	}

	// Verify both are __str__ (lowercased)
	strCount := 0
	for _, tok := range tokens {
		if tok.Value == "__str__" {
			strCount++
		}
	}
	if strCount != 2 {
		t.Errorf("Expected 2 __str__ tokens, got %d", strCount)
	}
}
