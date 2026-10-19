import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import { DiscordExportModal, ExportSource } from "./modal";
import {
  DEFAULT_SETTINGS,
  DiscordExportSettings,
  DiscordExportSettingTab,
} from "./settings";

export default class DiscordExportPlugin extends Plugin {
  settings: DiscordExportSettings;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "export-note",
      name: "Export note to Discord",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.openExport(editor.getValue(), "note");
      },
    });

    // Always available (rather than hidden without a selection) so running it
    // from a hotkey with nothing selected can explain itself instead of doing nothing.
    this.addCommand({
      id: "export-selection",
      name: "Export selection to Discord",
      editorCallback: (editor: Editor) => {
        const selection = editor.getSelection();
        if (selection.trim().length === 0) {
          new Notice("Nothing selected, select some text to export.");
          return;
        }
        this.openExport(selection, "selection");
      },
    });

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor) => {
        const selection = editor.getSelection();
        if (selection.trim().length === 0) return;
        menu.addItem((item) =>
          item
            .setTitle("Export selection to Discord")
            .setIcon("send")
            .onClick(() => this.openExport(selection, "selection"))
        );
      })
    );

    this.addSettingTab(new DiscordExportSettingTab(this.app, this));
  }

  private openExport(rawText: string, source: ExportSource) {
    new DiscordExportModal(this.app, rawText, this.settings, source).open();
  }

  onunload() {}

  async loadSettings() {
    const saved = (await this.loadData()) as Partial<DiscordExportSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
