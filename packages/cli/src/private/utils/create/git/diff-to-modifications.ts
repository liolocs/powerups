import type { Modification } from "#schemas/modification";

export type DiffLineType = "context" | "added" | "removed";

export type DiffLine = {
  type: DiffLineType;
  content: string;
  noNewline?: boolean;
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
  preImageStartLine: number;
  oldNoNewline: boolean;
  newNoNewline: boolean;
};

type GenerateModificationsResult = {
  modifications: Modification[];
  warnings: string[];
};

const MAX_PREIMAGE_EXPANSION = 200;

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  return haystack.split(needle).length - 1;
}

function joinLines(lines: string[], noTrailingNewline = false): string {
  if (lines.length === 0) return "";
  return lines.join("\n") + (noTrailingNewline ? "" : "\n");
}

function countPreImageLines(preImage: string): number {
  if (preImage.length === 0) return 0;
  const parts = preImage.split("\n");
  return preImage.endsWith("\n") ? parts.length - 1 : parts.length;
}

function getPreImageLines(preImage: string): string[] {
  const lines = preImage.split("\n");
  if (preImage.endsWith("\n")) {
    lines.pop();
  }
  return lines;
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

      let removedLines: string[] = [];
      let addedLines: string[] = [];
      let oldNoNewline = false;
      let newNoNewline = false;

      while (i < lines.length && lines[i].type !== "context") {
        if (lines[i].type === "removed") {
          removedLines.push(lines[i].content);
          oldNoNewline = lines[i].noNewline ?? false;
        } else {
          addedLines.push(lines[i].content);
          newNoNewline = lines[i].noNewline ?? false;
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

      const isLastEditInHunk = i >= lines.length || lines.slice(i).every(l => l.type === "context");
      const atFileStart = hunkIndex === 0 && edits.length === 0
        && hunk.oldStart === 1 && contextBefore.length === 0;
      const atFileEnd = hunkIndex === hunks.length - 1
        && isLastEditInHunk
        && contextAfter.length === 0
        && hunk.oldStart + hunk.oldCount - 1 >= totalPreImageLines;

      const preImageStartLine = preImageLine - 1;

      edits.push({
        type: editType,
        contextBefore,
        contextAfter,
        removedLines,
        addedLines,
        atFileStart,
        atFileEnd,
        preImageStartLine,
        oldNoNewline,
        newNoNewline,
      });

      contextBuffer = [...contextAfter];
      preImageLine += contextAfter.length;
      i = j;
    }
  }

  return edits;
}

function expandBlockAnchor({
  oldBlock,
  newBlock,
  contextBefore,
  contextAfter,
  preImage,
  preImageStartLine,
  oldBlockLineCount,
}: {
  oldBlock: string;
  newBlock: string;
  contextBefore: string[];
  contextAfter: string[];
  preImage: string;
  preImageStartLine: number;
  oldBlockLineCount: number;
}): { where: string; content: string } | null {
  // Step 1: Try full hunk context first
  const fullBefore = joinLines(contextBefore);
  const fullAfter = joinLines(contextAfter);
  const fullWhere = fullBefore + oldBlock + fullAfter;
  if (countOccurrences(preImage, fullWhere) === 1) {
    return { where: fullWhere, content: fullBefore + newBlock + fullAfter };
  }

  // Step 2: Expand from preImage beyond hunk context
  const preLines = getPreImageLines(preImage);
  const totalLines = preLines.length;
  const preEndsWithNewline = preImage.endsWith("\n");

  for (let exp = 1; exp <= MAX_PREIMAGE_EXPANSION; exp++) {
    const beforeStart = preImageStartLine - exp;
    const afterEnd = preImageStartLine + oldBlockLineCount + exp - 1;

    // Try expanding before only
    if (beforeStart >= 0) {
      const beforeCtx = preLines.slice(beforeStart, preImageStartLine);
      const where = joinLines(beforeCtx) + oldBlock;
      if (countOccurrences(preImage, where) === 1) {
        return { where, content: joinLines(beforeCtx) + newBlock };
      }
    }

    // Try expanding after only
    if (afterEnd < totalLines) {
      const afterCtx = preLines.slice(preImageStartLine + oldBlockLineCount, afterEnd + 1);
      const isLastLine = afterEnd === totalLines - 1 && !preEndsWithNewline;
      const afterStr = joinLines(afterCtx, isLastLine);
      const where = oldBlock + afterStr;
      if (countOccurrences(preImage, where) === 1) {
        return { where, content: newBlock + afterStr };
      }
    }

    // Try expanding both sides
    if (beforeStart >= 0 && afterEnd < totalLines) {
      const beforeCtx = preLines.slice(beforeStart, preImageStartLine);
      const afterCtx = preLines.slice(preImageStartLine + oldBlockLineCount, afterEnd + 1);
      const isLastLine = afterEnd === totalLines - 1 && !preEndsWithNewline;
      const afterStr = joinLines(afterCtx, isLastLine);
      const where = joinLines(beforeCtx) + oldBlock + afterStr;
      if (countOccurrences(preImage, where) === 1) {
        return { where, content: joinLines(beforeCtx) + newBlock + afterStr };
      }
    }
  }

  return null;
}

function expandInsertionAnchor({
  insertedContent,
  preImage,
  preImageStartLine,
}: {
  insertedContent: string;
  preImage: string;
  preImageStartLine: number;
}): Modification | null {
  const preLines = getPreImageLines(preImage);
  const totalLines = preLines.length;
  const preEndsWithNewline = preImage.endsWith("\n");

  // Try expanding before the insertion point (returns { after: ... } mod)
  for (let exp = 1; exp <= MAX_PREIMAGE_EXPANSION; exp++) {
    const beforeStart = preImageStartLine - exp;
    if (beforeStart < 0) break;

    const beforeCtx = preLines.slice(beforeStart, preImageStartLine);
    const lastIdx = preImageStartLine - 1;
    const isLastLine = lastIdx === totalLines - 1 && !preEndsWithNewline;
    const anchor = joinLines(beforeCtx, isLastLine);
    if (countOccurrences(preImage, anchor) === 1) {
      return { where: { after: anchor }, content: insertedContent };
    }
  }

  // Try expanding after the insertion point (returns { before: ... } mod)
  for (let exp = 1; exp <= MAX_PREIMAGE_EXPANSION; exp++) {
    const afterEnd = preImageStartLine + exp - 1;
    if (afterEnd >= totalLines) break;

    const afterCtx = preLines.slice(preImageStartLine, afterEnd + 1);
    const isLastLine = afterEnd === totalLines - 1 && !preEndsWithNewline;
    const anchor = joinLines(afterCtx, isLastLine);
    if (countOccurrences(preImage, anchor) === 1) {
      return { where: { before: anchor }, content: insertedContent };
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
  const {
    type, contextBefore, contextAfter, removedLines, addedLines,
    atFileStart, atFileEnd, preImageStartLine, oldNoNewline, newNoNewline,
  } = edit;

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

    const expanded = expandInsertionAnchor({
      insertedContent,
      preImage,
      preImageStartLine,
    });

    if (expanded !== null) {
      return { modification: expanded, warning: null };
    }

    return {
      modification: null,
      warning: "Could not find a unique anchor for insertion — manual review required",
    };
  }

  if (type === "deletion") {
    const oldContent = joinLines(removedLines, oldNoNewline);

    if (countOccurrences(preImage, oldContent) === 1) {
      return { modification: { where: oldContent, content: "" }, warning: null };
    }

    const expanded = expandBlockAnchor({
      oldBlock: oldContent,
      newBlock: "",
      contextBefore,
      contextAfter,
      preImage,
      preImageStartLine,
      oldBlockLineCount: removedLines.length,
    });

    if (expanded !== null) {
      return { modification: { where: expanded.where, content: expanded.content }, warning: null };
    }

    return {
      modification: null,
      warning: "Could not find a unique anchor for deletion — manual review required",
    };
  }

  const oldContent = joinLines(removedLines, oldNoNewline);
  const newContent = joinLines(addedLines, newNoNewline);

  if (countOccurrences(preImage, oldContent) === 1) {
    return { modification: { where: oldContent, content: newContent }, warning: null };
  }

  const expanded = expandBlockAnchor({
    oldBlock: oldContent,
    newBlock: newContent,
    contextBefore,
    contextAfter,
    preImage,
    preImageStartLine,
    oldBlockLineCount: removedLines.length,
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
  let preNoNewline = false;
  let postNoNewline = false;

  for (const line of hunk.lines) {
    if (line.type === "context") {
      preLines.push(line.content);
      postLines.push(line.content);
      preNoNewline = line.noNewline ?? false;
      postNoNewline = line.noNewline ?? false;
    } else if (line.type === "removed") {
      preLines.push(line.content);
      preNoNewline = line.noNewline ?? false;
    } else if (line.type === "added") {
      postLines.push(line.content);
      postNoNewline = line.noNewline ?? false;
    }
  }

  const where = joinLines(preLines, preNoNewline);
  const content = joinLines(postLines, postNoNewline);

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

  // Final fallback: keep mods that can be individually applied
  // (anchor exists and is unique at the point of application)
  const applicableMods: Modification[] = [];
  let current = preImage;

  for (const mod of modifications) {
    const applied = applyModificationSafe({ content: current, mod });
    if (applied !== null) {
      applicableMods.push(mod);
      current = applied;
    } else {
      warnings.push("Modification could not be applied — skipped, manual review required");
    }
  }

  if (current !== postImage) {
    warnings.push("Applied modifications do not fully reproduce the target — manual review required");
  }

  return { modifications: applicableMods, warnings };
}