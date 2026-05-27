import { App, Modal } from "obsidian";
import { processNote } from "./processor";
import type { DiscordExportSettings, ExportMode } from "./settings";

export class DiscordExportModal extends Modal {
  private rawText: string;
  private settings: DiscordExportSettings;
  private currentMode: ExportMode;
  private currentLimit: 2000 | 4000;
  private copiedChunks: Set<number> = new Set();

  constructor(app: App, rawText: string, settings: DiscordExportSettings) {
    super(app);
    this.rawText = rawText;
    this.settings = settings;
    this.currentMode = settings.defaultMode;
    this.currentLimit = settings.charLimit;
  }

  onOpen(): void {
    this.modalEl.addClass("de-modal");
    this.render();
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("de-content");

    // ── Header ────────────────────────────────────────────────────────────
    const header = contentEl.createDiv({ cls: "de-header" });
    header.createEl("span", { text: "Discord Export", cls: "de-title" });

    const controls = header.createDiv({ cls: "de-controls" });

    // Mode segmented control
    const modeGroup = controls.createDiv({ cls: "de-seg-group" });
    modeGroup.createEl("span", { text: "Mode", cls: "de-seg-label" });
    const modeBtns = modeGroup.createDiv({ cls: "de-seg-btns" });
    for (const [val, label] of [["indent", "Indent"], ["splitter", "Splitter"]] as const) {
      const btn = modeBtns.createEl("button", {
        text: label,
        cls: "de-seg-btn" + (this.currentMode === val ? " is-active" : ""),
      });
      btn.addEventListener("click", () => { this.currentMode = val; this.render(); });
    }

    // Limit segmented control
    const limitGroup = controls.createDiv({ cls: "de-seg-group" });
    limitGroup.createEl("span", { text: "Limit", cls: "de-seg-label" });
    const limitBtns = limitGroup.createDiv({ cls: "de-seg-btns" });
    for (const [val, label] of [[2000, "2 000"], [4000, "4 000"]] as [number, string][]) {
      const btn = limitBtns.createEl("button", {
        text: label,
        cls: "de-seg-btn" + (this.currentLimit === val ? " is-active" : ""),
      });
      btn.addEventListener("click", () => { this.currentLimit = val as 2000 | 4000; this.render(); });
    }

    // ── Process ───────────────────────────────────────────────────────────
    const chunks = processNote(this.rawText, this.currentLimit, this.currentMode);

    if (chunks.length === 0) {
      const empty = contentEl.createDiv({ cls: "de-empty" });
      empty.createEl("span", { text: "Nothing to export — the note appears to be empty." });
      return;
    }

    // ── Chunk list ────────────────────────────────────────────────────────
    const list = contentEl.createDiv({ cls: "de-list" });

    chunks.forEach((chunk, index) => {
      const pct = chunk.length / this.currentLimit;
      const status: "safe" | "warning" | "overflow" =
        pct >= 1 ? "overflow" : pct >= 0.9 ? "warning" : "safe";
      const statusLabel = { safe: "Safe", warning: "Near limit", overflow: "Overflow" }[status];

      const card = list.createDiv({ cls: "de-card" });
      if (this.copiedChunks.has(index)) card.addClass("is-copied");

      // Card header
      const cardHead = card.createDiv({ cls: "de-card-head" });

      const left = cardHead.createDiv({ cls: "de-card-left" });
      left.createEl("span", { text: String(index + 1).padStart(2, "0"), cls: "de-chunk-num" });
      left.createEl("span", { text: statusLabel, cls: `de-badge de-badge--${status}` });

      const right = cardHead.createDiv({ cls: "de-card-right" });
      right.createEl("span", {
        text: `${chunk.length.toLocaleString()} / ${this.currentLimit.toLocaleString()}`,
        cls: "de-char-count",
      });

      const copyBtn = right.createEl("button", { cls: "de-copy-btn" });
      const alreadyCopied = this.copiedChunks.has(index);
      copyBtn.setText(alreadyCopied ? "✓ Copied" : "Copy");
      if (alreadyCopied) copyBtn.addClass("is-copied");

      copyBtn.addEventListener("click", async () => {
        await navigator.clipboard.writeText(chunk);
        this.copiedChunks.add(index);
        card.addClass("is-copied");
        copyBtn.addClass("is-copied");
        copyBtn.setText("✓ Copied");
      });

      // Preview div — plain div avoids all textarea CSS quirks
      const preview = card.createDiv({ cls: "de-preview" });
      preview.textContent = chunk;
    });

    // ── Footer ────────────────────────────────────────────────────────────
    const footer = contentEl.createDiv({ cls: "de-footer" });
    footer.createEl("span", {
      text: `${chunks.length} chunk${chunks.length !== 1 ? "s" : ""}`,
      cls: "de-footer-chunks",
    });
    footer.createEl("span", {
      text: `${this.rawText.length.toLocaleString()} chars in note`,
      cls: "de-footer-total",
    });
  }
}
