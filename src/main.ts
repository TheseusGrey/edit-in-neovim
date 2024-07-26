import {
  App,
  FileSystemAdapter,
  Plugin,
  PluginSettingTab,
  Notice,
  Setting,
  TFile,
} from "obsidian";
import { findNvim } from "neovim";
import Neovim from "./Neovim";
import EditInNeovimSettingsTab, { EditInNeovimSettings, DEFAULT_SETTINGS } from "./Settings";

export default class EditInNeovim extends Plugin {
  settings: EditInNeovimSettings;
  neovim: Neovim;

  async onload() {
    await this.loadSettings();
    this.pluginChecks();

    this.neovim = new Neovim(this.settings);
    const adapter = this.app.vault.adapter;

    if (this.settings.openNeovimOnLoad) this.neovim.newInstance(adapter);

    this.registerEvent(
      this.app.workspace.on("file-open", this.neovim.openFile),
    );

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new EditInNeovimSettingsTab(this.app, this));

    // TODO: Find a way to open a file here that doesn't rely on fixed wait time
    this.addCommand({
      id: "edit-in-neovim-new-instance",
      name: "Open Neovim",
      callback: async () => await this.neovim
        .newInstance(adapter)
        .then(() => setTimeout(() => this.neovim.openFile(this.app.workspace.getActiveFile()), 1000)),
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

