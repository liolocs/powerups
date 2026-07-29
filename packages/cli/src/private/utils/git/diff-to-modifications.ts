import type { Modification } from "#schemas/modification";

export type DiffLineType = "context" | "added" | "removed";

export type DiffLine = {
  type: DiffLineType;
  content: string;
};

export type DiffHunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: DiffLine[];
};

type AtomicEditType = "insertion" | "deletion" | "replacement";

type AtomicEdit = {
  type: AtomicEditType;
  contextBefore: string[];
  contextAfter: string[];
  removedLines: string[];
  addedLines: string[];
  atFileStart: boolean;
  atFileEnd: boolean;
};

type GenerateModificationsResult = {
  modifications: Modification[];
  warnings: string[];
};

const MAX_CONTEXT_EXPANSION = 10;

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  return haystack.split(needle).length - 1;
}

function joinLines(lines: string[]): string {
  if (lines.length === 0) return "";
  return lines.join("\n") + "\n";
}

function countPreImageLines(preImage: string): number {
  if (preImage.length === 0) return 0;
  const parts = preImage.split("\n");
  return preImage.endsWith("\n") ? parts.length - 1 : parts.length;
}

function applyModificationSafe({
  content,
  mod,
}: {
  content: string;
  mod: Modification;
}): string | null {
  const where = mod.where;

  if (where === "top") {
    return mod.content + content;
  }

  if (where === "bottom") {
    return content + mod.content;
  }

  if (typeof where === "string") {
    const count = countOccurrences(content, where);
    if (count === 0) return null;
    if (count > 1) return null;
    return content.replace(where, mod.content);
  }

  if ("after" in where) {
    const index = content.indexOf(where.after);
    if (index === -1) return null;
    const insertPos = index + where.after.length;
    return content.slice(0, insertPos) + mod.content + content.slice(insertPos);
  }

  if ("before" in where) {
    const index = content.indexOf(where.before);
    if (index === -1) return null;
    return content.slice(0, index) + mod.content + content.slice(index);
  }

  return null;
}

function validateModifications({
  preImage,
  postImage,
  modifications,
}: {
  preImage: string;
  postImage: string;
  modifications: Modification[];
}): boolean {
  let result = preImage;
  for (const mod of modifications) {
    const applied = applyModificationSafe({ content: result, mod });
    if (applied === null) return false;
    result = applied;
  }
  return result === postImage;
}

function parseHunksIntoEdits(hunks: DiffHunk[], preImage: string): AtomicEdit[] {
  const edits: AtomicEdit[] = [];
  const totalPreImageLines = countPreImageLines(preImage);

  for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    const hunk = hunks[hunkIndex];
    const lines = hunk.lines;

    let contextBuffer: string[] = [];
    let preImageLine = hunk.oldStart;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      if (line.type === "context") {
        contextBuffer.push(line.content);
        preImageLine++;
        i++;
        continue;
      }

      const editStartIndex = i;
      let removedLines: string[] = [];
      let addedLines: string[] = [];

      while (i < lines.length && lines[i].type !== "context") {
        if (lines[i].type === "removed") {
          removedLines.push(lines[i].content);
        } else {
          addedLines.push(lines[i].content);
        }
        i++;
      }

      let editType: AtomicEditType;
      if (removedLines.length === 0 && addedLines.length > 0) {
        editType = "insertion";
      } else if (removedLines.length > 0 && addedLines.length === 0) {
        editType = "deletion";
      } else {
        editType = "replacement";
      }

      const contextBefore = [...contextBuffer];

      const contextAfter: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].type === "context") {
        contextAfter.push(lines[j].content);
        j++;
      }

      const editLineNumber = preImageLine - removedLines.length;
      const isLastEditInHunk = i >= lines.length || lines.slice(i).every(l => l.type === "context");
      const atFileStart = hunkIndex === 0 && edits.length === 0
        && hunk.oldStart === 1 && contextBefore.length === 0;
      const atFileEnd = hunkIndex === hunks.length - 1
        && isLastEditInHunk
        && contextAfter.length === 0
        && hunk.oldStart + hunk.oldCount - 1 >= totalPreImageLines;

      edits.push({
        type: editType,
        contextBefore,
        contextAfter,
        removedLines,
        addedLines,
        atFileStart,
        atFileEnd,
      });

      contextBuffer = [...contextAfter];
      preImageLine += contextAfter.length;
    }
  }

  return edits;
}

function expandWithContext({
  oldBlock,
  newBlock,
  contextBefore,
  contextAfter,
  preImage,
  isInsertion,
}: {
  oldBlock: string;
  newBlock: string;
  contextBefore: string[];
  contextAfter: string[];
  preImage: string;
  isInsertion: boolean;
}): { where: string; content: string } | null {
  const beforeLines = [...contextBefore];
  const afterLines = [...contextAfter];

  for (let expansion = 0; expansion < MAX_CONTEXT_EXPANSION; expansion++) {
    if (beforeLines.length === 0 && afterLines.length === 0) break;

    const useBefore = beforeLines.length > 0
      && (afterLines.length === 0 || expansion % 2 === 0);

    if (useBefore) {
      beforeLines.pop();
    } else {
      afterLines.shift();
    }

    const contextBeforeUsed = contextBefore.slice(contextBefore.length - beforeLines.length);
    const contextAfterUsed = afterLines;

    const contextBeforeStr = contextBeforeUsed.length > 0
      ? joinLines(contextBeforeUsed)
      : "";
    const contextAfterStr = contextAfterUsed.length > 0
      ? joinLines(contextAfterUsed)
      : "";

    const where = contextBeforeStr + oldBlock + contextAfterStr;
    const content = isInsertion
      ? contextBeforeStr + newBlock + contextAfterStr
      : contextBeforeStr + newBlock + contextAfterStr;

    if (countOccurrences(preImage, where) === 1) {
      return { where, content };
    }
  }

  return null;
}

function generateModificationForEdit({
  edit,
  preImage,
}: {
  edit: AtomicEdit;
  preImage: string;
}): { modification: Modification | null; warning: string | null } {
  const { type, contextBefore, contextAfter, removedLines, addedLines, atFileStart, atFileEnd } = edit;

  if (type === "insertion") {
    const insertedContent = joinLines(addedLines);

    if (atFileStart) {
      return { modification: { where: "top", content: insertedContent }, warning: null };
    }

    if (atFileEnd) {
      return { modification: { where: "bottom", content: insertedContent }, warning: null };
    }

    if (contextBefore.length > 0) {
      const anchor = contextBefore[contextBefore.length - 1] + "\n";
      if (countOccurrences(preImage, anchor) === 1) {
        return {
          modification: { where: { after: anchor }, content: insertedContent },
          warning: null,
        };
      }
    }

    if (contextAfter.length > 0) {
      const anchor = contextAfter[0] + "\n";
      if (countOccurrences(preImage, anchor) === 1) {
        return {
          modification: { where: { before: anchor }, content: insertedContent },
          warning: null,
        };
      }
    }

    const expanded = expandWithContext({
      oldBlock: "",
      newBlock: insertedContent,
      contextBefore,
      contextAfter,
      preImage,
      isInsertion: true,
    });

    if (expanded !== null) {
      return { modification: { where: expanded.where, content: expanded.content }, warning: null };
    }

    return {
      modification: null,
      warning: "Could not find a unique anchor for insertion — manual review required",
    };
  }

  if (type === "deletion") {
    const oldContent = joinLines(removedLines);

    if (countOccurrences(preImage, oldContent) === 1) {
      return { modification: { where: oldContent, content: "" }, warning: null };
    }

    const expanded = expandWithContext({
      oldBlock: oldContent,
      newBlock: "",
      contextBefore,
      contextAfter,
      preImage,
      isInsertion: false,
    });

    if (expanded !== null) {
      return { modification: { where: expanded.where, content: expanded.content }, warning: null };
    }

    return {
      modification: null,
      warning: "Could not find a unique anchor for deletion — manual review required",
    };
  }

  const oldContent = joinLines(removedLines);
  const newContent = joinLines(addedLines);

  if (countOccurrences(preImage, oldContent) === 1) {
    return { modification: { where: oldContent, content: newContent }, warning: null };
  }

  const expanded = expandWithContext({
    oldBlock: oldContent,
    newBlock: newContent,
    contextBefore,
    contextAfter,
    preImage,
    isInsertion: false,
  });

  if (expanded !== null) {
    return { modification: { where: expanded.where, content: expanded.content }, warning: null };
  }

  return {
    modification: null,
    warning: "Could not find a unique anchor for replacement — manual review required",
  };
}

function wholeHunkReplacement({
  hunk,
  preImage,
}: {
  hunk: DiffHunk;
  preImage: string;
}): { modification: Modification | null } {
  const preLines: string[] = [];
  const postLines: string[] = [];

  for (const line of hunk.lines) {
    if (line.type === "context") {
      preLines.push(line.content);
      postLines.push(line.content);
    } else if (line.type === "removed") {
      preLines.push(line.content);
    } else if (line.type === "added") {
      postLines.push(line.content);
    }
  }

  const where = joinLines(preLines);
  const content = joinLines(postLines);

  if (where.length === 0) return { modification: null };
  if (countOccurrences(preImage, where) === 1) {
    return { modification: { where, content } };
  }

  return { modification: null };
}

export function generateModifications({
  preImage,
  postImage,
  hunks,
}: {
  preImage: string;
  postImage: string;
  hunks: DiffHunk[];
}): GenerateModificationsResult {
  if (hunks.length === 0) {
    return { modifications: [], warnings: ["Empty diff — no changes detected"] };
  }

  if (preImage === postImage) {
    return { modifications: [], warnings: [] };
  }

  if (preImage.includes("\0") || postImage.includes("\0")) {
    return { modifications: [], warnings: ["Binary file — cannot generate modifications"] };
  }

  const edits = parseHunksIntoEdits(hunks, preImage);
  const modifications: Modification[] = [];
  const warnings: string[] = [];

  for (const edit of edits) {
    const result = generateModificationForEdit({ edit, preImage });
    if (result.modification !== null) {
      modifications.push(result.modification);
    }
    if (result.warning !== null) {
      warnings.push(result.warning);
    }
  }

  if (validateModifications({ preImage, postImage, modifications })) {
    return { modifications, warnings };
  }

  const regeneratedMods: Modification[] = [];
  const regeneratedWarnings: string[] = [];

  for (let hunkIndex = 0; hunkIndex < hunks.length; hunkIndex++) {
    const hunkResult = wholeHunkReplacement({ hunk: hunks[hunkIndex], preImage });
    if (hunkResult.modification !== null) {
      regeneratedMods.push(hunkResult.modification);
    } else {
      regeneratedWarnings.push(
        `Hunk ${hunkIndex + 1}: could not generate a unique replacement — manual review required`,
      );
    }
  }

  if (validateModifications({ preImage, postImage, modifications: regeneratedMods })) {
    return { modifications: regeneratedMods, warnings: [...warnings, ...regeneratedWarnings] };
  }

  const validMods: Modification[] = [];
  for (const mod of modifications) {
    const testMods = [...validMods, mod];
    if (validateModifications({ preImage, postImage, modifications: testMods })) {
      validMods.push(mod);
    }
  }

  if (validMods.length < modifications.length) {
    warnings.push("Some modifications could not be validated — manual review required");
  }

  return { modifications: validMods, warnings };
}