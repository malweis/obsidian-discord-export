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
 *   → He looked serious and then he stood up.
 * Only whitespace touching a block is cleaned up; a block that fills its whole
 * line removes the line.
 */
function stripIgnoreBlocks(text: string): string {
  return text
    .replace(/[ \t]*\{[\s\S]*?\}[ \t]*(\n?)/g, (match: string, newline: string, offset: number, whole: string) => {
      const before = whole[offset - 1];
      const atLineStart = before === undefined || before === "\n";
      const atLineEnd = newline === "\n" || offset + match.length === whole.length;
      if (atLineStart) return "";        // drops the whole line when the block fills it
      if (atLineEnd) return newline;     // drop trailing whitespace, keep the line break
      return /^[ \t]|[ \t]$/.test(match) ? " " : "";
    })
    .replace(/\n{3,}/g, "\n\n")     // collapse triple+ blank lines
    .trim();
}

/**
 * Strips lines that consist only of Obsidian tags (e.g. "#roleplay #writing").
 */
function stripTags(text: string): string {
  return text
    .replace(/^(#[\p{L}\p{N}_/-]+\s*)+$/gmu, "")
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

export interface ProcessOptions {
  /** Also indent Markdown structure lines (headings, lists, quotes). Off by default. */
  indentMarkdown?: boolean;
}

/**
 * Lines Discord renders as Markdown structure only when the marker starts the line:
 * headings, -# subtext, bullet/numbered lists and quotes.
 */
const MARKDOWN_LINE = /^\s*(#{1,6}\s|-#\s|[-*+]\s|\d+[.)]\s|>)/;

/** Sentence end: terminal punctuation plus any closing quotes/markers, followed by whitespace. */
const SENTENCE_END = /[.!?…]+["'”»)*_]*(?=\s)/g;

/** True when the text has an unclosed single `*` (italics), ignoring `**` bold markers. */
function hasOpenItalics(text: string): boolean {
  return (text.match(/(?<!\*)\*(?!\*)/g) ?? []).length % 2 === 1;
}

/**
 * Finds where to cut `text` so the first piece is at most `room` chars:
 * after the last sentence end that fits, else at the last space, else hard cut.
 */
function findCut(text: string, room: number): number {
  const window = text.slice(0, room + 1); // +1 so the lookahead can see the char after a sentence end
  let best = -1;
  SENTENCE_END.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SENTENCE_END.exec(window)) !== null) {
    const end = m.index + m[0].length;
    if (end <= room) best = end;
  }
  if (best > 0) return best;
  const space = window.lastIndexOf(" ", room);
  return space > 0 ? space : room;
}

/**
 * Packs a single segment of text into chunks that fit within charLimit.
 * Each call starts fresh (isFirstInChunk = true), so forced segments from
 * breakpoints always open a new chunk with the correct first-para prefix.
 */
function packSegment(segment: string, charLimit: number, mode: ExportMode, options: ProcessOptions): string[] {
  const lines = segment.split("\n");

  const chunks: string[] = [];
  let currentLines: string[] = [];
  let currentLength = 0;
  let isFirstInChunk = true;

  function prefixFor(raw: string): string {
    if (mode !== "indent" || raw.trim().length === 0) return "";
    if (!options.indentMarkdown && MARKDOWN_LINE.test(raw)) return "";
    return isFirstInChunk ? FIRST_PARA_PREFIX : OTHER_PARA_PREFIX;
  }

  function push(line: string, isBlank: boolean) {
    currentLength += line.length + (currentLines.length > 0 ? 1 : 0);
    currentLines.push(line);
    if (!isBlank) isFirstInChunk = false;
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

  /**
   * Splits a paragraph too long for any single chunk across several chunks.
   * Continuation pieces get no indent (they're mid-paragraph), and italics cut
   * mid-span are closed at the end of a piece and reopened in the next.
   */
  function pushOversized(raw: string) {
    let prefix = prefixFor(raw);
    let reopen = "";
    let rest = raw;
    while (prefix.length + reopen.length + rest.length > charLimit) {
      const room = Math.max(1, charLimit - prefix.length - reopen.length - 1); // -1 reserves a closing "*"
      const cut = findCut(rest, room);
      let piece = reopen + rest.slice(0, cut).trimEnd();
      rest = rest.slice(cut).trimStart();
      reopen = "";
      if (hasOpenItalics(piece)) {
        piece += "*";
        reopen = "*";
      }
      push(prefix + piece, false);
      flush();
      prefix = "";
    }
    push(prefix + reopen + rest, false);
  }

  for (const raw of lines) {
    const isBlank = raw.trim().length === 0;
    const sep = currentLines.length > 0 ? 1 : 0;

    // Only flush at non-blank lines — never cut in the middle of blank space
    if (!isBlank && currentLines.length > 0 && currentLength + sep + prefixFor(raw).length + raw.length > charLimit) {
      flush();
    }

    // Re-compute prefix after potential flush (isFirstInChunk may have changed)
    const line = prefixFor(raw) + raw;
    if (line.length > charLimit) pushOversized(raw);
    else push(line, isBlank);
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
export function processNote(
  rawText: string,
  charLimit: number,
  mode: ExportMode,
  options: ProcessOptions = {}
): string[] {
  const text = cleanText(rawText.replace(/\r\n/g, "\n"));

  // Split on +++ breakpoints (standalone line, optional surrounding whitespace)
  const segments = text
    .split(/^[ \t]*\+\+\+[ \t]*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Pack each segment independently — breakpoints guarantee segment boundaries
  // become chunk boundaries
  return segments.flatMap((segment) => packSegment(segment, charLimit, mode, options));
}
