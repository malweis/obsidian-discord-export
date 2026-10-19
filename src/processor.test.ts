import { test } from "node:test";
import assert from "node:assert/strict";
import { processNote } from "./processor";

const FIRST = "_ _ _ _ ";
const OTHER = "    ";

// ── Ignore blocks ───────────────────────────────────────────────────────────

void test("ignore block mid-sentence leaves a single space", () => {
  const [chunk] = processNote("He looked serious {add image here} and stood up.", 2000, "splitter");
  assert.equal(chunk, "He looked serious and stood up.");
});

void test("ignore block at start of a line leaves no leading space", () => {
  const [chunk] = processNote("Primera línea.\n{nota} —Dijo él.", 2000, "indent");
  assert.equal(chunk, `${FIRST}Primera línea.\n${OTHER}—Dijo él.`);
});

void test("ignore block at end of a line leaves no trailing space", () => {
  const [chunk] = processNote("Primera línea {nota}\nSegunda.", 2000, "splitter");
  assert.equal(chunk, "Primera línea\nSegunda.");
});

void test("ignore block on its own line removes the whole line", () => {
  const [chunk] = processNote("Uno.\n{imagen}\nDos.", 2000, "splitter");
  assert.equal(chunk, "Uno.\nDos.");
});

void test("multiline ignore block on its own lines removes them", () => {
  const [chunk] = processNote("Uno.\n{\n  mapa\n  ref.png\n}\nDos.", 2000, "splitter");
  assert.equal(chunk, "Uno.\nDos.");
});

void test("double spaces outside ignore blocks are preserved", () => {
  const [chunk] = processNote("Hola.  Dos espacios.", 2000, "splitter");
  assert.equal(chunk, "Hola.  Dos espacios.");
});

// ── Tags ────────────────────────────────────────────────────────────────────

void test("tag lines with accented characters are stripped", () => {
  const chunks = processNote("Texto.\n\n#canción #roleplay\n#historia/capítulo-1", 2000, "splitter");
  assert.deepEqual(chunks, ["Texto."]);
});

void test("headings are not mistaken for tags", () => {
  const [chunk] = processNote("# Capítulo 1\nTexto.", 2000, "splitter");
  assert.equal(chunk, "# Capítulo 1\nTexto.");
});

// ── Markdown structure lines ────────────────────────────────────────────────

void test("markdown structure lines are not indented by default", () => {
  const [chunk] = processNote("# Capítulo\nTexto.\n- item\n> cita\n1. uno\n-# sub", 2000, "indent");
  assert.equal(chunk, `# Capítulo\n${OTHER}Texto.\n- item\n> cita\n1. uno\n-# sub`);
});

void test("italics and dialogue are still indented", () => {
  const [chunk] = processNote("*Narración.*\n—Hola.", 2000, "indent");
  assert.equal(chunk, `${FIRST}*Narración.*\n${OTHER}—Hola.`);
});

void test("markdown structure lines are indented when indentMarkdown is on", () => {
  const [chunk] = processNote("# Capítulo\nTexto.", 2000, "indent", { indentMarkdown: true });
  assert.equal(chunk, `${FIRST}# Capítulo\n${OTHER}Texto.`);
});

// ── Oversized paragraphs ────────────────────────────────────────────────────

const sentence = (n: number) => `Frase número ${n} con algo de relleno para alargarla.`; // ~50 chars

void test("oversized paragraph is split at a sentence boundary within the limit", () => {
  const para = Array.from({ length: 60 }, (_, i) => sentence(i)).join(" ");
  const chunks = processNote(para, 2000, "indent");
  assert.ok(chunks.length >= 2, "should produce multiple chunks");
  for (const c of chunks) assert.ok(c.length <= 2000, `chunk too long: ${c.length}`);
  assert.ok(chunks[0].startsWith(FIRST));
  assert.ok(chunks[0].endsWith("."), "first piece should end at a sentence end");
  // Continuation has no indent and starts with the next sentence
  assert.ok(chunks[1].startsWith("Frase número"), `bad continuation: ${chunks[1].slice(0, 20)}`);
  // No text lost: rejoining the pieces gives back the paragraph
  assert.equal(chunks.map((c, i) => (i === 0 ? c.slice(FIRST.length) : c)).join(" "), para);
});

void test("oversized paragraph without sentence ends falls back to a word boundary", () => {
  const para = Array.from({ length: 500 }, () => "palabra").join(" "); // 3999 chars
  const chunks = processNote(para, 2000, "splitter");
  assert.ok(chunks.length >= 2);
  for (const c of chunks) {
    assert.ok(c.length <= 2000, `chunk too long: ${c.length}`);
    assert.ok(!c.startsWith(" ") && !c.endsWith(" "));
    assert.match(c, /^palabra( palabra)*$/);
  }
});

void test("oversized paragraph starts a fresh chunk and the next paragraph continues it", () => {
  const para = Array.from({ length: 60 }, (_, i) => sentence(i)).join(" ");
  const chunks = processNote(`Antes.\n${para}\nDespués.`, 2000, "indent");
  assert.equal(chunks[0], `${FIRST}Antes.`);
  assert.ok(chunks[1].startsWith(`${FIRST}Frase número 0`));
  const last = chunks[chunks.length - 1];
  assert.ok(last.endsWith(`\n${OTHER}Después.`), `last chunk: ${JSON.stringify(last.slice(-40))}`);
  assert.ok(!last.startsWith(" ") && !last.startsWith("_"), "continuation must not be indented");
});

void test("italics wrapping a split paragraph are closed and reopened", () => {
  const para = "*" + Array.from({ length: 60 }, (_, i) => sentence(i)).join(" ") + "*";
  const chunks = processNote(para, 2000, "splitter");
  assert.ok(chunks.length >= 2);
  for (const c of chunks) {
    assert.ok(c.length <= 2000);
    assert.ok(c.startsWith("*") && c.endsWith("*"), `unbalanced italics: ${c.slice(0, 10)}…${c.slice(-10)}`);
  }
});

// ── Unchanged behaviour ─────────────────────────────────────────────────────

void test("paragraphs pack up to exactly the limit", () => {
  const chunks = processNote("a".repeat(992) + "\n" + "b".repeat(995), 2000, "indent");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].length, 2000);
});

void test("+++ forces a new chunk", () => {
  const chunks = processNote("Uno.\n+++\nDos.", 2000, "indent");
  assert.deepEqual(chunks, [`${FIRST}Uno.`, `${FIRST}Dos.`]);
});
