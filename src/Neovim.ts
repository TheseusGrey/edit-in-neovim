import { TFile, FileSystemAdapter, Notice } from "obsidian";
import { findNvim, attach } from "neovim";
import { EditInNeovimSettings } from "./Settings";
import * as child_process from "node:child_process";

export default class Neovim {
  instance: ReturnType<typeof attach> | undefined;
  process: ReturnType<typeof child_process["spawn"]> | undefined;
  settings: EditInNeovimSettings;
  nvimBinary: ReturnType<typeof findNvim>["matches"][number];

  constructor(settings: EditInNeovimSettings) {
    this.settings = settings;
    if (this.settings.pathToBinary) this.nvimBinary = { path: this.settings.pathToBinary };
    else this.nvimBinary = findNvim({ orderBy: "desc" }).matches[0];
  }

  getBuffers = async () => {
    if (!this.instance) return Promise.resolve([]);

    return this.instance.buffers;
  }

  async newInstance(adapter: FileSystemAdapter, file?: TFile | null) {
    if (this.process) {
      new Notice("Linked Neovim instance already running", 5000);
return;
    }

    this.process = child_process.spawn(
      this.settings.terminal,
      ["-e", this.nvimBinary.path, "--listen", this.settings.listenOn],
      { cwd: adapter.getBasePath() },
    );

    this.process.on("exit", (code) => {
      this.process = undefined;
      this.instance = undefined;
    });

    this.instance = attach({ proc: this.process! });
  };

  openFile = async (file: TFile | null) => {
    if (!file) return;
    if (!this.settings.supportedFileTypes.includes(file.extension)) return;

    child_process.spawn(this.nvimBinary.path, [
      "--server",
      this.settings.listenOn,
      "--remote",
      `${file.path}`,
    ]);
  };

  close = () => {
    this.process?.kill();
    this.instance?.quit();
  };
}
