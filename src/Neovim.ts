import { TFile, FileSystemAdapter, Notice } from "obsidian";
import { findNvim, attach } from "neovim";
import { EditInNeovimSettings } from "./Settings";
import * as child_process from "node:child_process";
import * as os from "node:os";
import { isPortInUse } from "./utils";

export default class Neovim {
  instance: ReturnType<typeof attach> | undefined;
  process: ReturnType<(typeof child_process)["spawn"]> | undefined;
  settings: EditInNeovimSettings;
  nvimBinary: ReturnType<typeof findNvim>["matches"][number];

  constructor(settings: EditInNeovimSettings) {
    this.settings = settings;
    if (this.settings.pathToBinary)
      this.nvimBinary = { path: this.settings.pathToBinary };
    else this.nvimBinary = findNvim({ orderBy: "desc" }).matches[0];

    // We can let the user know about any edge cases when it comes to finding neovim here :)
    if (this.nvimBinary.path && !this.nvimBinary.nvimVersion) {
      new Notice(`Could not find neovim at the given path: ${this.nvimBinary.path}, this could be due to:

- A custom path that doesn't point to a directory containing a neovim binary
- The directory containing neovim is not on your PATH
`);

    }
    if (this.nvimBinary.error) {
      console.log(`Failed to find nvim binary due to: ${this.nvimBinary.error}`);
    } else {
      console.log(`Neovim Information:
  - Path: ${this.nvimBinary.path}
  - Version: ${this.nvimBinary.nvimVersion}
  - Error: ${this.nvimBinary.error}
`);
    }

  }

  getBuffers = async () => {
    if (!this.instance) return Promise.resolve([]);

    return this.instance.buffers;
  };

  async newInstance(adapter: FileSystemAdapter, file?: TFile | null) {
    if (this.process) {
      new Notice("Linked Neovim instance already running", 5000);
      return;
    }

    this.process = child_process.spawn(
      this.settings.terminal,
      ["-e", this.nvimBinary.path, "--listen", this.settings.listenOn],
      { cwd: adapter.getBasePath(), shell: os.userInfo().shell || undefined },
    );

    this.process?.on("error", (err) => {
      this.process = undefined;
      this.instance = undefined;
    });

    this.process?.on("close", (code) => {
      this.process = undefined;
      this.instance = undefined;
    });

    this.process?.on("disconnect", () => {
      this.process = undefined;
      this.instance = undefined;
    });

    this.process?.on("exit", (code) => {
      this.process = undefined;
      this.instance = undefined;
    });

    this.instance = attach({ proc: this.process! });
  }

  openFile = async (file: TFile | null) => {
    if (!file) return;
    if (
      !this.settings.supportedFileTypes.includes(file.extension) ||
      // condition for the excalidraw filetype
      (file.extension == "md" &&
        !this.settings.supportedFileTypes.includes("excalidraw") &&
        file.name.endsWith(".excalidraw"))
    )
      return;
    if (!this.instance) {
      const port = this.settings.listenOn.split(":").at(-1);
      if (!port) return;
      if (!(await isPortInUse(port))) return;
    }

    child_process.exec(
      `${this.nvimBinary.path} --server ${this.settings.listenOn} --remote '${file.path}'`,
    );
  };

  close = () => {
    this.process?.kill();
    this.instance?.quit();
  };
}
