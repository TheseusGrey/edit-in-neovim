import { App, PluginSettingTab, Setting } from "obsidian";
import EditInNeovim from "./main";
import Neovim from "./Neovim";

export interface EditInNeovimSettings {
  /**
   * How Neovim is hosted:
   * - "nvim": current behavior (spawn Neovim directly; terminal if configured, otherwise headless)
   * - "tmux": spawn/ensure a tmux session running Neovim, and talk to it via --server/--remote
   */
  hostMode: "nvim" | "tmux";
  terminal: string;
  listenOn: string;
  openNeovimOnLoad: boolean;
  supportedFileTypes: string[];
  pathToBinary: string;
  appname: string;
  tmuxSessionName: string;
  tmuxAttachOnStart: boolean;
  tmuxKeepAliveOnQuit: boolean;
}

export const DEFAULT_SETTINGS: EditInNeovimSettings = {
  hostMode: "nvim",
  terminal: process.env.TERMINAL || "",
  listenOn: "127.0.0.1:2006",
  openNeovimOnLoad: true,
  supportedFileTypes: ["txt", "md", "css", "js", "ts", "tsx", "jsx", "json"],
  pathToBinary: "",
  appname: "",
  tmuxSessionName: "edit-in-neovim",
  tmuxAttachOnStart: false,
  tmuxKeepAliveOnQuit: true,
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
      .setName("Neovim host mode")
      .setDesc(
        "Choose how Neovim is hosted. 'nvim' uses Neovim's built-in client/server. 'tmux' runs Neovim inside a tmux session (useful for OSC52 clipboard workflows).",
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("nvim", "nvim (client/server)")
          .addOption("tmux", "tmux session")
          .setValue(this.plugin.settings.hostMode)
          .onChange(async (value) => {
            this.plugin.settings.hostMode = value as EditInNeovimSettings["hostMode"];
            await this.plugin.saveSettings();
            this.display(); // Re-render to show/hide mode-specific settings
          }),
      );

    if (this.plugin.settings.hostMode === "tmux") {
      new Setting(containerEl)
        .setName("tmux session name")
        .setDesc("The tmux session to create/reuse for hosting Neovim.")
        .addText((text) =>
          text
            .setPlaceholder("edit-in-neovim")
            .setValue(this.plugin.settings.tmuxSessionName)
            .onChange(async (value) => {
              this.plugin.settings.tmuxSessionName = value.trim() || DEFAULT_SETTINGS.tmuxSessionName;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName("Attach tmux on start")
        .setDesc(
          "If enabled, the plugin will try to open a terminal and run 'tmux attach' when starting the tmux-hosted Neovim.",
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.tmuxAttachOnStart)
            .onChange(async (value) => {
              this.plugin.settings.tmuxAttachOnStart = value;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName("Keep tmux session alive on quit")
        .setDesc(
          "If enabled, quitting Obsidian will only disconnect the plugin and leave the tmux-hosted Neovim running.",
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.tmuxKeepAliveOnQuit)
            .onChange(async (value) => {
              this.plugin.settings.tmuxKeepAliveOnQuit = value;
              await this.plugin.saveSettings();
            }),
        );
    }

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
      .setName("NVIM_APPNAME")
      .setDesc(
        "If you have a specific neovim distro you'd like to use (lazyvim for example), leave blank to use your default neovim config.",
      )
      .addText((text) =>
        text
          .setPlaceholder("lazyvim, my_writing_config, etc.")
          .setValue(this.plugin.settings.appname)
          .onChange(async (value) => {
            this.plugin.settings.appname = value;
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
