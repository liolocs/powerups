package recipesearch

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"cuisson/internal/discover"
)

// SearchResult represents a single recipe match ranked by relevance.
type SearchResult struct {
	Score     int                  `json:"score"`
	RecipeName string              `json:"recipe_name"`
	FileCount int                 `json:"file_count"`
	Intent    []string            `json:"intent"`
	Recipe    discover.Recipe     `json:"recipe"`
}

// Searcher performs keyword-overlap intent matching across recipe directories.
type Searcher struct {
	TemplatesDir string // base directory containing recipe subdirectories
}

// Search finds recipes matching the intent query and returns top-N results ranked by score.
func (s *Searcher) Search(query string, limit int) ([]SearchResult, error) {
	// Discover all recipes
	recipes, err := discover.DiscoverRecipes(s.TemplatesDir)
	if err != nil {
		return nil, fmt.Errorf("failed to discover recipes: %w", err)
	}

	if len(recipes) == 0 {
		return nil, fmt.Errorf("no recipes found in %s", s.TemplatesDir)
	}

	// Tokenize the query into keywords
	queryKeywords := tokenizeQuery(query)

	if len(queryKeywords) == 0 {
		return nil, fmt.Errorf("empty search query")
	}

	// Score each recipe by keyword overlap
	var results []SearchResult
	for name, entry := range recipes {
		score := s.scoreRecipe(entry.Recipe, queryKeywords)

		if score == 0 {
			continue // skip non-matching recipes
		}

		results = append(results, SearchResult{
			Score:     score,
			RecipeName: name,
			FileCount: len(entry.Recipe.Output.Files),
			Intent:    entry.Recipe.Intent,
			Recipe:    entry.Recipe,
		})
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("no matching recipes found")
	}

	// Sort by score descending (higher = more relevant)
	sortResults(results)

	// Apply limit
	if limit > 0 && len(results) > limit {
		results = results[:limit]
	}

	return results, nil
}

// tokenizeQuery splits the query into lowercase keywords.
func tokenizeQuery(query string) []string {
	query = strings.ToLower(query)

	// Split on spaces and common delimiters
	delimiters := " ,;:.-_()[]{}\"'?!"
	var keywords []string
	var current strings.Builder

	for _, ch := range query {
		if strings.ContainsRune(delimiters, ch) {
			if current.Len() > 0 {
				keywords = append(keywords, current.String())
				current.Reset()
			}
		} else {
			current.WriteRune(ch)
		}
	}

	if current.Len() > 0 {
		keywords = append(keywords, current.String())
	}

	return keywords
}

// scoreRecipe counts how many query keywords appear in any recipe intent string.
func (s *Searcher) scoreRecipe(recipe discover.Recipe, queryKeywords []string) int {
	// Collect all intent tokens from the recipe
	intentTokens := make(map[string]bool)
	for _, intentStr := range recipe.Intent {
		tokens := tokenizeQuery(intentStr)
		for _, t := range tokens {
			intentTokens[t] = true
		}
	}

	// Count matching query keywords
	score := 0
	for _, qk := range queryKeywords {
		if intentTokens[qk] {
			score++
		}
	}

	return score
}

// sortResults sorts search results by score descending.
func sortResults(results []SearchResult) {
	for i := 0; i < len(results); i++ {
		for j := i + 1; j < len(results); j++ {
			if results[j].Score > results[i].Score {
				results[i], results[j] = results[j], results[i]
			}
		}
	}
}

// SearchRecipes searches all recipes in a directory by intent query.
func SearchRecipes(templatesDir, query string, limit int) ([]SearchResult, error) {
	searcher := &Searcher{TemplatesDir: templatesDir}
	return searcher.Search(query, limit)
}

// PrintResults prints search results in a human-readable format.
func PrintResults(results []SearchResult) {
	for i, r := range results {
		fmt.Printf("\n[%d] %s (score: %d, files: %d)\n", i+1, r.RecipeName, r.Score, r.FileCount)
		for _, intent := range r.Intent {
			fmt.Printf("    intent: %q\n", intent)
		}
		for _, f := range r.Recipe.Output.Files {
			fmt.Printf("    output: %s -> %s\n", f.Name, f.OutputPath)
		}
		if i < len(results)-1 {
			fmt.Println()
		}
	}

	// Also output JSON for machine consumption
	data, _ := json.MarshalIndent(results, "", "  ")
	fmt.Printf("\n%s\n", string(data))
}

// FindTemplatesDir resolves the templates directory from env var or project config.
func FindTemplatesDir() (string, error) {
	templatesDir := os.Getenv("CUISSON_TEMPLATES_DIR")
	if templatesDir != "" {
		return templatesDir, nil
	}

	// Try to discover via project config
	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get current directory: %w", err)
	}

	// Walk up looking for cuisson.config.json
	dir := cwd
	for {
		configPath := filepath.Join(dir, "cuisson.config.json")
		data, err := os.ReadFile(configPath)
		if err == nil {
			var cfg struct{ Name string }
			if json.Unmarshal(data, &cfg) == nil && cfg.Name != "" {
				home, _ := os.UserHomeDir()
				return filepath.Join(home, ".cuisson", cfg.Name, "templates"), nil
			}
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	return "", fmt.Errorf("templates directory not found. Set CUISSON_TEMPLATES_DIR or run from a project with cuisson.config.json")
}
