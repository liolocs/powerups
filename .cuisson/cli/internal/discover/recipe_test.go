package discover

import (
	"encoding/json"
	"testing"
)

func TestRecipeChildParsing(t *testing.T) {
	tests := []struct {
		name        string
		jsonInput   string
		wantRecipe  string
		wantVars    []string
		wantMap     map[string]string
	}{
		{
			name: "with mapping",
			jsonInput: `{
				"recipe": "new-component",
				"variables": ["componentName"],
				"map": {"widgetName": "componentName"}
			}`,
			wantRecipe: "new-component",
			wantVars:   []string{"componentName"},
			wantMap:    map[string]string{"widgetName": "componentName"},
		},
		{
			name: "without mapping",
			jsonInput: `{
				"recipe": "new-store",
				"variables": ["storeName"]
			}`,
			wantRecipe: "new-store",
			wantVars:   []string{"storeName"},
			wantMap:    nil,
		},
		{
			name: "with empty map",
			jsonInput: `{
				"recipe": "new-component",
				"map": {}
			}`,
			wantRecipe: "new-component",
			wantVars:   nil,
			wantMap:    map[string]string{}, // json.Unmarshal creates {}, not nil
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var child RecipeChild
			if err := json.Unmarshal([]byte(tt.jsonInput), &child); err != nil {
				t.Fatalf("unmarshal error: %v", err)
			}
			if child.Recipe != tt.wantRecipe {
				t.Errorf("Recipe = %q, want %q", child.Recipe, tt.wantRecipe)
			}
			if len(child.Variables) != len(tt.wantVars) {
				t.Errorf("Variables = %v, want %v", child.Variables, tt.wantVars)
			} else {
				for i := range child.Variables {
					if child.Variables[i] != tt.wantVars[i] {
						t.Errorf("Variables[%d] = %q, want %q", i, child.Variables[i], tt.wantVars[i])
					}
				}
			}
			if tt.wantMap == nil {
				// nil or empty map both acceptable when wantMap is nil
			} else {
				if len(child.Map) != len(tt.wantMap) {
					t.Errorf("Map = %v, want %v", child.Map, tt.wantMap)
				} else {
					for k, v := range tt.wantMap {
						if child.Map[k] != v {
							t.Errorf("Map[%q] = %q, want %q", k, child.Map[k], v)
						}
					}
				}
			}
		})
	}
}

func TestRecipeWithExtendsParsing(t *testing.T) {
	jsonInput := `{
		"name": "page",
		"variables": ["widgetName", "storeName"],
		"intent": ["create a page"],
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
					"outputPath": "{{widgetName}}.svelte"
				}
			]
		}
	}`

	var recipe Recipe
	if err := json.Unmarshal([]byte(jsonInput), &recipe); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if recipe.Name != "page" {
		t.Errorf("Name = %q, want %q", recipe.Name, "page")
	}

	if len(recipe.Extends) != 2 {
		t.Fatalf("Extends length = %d, want 2", len(recipe.Extends))
	}

	if recipe.Extends[0].Recipe != "new-component" {
		t.Errorf("Extends[0].Recipe = %q, want %q", recipe.Extends[0].Recipe, "new-component")
	}

	if len(recipe.Extends[0].Map) != 1 || recipe.Extends[0].Map["widgetName"] != "componentName" {
		t.Errorf("Extends[0].Map = %v, want map[widgetName:componentName]", recipe.Extends[0].Map)
	}

	if recipe.Extends[1].Recipe != "new-store" {
		t.Errorf("Extends[1].Recipe = %q, want %q", recipe.Extends[1].Recipe, "new-store")
	}

	if recipe.Extends[1].Map != nil {
		t.Errorf("Extends[1].Map = %v, want nil", recipe.Extends[1].Map)
	}
}

func TestRecipeWithoutExtendsParsing(t *testing.T) {
	jsonInput := `{
		"name": "simple",
		"variables": ["name"],
		"output": {
			"files": []
		}
	}`

	var recipe Recipe
	if err := json.Unmarshal([]byte(jsonInput), &recipe); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}

	if recipe.Extends != nil && len(recipe.Extends) > 0 {
		t.Errorf("Extends = %v, want nil or empty", recipe.Extends)
	}
}
