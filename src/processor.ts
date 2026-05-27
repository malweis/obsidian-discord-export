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
  const lines = segment.split("\n");

  const chunks: string[] = [];
  let currentLines: string[] = [];
  let currentLength = 0;
  let isFirstInChunk = true;

  function applyPrefix(raw: string): string {
    if (mode !== "indent" || raw.trim().length === 0) return raw;
    return (isFirstInChunk ? FIRST_PARA_PREFIX : OTHER_PARA_PREFIX) + raw;
  }

  function flush() {
    // Trim trailing blank lines before saving the chunk
    let end = currentLines.length;
    while (end > 0 && currentLines[end - 1].trim() === "") end--;
    if (end > 0) chunks.push(currentLines.slice(0, end).join("\n"));
    currentLines = [];
    currentLength = 0;
    isFirstInChunk = true;
  }

  for (const raw of lines) {
    const isBlank = raw.trim().length === 0;
    const candidate = applyPrefix(raw);
    const sep = currentLines.length > 0 ? 1 : 0;

    // Only flush at non-blank lines — never cut in the middle of blank space
    if (!isBlank && currentLines.length > 0 && currentLength + candidate.length + sep > charLimit) {
      flush();
    }

    // Re-apply prefix after potential flush (isFirstInChunk may have changed)
    const final = applyPrefix(raw);
    const s = currentLines.length > 0 ? 1 : 0;
    currentLines.push(final);
    currentLength += final.length + s;
    if (!isBlank) isFirstInChunk = false;
  }

  flush();

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
  const text = cleanText(rawText.replace(/\r\n/g, "\n"));

  // Split on +++ breakpoints (standalone line, optional surrounding whitespace)
  const segments = text
    .split(/^[ \t]*\+\+\+[ \t]*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Pack each segment independently — breakpoints guarantee segment boundaries
  // become chunk boundaries
  return segments.flatMap((segment) => packSegment(segment, charLimit, mode));
}
