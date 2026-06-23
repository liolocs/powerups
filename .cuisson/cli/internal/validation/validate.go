package validation

import (
	"fmt"
	"slices"
	"strings"

	"cuisson/internal/discover"
)

// ValidationResult holds validation findings for a recipe.
type ValidationResult struct {
	RecipeName string
	Errors     []string
	Warnings   []string
}

// Validate checks a recipe and all its transitive children for issues.
func Validate(recipeName string, recipes map[string]discover.RecipeEntry) []ValidationResult {
	var results []ValidationResult

	if recipeName == "" {
		for name := range recipes {
			results = append(results, Validate(name, recipes)...)
		}
		return results
	}

	return validateRecipe(recipeName, recipes, nil)
}

func validateRecipe(name string, recipes map[string]discover.RecipeEntry, visited []string) []ValidationResult {
	var results []ValidationResult

	entry, exists := recipes[name]
	if !exists {
		results = append(results, ValidationResult{
			RecipeName: name,
			Errors:     []string{fmt.Sprintf("recipe %q not found", name)},
		})
		return results
	}

	result := ValidationResult{RecipeName: name}

	if slices.Contains(visited, name) {
		cycle := append(visited, name)
		result.Errors = append(result.Errors, fmt.Sprintf("circular dependency detected: %s", strings.Join(cycle, " → ")))
		return append(results, result)
	}

	visited = append(visited, name)

	for _, childDef := range entry.Recipe.Extends {
		childEntry, exists := recipes[childDef.Recipe]
		if !exists {
			result.Errors = append(result.Errors, fmt.Sprintf("unknown recipe %q referenced by %q", childDef.Recipe, name))
			continue
		}

		varsToResolve := childDef.Variables
		if len(varsToResolve) == 0 {
			varsToResolve = childEntry.Recipe.Variables
		}

		for _, varName := range varsToResolve {
			parentVarName := varName
			if childDef.Map != nil {
				for _, cVar := range childDef.Map {
					if cVar == varName {
						// Found the parent var name that maps to this child var
						for pVar, mapped := range childDef.Map {
							if mapped == varName {
								parentVarName = pVar
								break
							}
						}
						break
					}
				}
			}

			if !hasVariable(name, parentVarName, recipes) {
				result.Errors = append(result.Errors, fmt.Sprintf("child %q requires variable %q (mapped from parent var %q), not available in recipe chain", childDef.Recipe, varName, parentVarName))
			}
		}

		results = append(results, validateRecipe(childDef.Recipe, recipes, visited)...)
	}

	outputPaths := make(map[string][]string)
	collectOutputPaths(entry, outputPaths, recipes, nil)

	for path, sources := range outputPaths {
		if len(sources) > 1 {
			result.Warnings = append(result.Warnings, fmt.Sprintf("duplicate output path %q — also written by: %s", path, strings.Join(sources, ", ")))
		}
	}

	results = append(results, result)
	return results
}

// hasVariable checks if a variable is available in the recipe or any of its ancestors.
func hasVariable(recipeName, varName string, recipes map[string]discover.RecipeEntry) bool {
	// Check the recipe itself
	entry, exists := recipes[recipeName]
	if !exists {
		return false
	}

	for _, v := range entry.Recipe.Variables {
		if v == varName {
			return true
		}
	}

	// Check if any recipe that extends this one has the variable (directly or via map)
	for _, parentEntry := range recipes {
		for _, childDef := range parentEntry.Recipe.Extends {
			if childDef.Recipe == recipeName {
				// parentEntry is a parent of recipeName
				if slices.Contains(parentEntry.Recipe.Variables, varName) {
					return true
				}
				if childDef.Map != nil {
					for k := range childDef.Map {
						if k == varName {
							return true
						}
					}
				}
			}
		}
	}

	return false
}

// collectOutputPaths gathers all output paths from a recipe and its transitive children.
func collectOutputPaths(entry discover.RecipeEntry, paths map[string][]string, recipes map[string]discover.RecipeEntry, visited []string) {
	for _, f := range entry.Recipe.Output.Files {
		paths[f.OutputPath] = append(paths[f.OutputPath], entry.Recipe.Name)
	}

	for _, childDef := range entry.Recipe.Extends {
		if slices.Contains(visited, childDef.Recipe) {
			continue // skip circular refs
		}
		if childEntry, exists := recipes[childDef.Recipe]; exists {
			collectOutputPaths(childEntry, paths, recipes, append(visited, childDef.Recipe))
		}
	}
}

// PrintResults prints validation results to stdout.
func PrintResults(results []ValidationResult) {
	for _, r := range results {
		if len(r.Errors) == 0 && len(r.Warnings) == 0 {
			fmt.Printf("[✓] recipe %q — no issues found\n", r.RecipeName)
		} else {
			for _, e := range r.Errors {
				fmt.Printf("[x] recipe %q: %s\n", r.RecipeName, e)
			}
			for _, w := range r.Warnings {
				fmt.Printf("[!] recipe %q: %s\n", r.RecipeName, w)
			}
		}
	}
}
