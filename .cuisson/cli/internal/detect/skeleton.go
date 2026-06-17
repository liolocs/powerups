package detect

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
	ts "github.com/smacker/go-tree-sitter/typescript/typescript"
	svelte "github.com/smacker/go-tree-sitter/svelte"
)

// SkeletonResult holds the extracted skeleton template and inferred slots for a file.
type SkeletonResult struct {
	Template       string
	Slots          []Slot
	TemplateFile   string
	HasScriptBlock bool
}

// Slot represents an inferred variable position in a file
type Slot struct {
	Name         string // "filename", "divergence", "literal"
	Positions    []int
	InferredFrom string
}

// identInfo holds identifier information extracted from AST
type identInfo struct {
	name  string
	pos   int
}

// ExtractSkeletons takes a cluster of file paths and returns skeleton results.
func ExtractSkeletons(clusterID string, filePaths []string) ([]SkeletonResult, error) {
	var results []SkeletonResult

	for _, path := range filePaths {
		content, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("failed to read %s: %w", path, err)
		}

		skel, err := extractSingleSkeleton(path, string(content))
		if err != nil {
			return nil, fmt.Errorf("failed to extract skeleton from %s: %w", path, err)
		}

		results = append(results, *skel)
	}

	return results, nil
}

// extractSingleSkeleton extracts a skeleton template from a single file.
func extractSingleSkeleton(path, content string) (*SkeletonResult, error) {
	ext := strings.ToLower(filepath.Ext(path))

	switch ext {
	case ".svelte":
		return extractSvelteSkeleton(content, path)
	case ".ts", ".tsx", ".js", ".jsx":
		return extractTSSkeleton(content, path)
	default:
		return nil, fmt.Errorf("unsupported file extension %q", ext)
	}
}

// extractSvelteSkeleton parses a Svelte file and produces a skeleton template.
func extractSvelteSkeleton(content, path string) (*SkeletonResult, error) {
	filename := strings.TrimSuffix(filepath.Base(path), ".svelte")

	// Check for <script> block
	hasScript := strings.Contains(content, "<script") && strings.Contains(content, "</script>")

	// Try tree-sitter parsing first (if --refine was enabled)
	rootNode, err := parseSvelte(content)
	if err == nil && rootNode != nil {
		// Extract slots from AST
		slots := extractSlotsFromAST(rootNode, []byte(content), filename)
		if len(slots) > 0 {
			return &SkeletonResult{
				Template:       content,
				Slots:          slots,
				TemplateFile:   filename + ".svelte.tmpl",
				HasScriptBlock: hasScript,
			}, nil
		}
	}

	// Fallback to filename-based slot inference
	slot := Slot{
		Name:         inferSlotNameFromFilename(filename),
		Positions:    []int{0},
		InferredFrom: "filename",
	}

	return &SkeletonResult{
		Template:       content,
		Slots:          []Slot{slot},
		TemplateFile:   filename + ".svelte.tmpl",
		HasScriptBlock: hasScript,
	}, nil
}

// parseSvelte parses Svelte content using tree-sitter.
func parseSvelte(content string) (*sitter.Node, error) {
	lang := svelte.GetLanguage()
	node := sitter.Parse([]byte(content), lang)
	if node == nil {
		return nil, fmt.Errorf("tree-sitter failed to parse Svelte")
	}
	return node, nil
}

// extractTSSkeleton parses a TypeScript/JavaScript file and extracts a skeleton.
func extractTSSkeleton(content, path string) (*SkeletonResult, error) {
	filename := strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))

	// Try tree-sitter parsing first (if --refine was enabled)
	rootNode, err := parseTS(content)
	if err == nil && rootNode != nil {
		// Extract slots from AST
		slots := extractSlotsFromAST(rootNode, []byte(content), filename)
		if len(slots) > 0 {
			return &SkeletonResult{
				Template:     content,
				Slots:        slots,
				TemplateFile: filename + ".ts.tmpl",
			}, nil
		}
	}

	// Fallback to filename-based slot inference
	slot := Slot{
		Name:         inferSlotNameFromFilename(filename),
		Positions:    []int{0},
		InferredFrom: "filename",
	}

	return &SkeletonResult{
		Template:     content,
		Slots:        []Slot{slot},
		TemplateFile: filename + ".ts.tmpl",
	}, nil
}

// parseTS parses TypeScript/JavaScript content using tree-sitter.
func parseTS(content string) (*sitter.Node, error) {
	lang := ts.GetLanguage()
	node := sitter.Parse([]byte(content), lang)
	if node == nil {
		return nil, fmt.Errorf("tree-sitter failed to parse TypeScript")
	}
	return node, nil
}

// inferSlotNameFromFilename derives a slot name from the varying part of a filename.
func inferSlotNameFromFilename(filename string) string {
	suffixes := []string{".svelte", ".ts", ".tsx", ".js", ".jsx"}
	for _, suffix := range suffixes {
		if strings.HasSuffix(filename, suffix) {
			filename = strings.TrimSuffix(filename, suffix)
			break
		}
	}

	name := strings.ReplaceAll(filename, "-", "_")
	name = strings.ReplaceAll(name, " ", "_")

	parts := strings.Split(name, "_")
	for i, part := range parts {
		if len(part) > 0 {
			parts[i] = strings.ToUpper(part[:1]) + part[1:]
		}
	}

	return strings.Join(parts, "") + "Name"
}

// extractSlotsFromAST extracts slot information from a tree-sitter AST node.
func extractSlotsFromAST(root *sitter.Node, content []byte, filename string) []Slot {
	var slots []Slot

	// Collect all identifier nodes with their positions
	var identifiers []identInfo
	collectIdentifiers(root, content, &identifiers)

	if len(identifiers) == 0 {
		return nil
	}

	// Group identifiers by name to find which ones vary
	namePositions := make(map[string][]int)
	for _, id := range identifiers {
		namePositions[id.name] = append(namePositions[id.name], id.pos)
	}

	// Create slots for identifiers that match filename patterns
	for name, positions := range namePositions {
		if strings.Contains(strings.ToLower(name), strings.ToLower(filename)) {
			slots = append(slots, Slot{
				Name:         name,
				Positions:    positions,
				InferredFrom: "divergence",
			})
		}
	}

	if len(slots) == 0 {
		// Fallback to filename-based slot
		slots = []Slot{{
			Name:         inferSlotNameFromFilename(filename),
			Positions:    []int{0},
			InferredFrom: "filename",
		}}
	}

	return slots
}

// collectIdentifiers recursively collects all identifier nodes from the AST.
func collectIdentifiers(node *sitter.Node, content []byte, out *[]identInfo) {
	if node == nil || node.IsNull() {
		return
	}

	if node.Type() == "identifier" || strings.Contains(node.Type(), "name") {
		*out = append(*out, identInfo{
			name:  node.Content(content),
			pos:   int(node.StartPoint().Row),
		})
	}

	for i := uint32(0); i < node.ChildCount(); i++ {
		child := node.Child(int(i))
		collectIdentifiers(child, content, out)
	}
}

// AlignSkeletons compares skeletons across cluster members and returns a unified template.
func AlignSkeletons(skeletons []SkeletonResult) (string, []Slot) {
	if len(skeletons) == 0 {
		return "", nil
	}

	base := skeletons[0]

	slotSet := make(map[string]bool)
	for _, skel := range skeletons {
		for _, slot := range skel.Slots {
			slotSet[slot.Name] = true
		}
	}

	var allSlots []Slot
	for name := range slotSet {
		allSlots = append(allSlots, Slot{
			Name:         name,
			InferredFrom: "divergence",
		})
	}

	return base.Template, allSlots
}
