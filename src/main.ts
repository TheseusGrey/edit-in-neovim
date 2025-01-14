import {
  FileSystemAdapter,
  Plugin,
  Notice,
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
    await this.initNeovim();

    this.registerEvent(
      this.app.workspace.on("file-open", this.neovim.openFile),
    );
    this.registerEvent(
      this.app.workspace.on("quit", this.neovim?.close),
    );

    this.addSettingTab(new EditInNeovimSettingsTab(this.app, this));

    this.addCommand({
      id: "edit-in-neovim-new-instance",
      name: "Open Neovim",
      callback: async () => {
        const adapter = this.app.vault.adapter as FileSystemAdapter;
        await this.neovim
          .newInstance(adapter)
          .then(() => setTimeout(() => this.neovim.openFile(this.app.workspace.getActiveFile()), 1000));
      },
    });

    this.addCommand({
      id: "edit-in-neovim-close-instance",
      name: "Close Neovim",
      callback: async () => this.neovim.close,
    });
  }

  async initNeovim() {
    const adapter = this.app.vault.adapter as FileSystemAdapter;
    this.neovim = new Neovim(this.settings);
    if (this.settings.openNeovimOnLoad) {
      await this.neovim.newInstance(adapter);
    }
  }

  async updateNeovimInstance() {
    if (this.neovim) {
      await this.neovim.close();
      await this.initNeovim();
    }
  }

  onunload() {
    this.neovim?.close();
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
    const found = findNvim({ orderBy: "desc" });
    if (found.matches.length === 0) {
      new Notice("Edit In Neovim: No Valid nvim binary found T_T \n\n make sure neovim is installed and on your PATH", 5000);
    }
    if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
      new Notice("Edit In Neovim: unknown adapter, unable to access vault files", 5000);
    }
  }
}