import { TFile, FileSystemAdapter } from "obsidian";
import { findNvim, attach } from "neovim";
import { EditInNeovimSettings } from "./Settings";
import * as child_process from "node:child_process";
import * as net from "node:net";
import { notify } from "./utils";
import Host from "./system/Host";

type NeovimOptions = {
  searchPaths: string[];
};

export default class Neovim {
  instance: ReturnType<typeof attach> | undefined;
  settings: EditInNeovimSettings;
  nvimBinary: ReturnType<typeof findNvim>["matches"][number] | undefined;
  adapter: FileSystemAdapter;

  constructor(
    settings: EditInNeovimSettings,
    adapter: FileSystemAdapter,
    options?: NeovimOptions,
  ) {
    this.adapter = adapter;
    this.settings = settings;
    this.nvimBinary = undefined;

    if (this.settings.binaryPath) {
      this.nvimBinary = {
        path: this.settings.binaryPath,
        nvimVersion: "manual_path",
      };
      console.log(`Neovim Information:
  - Nvim Path: ${this.nvimBinary.path}
  - Version: ${this.nvimBinary.nvimVersion}
  - Error: ${this.nvimBinary.error?.message}
`);
      return;
    }

    const foundNvimBinaries = findNvim({
      orderBy: "desc",
      paths: options?.searchPaths,
    });
    if (foundNvimBinaries.matches.length > 0) {
      this.nvimBinary = foundNvimBinaries.matches[0];
      console.log(`Neovim Information:
  - Nvim Path: ${this.nvimBinary.path}
  - Version: ${this.nvimBinary.nvimVersion}
  - Error: ${this.nvimBinary.error?.message}
`);
      return;
    }

    this.nvimBinary = {
      path: "",
      nvimVersion: undefined,
      error: new Error("Neovim binary not found, and no manual path specified"),
    };
    console.warn(
      "Using fallback neovim configuration, plugin will likely not function",
    );

    if (!this.nvimBinary.nvimVersion || this.nvimBinary.error) {
      notify("Potential issues in plugin config, check logs for more details");
    }
  }

  attach(host: Host) {
    if (this.instance) return;

    try {
      if (host.process) {
        this.instance = attach({ proc: host.process });
        console.debug("Connecting to plugin managed process");
      } else {
        const listenAddr = this.settings.listenOn;
        const colonIdx = listenAddr.lastIndexOf(":");
        if (colonIdx > 0) {
          const host = listenAddr.substring(0, colonIdx);
          const port = parseInt(listenAddr.substring(colonIdx + 1));
          const socket = net.createConnection({ host, port });
          this.instance = attach({ reader: socket, writer: socket });
        } else {
          this.instance = attach({ socket: listenAddr });
        }
      }

      setTimeout(async () => {
        if (!this.instance) return;
        try {
          await this.instance.eval("1");
          console.debug("Neovim RPC connection test successful.");
          notify("Neovim instance started and connected.", 3000);
        } catch (error) {
          console.error("Neovim RPC connection failed after spawn:", error);
          notify(`Failed to establish RPC connection: ${error.message}`, 7000);
          this.close();
        }
      }, 1500);
    } catch (error) {
      console.error(
        "Error caught during child_process.spawn call itself:",
        error,
      );
      notify(`Error trying to spawn Neovim: ${error.message}`, 10000);
      this.instance = undefined;
    }
  }

  async getBuffers() {
    if (!this.instance) return [];

    try {
      return await this.instance.buffers;
    } catch (error) {
      notify(`Unable to get Neovim buffers due to: ${error.message}`);
      return [];
    }
  }

  async openFile(file: TFile | null, host: Host) {
    if (!file) return;
    if (!this.nvimBinary) return;

    const isExcalidrawMd =
      file.extension === "md" && file.path.endsWith(".excalidraw.md");
    let isSupported = this.settings.supportedFileTypes.includes(file.extension);

    isSupported =
      isSupported ||
      (isExcalidrawMd &&
        this.settings.supportedFileTypes.includes("excalidraw"));

    if (!isSupported) return;

    const port = this.settings.listenOn.split(":").at(-1);

    try {
      if (!(port && (await host.isPortInUse(port)))) {
        console.debug(
          "Port is either missing, or nothing was listening on it, skipping command",
        );
        return;
      }
    } catch (error) {
      console.error(`Error checking port ${port}: ${error.message}`);
    }

    const absolutePath = this.adapter.getFullPath(file.path);
    const args = ["--server", this.settings.listenOn, "--remote", absolutePath];

    console.debug(`Opening ${absolutePath} in neovim`);

    try {
      child_process.execFile(
        this.nvimBinary?.path,
        args,
        (error, stdout, stderr) => {
          if (error) {
            let noticeMessage = `Error opening file in Neovim: ${error.message}`;
            if ((error as NodeJS.ErrnoException).code === "ENOENT") {
              noticeMessage = `Neovim executable not found at: ${this.nvimBinary?.path}`;
            } else if (
              stderr &&
              (stderr.includes("ECONNREFUSED") ||
                stderr.includes("Connection refused"))
            ) {
              noticeMessage = `Could not connect to Neovim server at ${this.settings.listenOn}. Is it running?`;
            } else if (
              stderr &&
              stderr.includes("No such file or directory") &&
              stderr.includes(absolutePath)
            ) {
              noticeMessage = `Neovim server reported error finding file: ${file.basename}`;
            } else if (stderr) {
              noticeMessage = `Error opening file in Neovim: ${stderr.split("\n")[0]}`;
            }
            notify(noticeMessage, 10000);
            return;
          }

          if (stdout) console.log(`Neovim --remote stdout: ${stdout}`);
          if (stderr) console.warn(`Neovim --remote stderr: ${stderr}`);
        },
      );
    } catch (execFileError) {
      console.error("Error opening file in neovim", execFileError);
      notify(`Failed to run Neovim command: ${execFileError.message}`, 10000);
    }
  }

  close() {
    this.instance?.quit();
    this.instance = undefined;

    notify("Neovim connection closed.", 3000);
  }
}
