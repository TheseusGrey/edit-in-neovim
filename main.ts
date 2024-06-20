import { App, Editor, FileSystemAdapter, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';
import { findNvim, attach, } from 'neovim'
import * as child_process from 'node:child_process'

// Remember to rename these classes and interfaces!

interface EditInNeovimSettings {
	mySetting: string;
	terminal: string;
}

const DEFAULT_SETTINGS: EditInNeovimSettings = {
	mySetting: 'default',
	terminal: process.env.TERMINAL || "alacritty",
}

export default class EditInNeovim extends Plugin {
	settings: EditInNeovimSettings;

	async onload() {
		await this.loadSettings();
		const adapter = this.app.vault.adapter;
		console.log("Edit in Neovim Loaded!")
		const found = findNvim({ orderBy: 'desc', minVersion: '0.9.0' })

		if (!(adapter instanceof FileSystemAdapter)) return;
		child_process.spawn(this.settings.terminal, [
			'-e',
			found.matches[0].path,
			"--listen",
			"127.0.0.1:6000",
		], { cwd: adapter.getBasePath() })

		this.app.workspace.on("file-open", file => {
			if (!file) return;
			console.log(`Opening ${adapter.getFullPath(file.path)} in neovim`)
			child_process.spawn(found.matches[0].path, [
				'--embed',
				'--server', '127.0.0.1:6000',
				'--remote',
				`${file.path}`
			])
		})

		//const nvim_proc = child_process.spawn(found.matches[0].path, ['--clean', '--embed', '--listen', '127.0.0.1:6000'], {});

		// This command is how we "push" a new buffer to an instance running using --listen
		// "$nvim_exec" --server "$server_path" --remote-send "<C-\><C-n>:n $1<CR>:call cursor($2)<CR>"
		//const nvim = attach({ proc: nvim_proc });


		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'Sample Plugin', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('This is a notice!');
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'open-sample-modal-simple',
			name: 'Open sample modal (simple)',
			callback: () => {
				new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: EditInNeovim;

	constructor(app: App, plugin: EditInNeovim) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
