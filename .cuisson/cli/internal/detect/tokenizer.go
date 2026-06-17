package detect

import (
	"strings"
)

// SupportedExtensions lists file extensions the tokenizer handles
var SupportedExtensions = map[string]bool{
	".ts": true, ".tsx": true, ".svelte": true,
	".js": true, ".jsx": true,
}

// Token represents a single lexical token
type Token struct {
	Type  string // "keyword", "identifier", "operator", "literal"
	Value string
}

// TokenizeFile tokenizes a file's content into tokens and shingles.
func TokenizeFile(content string, filename string) ([]Token, [][]string) {
	content = stripComments(content)
	content = replaceLiterals(content)
	tokens := tokenizeTokens(content)
	shingles := generateShingles(tokens)
	return tokens, shingles
}

// stripComments removes single-line and multi-line comments from source code.
func stripComments(content string) string {
	var result strings.Builder
	inString := false
	escaped := false
	i := 0
	for i < len(content) {
		ch := content[i]

		if escaped {
			escaped = false
			result.WriteByte(ch)
			i++
			continue
		}

		if ch == '\\' && inString {
			escaped = true
			result.WriteByte(ch)
			i++
			continue
		}

		if ch == '"' || ch == '\'' {
			inString = !inString
			result.WriteByte(ch)
			i++
			continue
		}

		if !inString {
			if i+1 < len(content) && content[i] == '/' && content[i+1] == '/' {
				for i < len(content) && content[i] != '\n' {
					i++
				}
				continue
			}
			if i+1 < len(content) && content[i] == '/' && content[i+1] == '*' {
				i += 2
				for i+1 < len(content) && !(content[i] == '*' && content[i+1] == '/') {
					i++
				}
				if i+1 < len(content) {
					i += 2
				}
				result.WriteString(" ")
				continue
			}
		}

		result.WriteByte(ch)
		i++
	}
	return result.String()
}

// replaceLiterals replaces string and number literals with placeholder tokens.
func replaceLiterals(content string) string {
	var result strings.Builder
	inString := false
	escaped := false
	i := 0
	for i < len(content) {
		ch := content[i]

		if escaped {
			escaped = false
			i++
			continue
		}

		if ch == '\\' && inString {
			escaped = true
			i++
			continue
		}

		if ch == '"' || ch == '\'' {
			inString = !inString
			if inString {
				result.WriteString("__STR__")
			}
			// Skip both opening and closing quotes
			i++
			continue
		}

		if !inString && (ch >= '0' && ch <= '9') {
			result.WriteString("__NUM__")
			i++
			for i < len(content) && ((content[i] >= '0' && content[i] <= '9') || content[i] == '.') {
				i++
			}
			continue
		}

		if inString {
			// Skip characters inside strings (already replaced with __STR__)
			i++
			continue
		}

		result.WriteByte(ch)
		i++
	}
	return result.String()
}

// tokenizeTokens splits content into keyword/identifier/operator/literal tokens.
func tokenizeTokens(content string) []Token {
	var tokens []Token
	var current strings.Builder
	inString := false
	escaped := false

	flushToken := func() {
		val := strings.TrimSpace(current.String())
		if val == "" {
			current.Reset()
			return
		}

		keywords := map[string]bool{
			"const": true, "let": true, "var": true,
			"function": true, "return": true, "if": true, "else": true,
			"import": true, "export": true, "from": true, "default": true,
			"type": true, "interface": true, "enum": true, "class": true,
			"extends": true, "implements": true, "new": true, "this": true,
			"async": true, "await": true, "for": true, "while": true,
			"of": true, "in": true, "as": true, "svelte": true,
		}

		tokType := "identifier"
		if keywords[val] {
			tokType = "keyword"
		} else if val == "__STR__" || val == "__NUM__" {
			tokType = "literal"
		} else if isOperator(val) {
			tokType = "operator"
		}

		tokens = append(tokens, Token{Type: tokType, Value: strings.ToLower(val)})
		current.Reset()
	}

	for i := 0; i < len(content); i++ {
		ch := content[i]

		if escaped {
			escaped = false
			current.WriteByte(ch)
			continue
		}

		if ch == '\\' && inString {
			escaped = true
			current.WriteByte(ch)
			continue
		}

		if ch == '"' || ch == '\'' {
			inString = !inString
			current.WriteByte(ch)
			continue
		}

		if !inString && (ch == ' ' || ch == '\t' || ch == '\n' || ch == '\r' || ch == ';' || ch == ',' || ch == '(' || ch == ')' || ch == '{' || ch == '}' || ch == '[' || ch == ']') {
			if current.Len() > 0 {
				flushToken()
			}
			// Also emit the delimiter as its own token if it's an operator
			if isOperator(string(ch)) {
				tokens = append(tokens, Token{Type: "operator", Value: string(ch)})
			}
			continue
		}

		current.WriteByte(ch)
	}
	flushToken()
	return tokens
}

// isOperator checks if a string is an operator token.
func isOperator(s string) bool {
	op := map[string]bool{
		"=": true, "+": true, "-": true, "*": true, "/": true,
		"==": true, "!=": true, "===": true, "!==": true,
		"<": true, ">": true, "<=": true, ">=": true,
		"&&": true, "||": true, "!": true,
		"(": true, ")": true, "{": true, "}": true,
		"[": true, "]": true, ",": true, ".": true, ";": true,
	}
	return op[s]
}

// generateShingles creates 3-grams from token values.
func generateShingles(tokens []Token) [][]string {
	if len(tokens) < 3 {
		return nil
	}
	var shingles [][]string
	for i := 0; i <= len(tokens)-3; i++ {
		shingle := []string{tokens[i].Value, tokens[i+1].Value, tokens[i+2].Value}
		shingles = append(shingles, shingle)
	}
	return shingles
}
