import { Editor, MarkdownView, Plugin } from "obsidian";
import { DiscordExportModal } from "./modal";
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
      id: "open-discord-export",
      name: "Export note to Discord",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        const rawText = editor.getValue();
        new DiscordExportModal(this.app, rawText, this.settings).open();
      },
    });

    this.addSettingTab(new DiscordExportSettingTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
