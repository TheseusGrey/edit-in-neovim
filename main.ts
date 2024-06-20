import { App, FileSystemAdapter, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { findNvim, } from 'neovim'
import * as child_process from 'node:child_process'
import { NvimVersion } from 'neovim/lib/utils/findNvim';


interface EditInNeovimSettings {
	terminal: string;
	listenOn: string;
	openNeovimOnLoad: boolean;
}

const DEFAULT_SETTINGS: EditInNeovimSettings = {
	terminal: process.env.TERMINAL || "xterm",
	listenOn: "127.0.0.1:2006",
	openNeovimOnLoad: true,
}

export default class EditInNeovim extends Plugin {
	settings: EditInNeovimSettings;

	spawnNewInstanceOnLoad(nvim: NvimVersion, adapter: FileSystemAdapter) {
		child_process.spawn(this.settings.terminal, [
			'-e',
			nvim.path,
			"--listen",
			this.settings.listenOn,
		], { cwd: adapter.getBasePath() })
	}

	openInNeovimInstance(file: TFile | null) {
		if (!file) return;
		if (!(this.app.vault.adapter instanceof FileSystemAdapter)) return;

		const found = findNvim({ orderBy: 'desc', minVersion: '0.9.0' });

		console.log(`Opening ${this.app.vault.adapter.getFullPath(file.path)} in neovim`)
		child_process.spawn(found.matches[0].path, [
			'--server', this.settings.listenOn,
			'--remote',
			`${file.path}`
		])
	}

	async onload() {
		await this.loadSettings();
		const adapter = this.app.vault.adapter;
		console.log("Edit in Neovim Loaded! listening on: " + this.settings.listenOn)
		const found = findNvim({ orderBy: 'desc', minVersion: '0.9.0' })
		if (found.matches.length === 0) throw Error("No Valid nvim binaries :'( plugin can't run without them");

		if (!(adapter instanceof FileSystemAdapter)) throw Error("I need a FileSystemAdapter in order to work, are you running on mobile?");

		if (this.settings.openNeovimOnLoad) this.spawnNewInstanceOnLoad(found.matches[0], adapter)

		this.app.workspace.on("file-open", this.openInNeovimInstance)

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new EditInNeovimSettingsTab(this.app, this));

		// Plan would be to ask for the path to the file you want to open here
		// this.addCommand({
		// id: 'edit-in-neovim-open',
		// name: 'Open In Neovim',
		// editorCallback: (editor: Editor, view: MarkdownView) => {
		// console.log(editor.getSelection());
		// editor.replaceSelection('Sample Editor Command');
		// }
		// });
	}

	onunload() {
		this.app.workspace.off("file-open", this.openInNeovimInstance)
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class EditInNeovimSettingsTab extends PluginSettingTab {
	plugin: EditInNeovim;

	constructor(app: App, plugin: EditInNeovim) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Terminal')
			.setDesc('Which terminal emulator should I try and use for the neovim instance?')
			.addText(text => text
				.setPlaceholder('E.g. alacritty, kitty, wezterm...')
				.setValue(this.plugin.settings.terminal)
				.onChange(async (value) => {
					this.plugin.settings.terminal = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Neovim Server Location')
			.setDesc('The Neovim instance will be spawned using --listen and needs a socket or IP:PORT (not sure if sockets work so use at your own risk)')
			.addText(text => text
				.setPlaceholder('127.0.0.1:2006')
				.setValue(this.plugin.settings.listenOn)
				.onChange(async value => {
					this.plugin.settings.listenOn = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Open on startup')
			.setDesc('Open the Neovim instance when Obsidian opens')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.openNeovimOnLoad)
				.onChange(async value => {
					this.plugin.settings.openNeovimOnLoad = value;
					await this.plugin.saveSettings();
				}));
	}
}
