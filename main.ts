import {
  App,
  FileSystemAdapter,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
} from "obsidian";
import { findNvim } from "neovim";
import Neovim from "./src/Neovim.ts";

interface EditInNeovimSettings {
  terminal: string;
  listenOn: string;
  openNeovimOnLoad: boolean;
  supportedFileTypes: string[];
}

const DEFAULT_SETTINGS: EditInNeovimSettings = {
  terminal: process.env.TERMINAL || "alacritty",
  listenOn: "127.0.0.1:2006",
  openNeovimOnLoad: true,
  supportedFileTypes: ["txt", "md", "css", "js", "ts", "tsx", "jsx", "json"],
};

export default class EditInNeovim extends Plugin {
  settings: EditInNeovimSettings;
  neovim: Neovim;

  async onload() {
    await this.loadSettings();
    this.pluginChecks();

    this.neovim = new Neovim(this.settings);
    const adapter = this.app.vault.adapter;

    if (this.settings.openNeovimOnLoad) this.neovim.newInstance(adapter);

    console.log(
      "Edit in Neovim Loaded! will look for neovim listening at: " +
        this.settings.listenOn,
    );

    this.registerEvent(
      this.app.workspace.on("file-open", this.neovim.openFile),
    );

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new EditInNeovimSettingsTab(this.app, this));

    this.addCommand({
      id: "edit-in-neovim-new-instance",
      name: "Open Neovim",
      callback: async () => await this.neovim.newInstance(adapter, this.app.workspace.getActiveFile()),
    });
  }

  onunload() {
    if (this.neovim) this.neovim.close();
  }

  async loadSettings() {
    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      await this.loadData(),
    );
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  pluginChecks() {
    const found = findNvim({ orderBy: "desc", minVersion: "0.9.0" });

    if (found.matches.length === 0) {
      new Notice("Edit In Neovim: No Valid nvim binary found T_T \n make sure neovim is installed and on your PATH", 5000);
      throw Error(
        "No Valid nvim binaries :'( plugin can't run without them",
      );
    }

    if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
      new Notice("Edit In Neovim: unknown adapter, unable to access vault files", 5000);
      throw Error(
        "I need a FileSystemAdapter in order to work, are you running on mobile?",
      );
    }
  }
}

class EditInNeovimSettingsTab extends PluginSettingTab {
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
            this.plugin.settings.supportedFileTypes =
              value.split(" ");
            await this.plugin.saveSettings();
          }),
      );
  }
}
