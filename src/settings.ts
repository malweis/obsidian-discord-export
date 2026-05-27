import { App, PluginSettingTab, Setting } from "obsidian";
import type DiscordExportPlugin from "./main";

export type ExportMode = "indent" | "splitter";

export interface DiscordExportSettings {
  charLimit: 2000 | 4000;
  defaultMode: ExportMode;
}

export const DEFAULT_SETTINGS: DiscordExportSettings = {
  charLimit: 2000,
  defaultMode: "indent",
};

export class DiscordExportSettingTab extends PluginSettingTab {
  plugin: DiscordExportPlugin;

  constructor(app: App, plugin: DiscordExportPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Character limit")
      .setDesc("Maximum characters per Discord message. Use 4000 if you have Nitro.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("2000", "2000 (default)")
          .addOption("4000", "4000 (Nitro)")
          .setValue(String(this.plugin.settings.charLimit))
          .onChange(async (value) => {
            this.plugin.settings.charLimit = Number(value) as 2000 | 4000;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Default mode")
      .setDesc(
        "Indent mode adds paragraph indentation for creative writing. Splitter mode just splits the text into chunks with no indentation."
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("indent", "Indent (creative writing)")
          .addOption("splitter", "Splitter (chunks only)")
          .setValue(this.plugin.settings.defaultMode)
          .onChange(async (value) => {
            this.plugin.settings.defaultMode = value as ExportMode;
            await this.plugin.saveSettings();
          })
      );
  }
}
