import type { ExportMode } from "./settings";

const FIRST_PARA_PREFIX = "_ _ _ _ "; // 8 chars — bypasses Discord's leading whitespace stripping
const OTHER_PARA_PREFIX = "    ";      // 4 spaces — preserved by Discord mid-message

// ── Cleaning helpers ────────────────────────────────────────────────────────

/**
 * Strips YAML frontmatter (--- ... ---) from the top of the note.
 */
function stripFrontmatter(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---\n?/, "").trimStart();
}

/**
 * Strips {ignore blocks} — content wrapped in curly braces is removed entirely.
 * Used for inline annotations, image reminders, etc. that should not appear in
 * the Discord output. Supports multiline blocks.
 *   He looked serious {add image here} and then he stood up.
 *   → He looked serious  and then he stood up.
 */
function stripIgnoreBlocks(text: string): string {
  return text
    .replace(/\{[\s\S]*?\}/g, "")  // remove {…} blocks
    .replace(/[ \t]{2,}/g, " ")     // collapse leftover double spaces on a line
    .replace(/\n{3,}/g, "\n\n")     // collapse triple+ blank lines
    .trim();
}

/**
 * Strips lines that consist only of Obsidian tags (e.g. "#roleplay #writing").
 */
function stripTags(text: string): string {
  return text
    .replace(/^(#[\w/-]+\s*)+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Removes standalone horizontal rules (---).
 */
function stripHorizontalRules(text: string): string {
  return text
    .replace(/^---$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Full cleaning pipeline applied in both modes.
 */
function cleanText(text: string): string {
  let t = stripFrontmatter(text);
  t = stripIgnoreBlocks(t);
  t = stripTags(t);
  t = stripHorizontalRules(t);
  return t;
}

// ── Chunking ────────────────────────────────────────────────────────────────

/**
 * Packs a single segment of text into chunks that fit within charLimit.
 * Each call starts fresh (isFirstInChunk = true), so forced segments from
 * breakpoints always open a new chunk with the correct first-para prefix.
 */
function packSegment(segment: string, charLimit: number, mode: ExportMode): string[] {
  const paragraphs = segment
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let currentLines: string[] = [];
  let currentLength = 0;
  let isFirstInChunk = true;

  for (const para of paragraphs) {
    // Pre-compute indented form to measure size before deciding whether to flush
    const indentedPara = mode === "indent"
      ? para
          .split("\n")
          .map((line, i) => (i === 0 && isFirstInChunk ? FIRST_PARA_PREFIX : OTHER_PARA_PREFIX) + line)
          .join("\n")
      : para;

    const separator = currentLines.length > 0 ? 2 : 0;
    const addedLength = indentedPara.length + separator;

    if (currentLines.length > 0 && currentLength + addedLength > charLimit) {
      // Flush current chunk and start a new one
      chunks.push(currentLines.join("\n\n"));
      currentLines = [];
      currentLength = 0;
      isFirstInChunk = true;
    }

    // Re-compute after potential flush (isFirstInChunk may have changed)
    const finalPara = mode === "indent"
      ? para
          .split("\n")
          .map((line, i) => (i === 0 && isFirstInChunk ? FIRST_PARA_PREFIX : OTHER_PARA_PREFIX) + line)
          .join("\n")
      : para;

    const sep = currentLines.length > 0 ? 2 : 0;
    currentLines.push(finalPara);
    currentLength += finalPara.length + sep;
    isFirstInChunk = false;
  }

  if (currentLines.length > 0) {
    chunks.push(currentLines.join("\n\n"));
  }

  return chunks;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Processes a raw note into an array of Discord-ready chunks.
 *
 * Special syntax supported in the note:
 *   {text}   — ignore block: stripped entirely from output (inline notes, image reminders, etc.)
 *   +++      — breakpoint: forces a new chunk at this point regardless of character count
 *             (must be on its own line)
 */
export function processNote(rawText: string, charLimit: number, mode: ExportMode): string[] {
  const text = cleanText(rawText);

  // Split on +++ breakpoints (standalone line, optional surrounding whitespace)
  const segments = text
    .split(/^[ \t]*\+\+\+[ \t]*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Pack each segment independently — breakpoints guarantee segment boundaries
  // become chunk boundaries
  return segments.flatMap((segment) => packSegment(segment, charLimit, mode));
}
