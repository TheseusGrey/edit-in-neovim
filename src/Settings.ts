import { App, PluginSettingTab, Setting } from "obsidian";
import EditInNeovim from "./main";
import Neovim from "./Neovim";

export interface EditInNeovimSettings {
  terminal: string;
  listenOn: string;
  openNeovimOnLoad: boolean;
  supportedFileTypes: string[];
  pathToBinary: string;
}

export const DEFAULT_SETTINGS: EditInNeovimSettings = {
  terminal: process.env.TERMINAL || "alacritty",
  listenOn: "127.0.0.1:2006",
  openNeovimOnLoad: true,
  supportedFileTypes: ["txt", "md", "css", "js", "ts", "tsx", "jsx", "json"],
  pathToBinary: "",
};

export default class EditInNeovimSettingsTab extends PluginSettingTab {
  plugin: EditInNeovim;
  neovim: Neovim;

  constructor(app: App, plugin: EditInNeovim) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("Terminal")
      .setDesc(
        "Which terminal emulator should I try and use for the neovim instance?",
      )
      .addText((text) =>
        text
          .setPlaceholder("E.g. alacritty, kitty, wezterm...")
          .setValue(this.plugin.settings.terminal)
          .onChange(async (value) => {
            this.plugin.settings.terminal = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Neovim server location")
      .setDesc(
        "The Neovim instance will be spawned using --listen and needs a socket or IP:PORT (not sure if sockets work so use at your own risk)",
      )
      .addText((text) =>
        text
          .setPlaceholder("127.0.0.1:2006")
          .setValue(this.plugin.settings.listenOn)
          .onChange(async (value) => {
            this.plugin.settings.listenOn = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Path to Neovim binary")
      .setDesc(
        "Manual override for detecting nvim binary. It's recommended you add nvim to your PATH instead. (requires reload)",
      )
      .addText((text) =>
        text
          .setPlaceholder("/path/to/nvim-bin/nvim")
          .setValue(this.plugin.settings.pathToBinary)
          .onChange(async (value) => {
            this.plugin.settings.pathToBinary = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Open on startup")
      .setDesc("Open the Neovim instance when Obsidian opens")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openNeovimOnLoad)
          .onChange(async (value) => {
            this.plugin.settings.openNeovimOnLoad = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Supported file types")
      .setDesc(
        "Which file extensions do you want this extension to try and open?",
      )
      .addText((text) =>
        text
          .setPlaceholder(
            "Filetypes should be separated by spaces and not include the '.', E.g. 'txt md css html'",
          )
          .setValue(this.plugin.settings.supportedFileTypes.join(" "))
          .onChange(async (value) => {
            this.plugin.settings.supportedFileTypes = value.split(" ");
            await this.plugin.saveSettings();
          }),
      );
  }
}
