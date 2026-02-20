import { FileSystemAdapter, Plugin } from "obsidian";
import { findNvim } from "neovim";
import Neovim from "./Neovim";
import EditInNeovimSettingsTab, {
  EditInNeovimSettings,
  DEFAULT_SETTINGS,
} from "./Settings";
import { notify } from "./utils";
import Host from "./system/Host";
import { platform } from "process";
import { MacOS } from "./system/Mac";
import { Windows } from "./system/Windows";
import { Linux } from "./system/Linux";

export default class EditInNeovim extends Plugin {
  settings: EditInNeovimSettings;
  neovim: Neovim;
  host: Host;

  async onload() {
    await this.loadSettings();
    this.pluginChecks();

    const adapter = this.app.vault.adapter as FileSystemAdapter;

    switch (platform) {
      case "darwin":
        this.host = new MacOS(adapter, this.settings, { restAPIKey: this.restAPIEnabled() });
        break;
      case "win32":
        this.host = new Windows(adapter, this.settings, { restAPIKey: this.restAPIEnabled() });
        break;
      case "linux":
        this.host = new Linux(adapter, this.settings, { restAPIKey: this.restAPIEnabled() });
        break;
    }

    this.neovim = new Neovim(
      this.settings,
      adapter,
      { searchPaths: Array.from(this.host.getSearchPaths()) }
    );



    if (this.settings.openNeovimOnLoad) this.host.newInstance(this.neovim, adapter);

    this.registerEvent(
      this.app.workspace.on("file-open", f => this.neovim.openFile(f, this.host))
    );

    this.registerEvent(this.app.workspace.on("quit", this.neovim?.close));

    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new EditInNeovimSettingsTab(this.app, this));

    // TODO: Find a way to open a file here that doesn't rely on fixed wait time
    this.addCommand({
      id: "edit-in-neovim-new-instance",
      name: "Open Neovim",
      callback: async () =>
        await this.host
          .newInstance(this.neovim, adapter)
          .then(() =>
            setTimeout(
              () => this.neovim.openFile(this.app.workspace.getActiveFile(), this.host),
              1000
            )
          ),
    });

    this.addCommand({
      id: "edit-in-neovim-close-instance",
      name: "Close Neovim",
      callback: async () => this.host.close,
    });

    this.addCommand({
      id: "edit-in-neovim-open-file",
      name: "Open File",
      callback: async () =>
        this.neovim.openFile(this.app.workspace.getActiveFile(), this.host),
    });

  }

  onunload() {
    this.host.close();
    this.neovim.close();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  pluginChecks() {
    const found = findNvim({ orderBy: "desc" });

    if (found.matches.length === 0) {
      notify("No Valid nvim binary found T_T \n\n make sure neovim is installed and on your PATH");
    }

    if (!(this.app.vault.adapter instanceof FileSystemAdapter)) {
      notify("unknown adapter, unable to access vault files");
    }
  }

  restAPIEnabled(): string | undefined {
    // @ts-ignore
    const plugins = this.app.plugins.plugins
    if (Object.keys(plugins).contains("obsidian-local-rest-api")) {
      return plugins["obsidian-local-rest-api"].settings.apiKey
    }
    return undefined
  }
}
