import { findNvim, attach } from "neovim";
import * as child_process from "node:child_process";

export default class Neovim {
  instance: ReturnType<typeof attach> | undefined;
  process: ReturnType<typeof child_process["spawn"]> | undefined;
  settings: EditInNeovimSettings;
  nvimBinary: ReturnType<typeof findNvim>["matches"][number];

  constructor(settings: EditInNeovimSettings) {
    this.settings = settings;
    this.nvimBinary = findNvim({ orderBy: "desc", minVersion: "0.9.0" }).matches[0];
  }

  getBuffers = async () => {
    if (!this.instance) return Promise.resolve([]);

    return this.instance.buffers;
  }

  async newInstance(adapter: FileSystemAdapter, file?: TFile | null) {
    if (this.process) return;

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
    await this.openFile(file);
  };

  openFile = async (file: TFile | null) => {
    if (!file) return;
    if (!this.settings.supportedFileTypes.includes(file.extension)) return;

    // Prevents us from re-opening a buffer that already exists in the buffer list
    // This does include potentially unloaded buffers, might need to check for that
    const buffers = await this.getBuffers()
    console.log(buffers);
    if (buffers.some(buf => buf.name().contains(file.path))) return;

    child_process.spawn(this.nvimBinary.path, [
      "--server",
      this.settings.listenOn,
      "--remote",
      `${file.path}`,
    ]);
  };

  close = () => {
    if (this.process?.disconnect) {
      this.process.disconnect();
    }

    this.instance?.quit();
  };
}
