package validation

import (
	"strings"
	"testing"

	"cuisson/internal/discover"
)

func TestValidateNoIssues(t *testing.T) {
	recipes := map[string]discover.RecipeEntry{
		"new-component": {
			Recipe: discover.Recipe{
				Name:      "new-component",
				Variables: []string{"componentName"},
			},
		},
	}

	results := Validate("new-component", recipes)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	if len(results[0].Errors) != 0 {
		t.Errorf("expected no errors, got: %v", results[0].Errors)
	}

	if len(results[0].Warnings) != 0 {
		t.Errorf("expected no warnings, got: %v", results[0].Warnings)
	}
}

func TestValidateCircularDependency(t *testing.T) {
	recipes := map[string]discover.RecipeEntry{
		"a": {
			Recipe: discover.Recipe{
				Name: "a",
				Extends: []discover.RecipeChild{
					{Recipe: "b"},
				},
			},
		},
		"b": {
			Recipe: discover.Recipe{
				Name: "b",
				Extends: []discover.RecipeChild{
					{Recipe: "a"},
				},
			},
		},
	}

	results := Validate("a", recipes)
	if len(results) < 2 {
		t.Fatalf("expected at least 2 results, got %d", len(results))
	}

	found := false
	for _, r := range results {
		for _, e := range r.Errors {
			if strings.Contains(e, "circular dependency") {
				found = true
			}
		}
	}

	if !found {
		t.Errorf("expected circular dependency error, got: %v", results)
	}
}

func TestValidateUnknownRecipe(t *testing.T) {
	recipes := map[string]discover.RecipeEntry{
		"a": {
			Recipe: discover.Recipe{
				Name: "a",
				Extends: []discover.RecipeChild{
					{Recipe: "nonexistent"},
				},
			},
		},
	}

	results := Validate("a", recipes)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	if len(results[0].Errors) != 1 {
		t.Fatalf("expected 1 error, got %d: %v", len(results[0].Errors), results[0].Errors)
	}

	if !strings.Contains(results[0].Errors[0], "unknown recipe") {
		t.Errorf("expected unknown recipe error, got: %s", results[0].Errors[0])
	}
}

func TestValidateMissingVariable(t *testing.T) {
	recipes := map[string]discover.RecipeEntry{
		"child": {
			Recipe: discover.Recipe{
				Name:      "child",
				Variables: []string{"neededVar"},
			},
		},
	}

	parent := discover.RecipeEntry{
		Recipe: discover.Recipe{
			Name: "parent",
			Extends: []discover.RecipeChild{
				{
					Recipe:    "child",
					Variables: []string{"neededVar"},
				},
			},
		},
	}

	recipes["parent"] = parent

	results := Validate("parent", recipes)
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	found := false
	for _, r := range results {
		if r.RecipeName == "parent" {
			for _, e := range r.Errors {
				if strings.Contains(e, "not available in recipe chain") {
					found = true
				}
			}
		}
	}

	if !found {
		t.Errorf("expected missing variable error, got: %v", results)
	}
}

func TestValidateDuplicateOutputPath(t *testing.T) {
	recipes := map[string]discover.RecipeEntry{
		"parent": {
			Recipe: discover.Recipe{
				Name: "parent",
				Output: discover.Output{
					Files: []discover.RecipeFile{
						{Name: "a.txt", Template: "a.tmpl", OutputPath: "out/a.txt"},
					},
				},
			},
		},
		"child": {
			Recipe: discover.Recipe{
				Name: "child",
				Output: discover.Output{
					Files: []discover.RecipeFile{
						{Name: "a.txt", Template: "a.tmpl", OutputPath: "out/a.txt"},
					},
				},
			},
		},
	}

	parent := discover.RecipeEntry{
		Recipe: discover.Recipe{
			Name: "parent",
			Extends: []discover.RecipeChild{
				{Recipe: "child"},
			},
			Output: discover.Output{
				Files: []discover.RecipeFile{
					{Name: "a.txt", Template: "a.tmpl", OutputPath: "out/a.txt"},
				},
			},
		},
	}

	recipes["parent"] = parent

	results := Validate("parent", recipes)
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	found := false
	for _, r := range results {
		if r.RecipeName == "parent" {
			for _, w := range r.Warnings {
				if strings.Contains(w, "duplicate output path") {
					found = true
				}
			}
		}
	}

	if !found {
		t.Errorf("expected duplicate output path warning, got: %v", results)
	}
}

func TestValidateWithMapping(t *testing.T) {
	recipes := map[string]discover.RecipeEntry{
		"child": {
			Recipe: discover.Recipe{
				Name:      "child",
				Variables: []string{"childVar"},
			},
		},
	}

	parent := discover.RecipeEntry{
		Recipe: discover.Recipe{
			Name:      "parent",
			Variables: []string{"parentVar"},
			Extends: []discover.RecipeChild{
				{
					Recipe:    "child",
					Variables: []string{"childVar"},
					Map:       map[string]string{"parentVar": "childVar"},
				},
			},
		},
	}

	recipes["parent"] = parent

	results := Validate("parent", recipes)
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	for _, r := range results {
		if len(r.Errors) != 0 {
			t.Errorf("expected no errors with valid mapping, got: %v", r.Errors)
		}
	}
}

func TestValidateAllRecipes(t *testing.T) {
	recipes := map[string]discover.RecipeEntry{
		"good": {
			Recipe: discover.Recipe{Name: "good"},
		},
	}

	results := Validate("", recipes)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	if results[0].RecipeName != "good" {
		t.Errorf("result recipe = %q, want %q", results[0].RecipeName, "good")
	}
}

func TestValidateRecursiveChain(t *testing.T) {
	recipes := map[string]discover.RecipeEntry{
		"base": {
			Recipe: discover.Recipe{
				Name:      "base",
				Variables: []string{"baseName"},
			},
		},
	}

	middle := discover.RecipeEntry{
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
	}

	top := discover.RecipeEntry{
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

	recipes["middle"] = middle
	recipes["top"] = top

	results := Validate("top", recipes)
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}

	for _, r := range results {
		if len(r.Errors) != 0 {
			t.Errorf("expected no errors in valid chain, got %s: %v", r.RecipeName, r.Errors)
		}
	}
}

func TestValidateMissingVariableInChain(t *testing.T) {
	recipes := map[string]discover.RecipeEntry{
		"base": {
			Recipe: discover.Recipe{
				Name:      "base",
				Variables: []string{"baseName"},
			},
		},
	}

	middle := discover.RecipeEntry{
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
	}

	top := discover.RecipeEntry{
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

	recipes["middle"] = middle
	recipes["top"] = top

	// Now test: remove baseName from the chain by having middle not map correctly
	middleBroken := discover.RecipeEntry{
		Recipe: discover.Recipe{
			Name:      "middle",
			Variables: []string{"midName"},
			Extends: []discover.RecipeChild{
				{
					Recipe:    "base",
					Variables: []string{"baseName"},
					Map:       map[string]string{"wrongVar": "baseName"}, // wrong mapping
				},
			},
		},
	}

	topBroken := discover.RecipeEntry{
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

	recipes["middle"] = middleBroken
	recipes["top"] = topBroken

	results := Validate("top", recipes)

	found := false
	for _, r := range results {
		if r.RecipeName == "middle" {
			for _, e := range r.Errors {
				if strings.Contains(e, "not available in recipe chain") {
					found = true
				}
			}
		}
	}

	if !found {
		t.Errorf("expected missing variable error in chain, got: %v", results)
	}
}
