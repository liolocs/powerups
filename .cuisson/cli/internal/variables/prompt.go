package variables

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// ParseFlags parses --var key=value flags into a map
func ParseFlags(flags []string) (map[string]string, error) {
	result := make(map[string]string)

	for _, flag := range flags {
		parts := strings.SplitN(flag, "=", 2)
		if len(parts) != 2 {
			return nil, fmt.Errorf("invalid variable format %q, expected key=value", flag)
		}
		result[parts[0]] = parts[1]
	}

	return result, nil
}

// ParseNames parses --var name flags into a slice of names
func ParseNames(flags []string) ([]string, error) {
	if len(flags) == 0 {
		return nil, fmt.Errorf("at least one variable name is required")
	}

	// Deduplicate while preserving order
	seen := make(map[string]bool)
	var names []string
	for _, flag := range flags {
		if !seen[flag] {
			seen[flag] = true
			names = append(names, flag)
		}
	}

	return names, nil
}

// ResolveVariables checks that all required variables are provided, prompting for missing ones
func ResolveVariables(required []string, provided map[string]string) (map[string]string, error) {
	result := make(map[string]string)

	// Copy provided variables first
	for k, v := range provided {
		result[k] = v
	}

	reader := bufio.NewReader(os.Stdin)

	for _, req := range required {
		if _, ok := result[req]; ok {
			continue // already provided
		}

		fmt.Printf("Enter value for %s: ", req)
		input, err := reader.ReadString('\n')
		if err != nil {
			return nil, fmt.Errorf("failed to read input for %s: %w", req, err)
		}

		result[req] = strings.TrimSpace(input)
	}

	return result, nil
}
