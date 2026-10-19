import { App, PluginSettingTab, Setting, SettingDefinitionItem } from "obsidian";
import type DiscordExportPlugin from "./main";

export type ExportMode = "indent" | "splitter";

export interface DiscordExportSettings {
  charLimit: 2000 | 4000;
  defaultMode: ExportMode;
  indentMarkdown: boolean;
}

export const DEFAULT_SETTINGS: DiscordExportSettings = {
  charLimit: 2000,
  defaultMode: "indent",
  indentMarkdown: false,
};

type SettingKey = keyof DiscordExportSettings;

// Shared by the declarative definitions (Obsidian 1.13+) and the display() fallback
const TEXT = {
  charLimit: {
    name: "Character limit",
    desc: "Maximum characters per Discord message. Use 4000 if you have Nitro.",
    options: { "2000": "2000 (default)", "4000": "4000 (Nitro)" },
  },
  defaultMode: {
    name: "Default mode",
    desc: "Indent mode adds paragraph indentation for creative writing. Splitter mode just splits the text into chunks with no indentation.",
    options: { indent: "Indent (creative writing)", splitter: "Splitter (chunks only)" },
  },
  indentMarkdown: {
    name: "Indent Markdown lines",
    desc: "In Indent mode, also indent headings (#), lists (-, 1.) and quotes (>). Off by default, since indenting them stops Discord from rendering them.",
  },
};

export class DiscordExportSettingTab extends PluginSettingTab {
  plugin: DiscordExportPlugin;

  constructor(app: App, plugin: DiscordExportPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // ── Obsidian 1.13+: declarative settings (also indexed by settings search) ──

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        ...TEXT.charLimit,
        control: { type: "dropdown", key: "charLimit", options: TEXT.charLimit.options },
      },
      {
        ...TEXT.defaultMode,
        control: { type: "dropdown", key: "defaultMode", options: TEXT.defaultMode.options },
      },
      {
        ...TEXT.indentMarkdown,
        control: { type: "toggle", key: "indentMarkdown" },
      },
    ];
  }

  // Dropdowns work with strings, so charLimit is converted to and from a number here
  getControlValue(key: string): unknown {
    const value = this.plugin.settings[key as SettingKey];
    return key === "charLimit" ? String(value) : value;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const settings = this.plugin.settings;
    if (key === "charLimit") settings.charLimit = Number(value) as 2000 | 4000;
    else if (key === "defaultMode") settings.defaultMode = value as ExportMode;
    else if (key === "indentMarkdown") settings.indentMarkdown = Boolean(value);
    await this.plugin.saveSettings();
  }

  // ── Fallback for Obsidian < 1.13 (not called when getSettingDefinitions returns items) ──

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName(TEXT.charLimit.name)
      .setDesc(TEXT.charLimit.desc)
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(TEXT.charLimit.options)
          .setValue(String(this.plugin.settings.charLimit))
          .onChange((value) => this.setControlValue("charLimit", value))
      );

    new Setting(containerEl)
      .setName(TEXT.defaultMode.name)
      .setDesc(TEXT.defaultMode.desc)
      .addDropdown((dropdown) =>
        dropdown
          .addOptions(TEXT.defaultMode.options)
          .setValue(this.plugin.settings.defaultMode)
          .onChange((value) => this.setControlValue("defaultMode", value))
      );

    new Setting(containerEl)
      .setName(TEXT.indentMarkdown.name)
      .setDesc(TEXT.indentMarkdown.desc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.indentMarkdown)
          .onChange((value) => this.setControlValue("indentMarkdown", value))
      );
  }
}
