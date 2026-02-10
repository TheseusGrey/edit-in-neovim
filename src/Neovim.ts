import { TFile, FileSystemAdapter, Notice } from "obsidian";
import { findNvim, attach } from "neovim";
import { EditInNeovimSettings } from "./Settings";
import * as child_process from "node:child_process";
import * as net from "node:net";
import { isPortInUse, searchForBinary, searchDirs, configureProcessSpawnArgs, SpawnProcessOptions } from "./utils";

export default class Neovim {
  instance: ReturnType<typeof attach> | undefined;
  process: ReturnType<(typeof child_process)["spawn"]> | undefined;
  settings: EditInNeovimSettings;
  nvimBinary: ReturnType<typeof findNvim>["matches"][number] | undefined;
  termBinary: string | undefined;
  adapter: FileSystemAdapter;
  apiKey: string | undefined;

  constructor(settings: EditInNeovimSettings, adapter: FileSystemAdapter, apiKey: string | undefined) {
    this.adapter = adapter;
    this.settings = settings;
    this.apiKey = apiKey;
    this.termBinary = settings.terminal ? searchForBinary(settings.terminal) : undefined;
    this.nvimBinary = undefined;

    if (settings.terminal && !this.termBinary) {
      console.warn(`Could not find binary for ${settings.terminal}, double check it's on your PATH`)
    }

    if (this.settings.pathToBinary) {
      this.nvimBinary = { path: this.settings.pathToBinary, nvimVersion: "manual_path" };
      console.log(`Neovim Information:
  - Term Path: ${this.termBinary || "NOT FOUND"}
  - Nvim Path: ${this.nvimBinary.path}
  - Version: ${this.nvimBinary.nvimVersion}
  - Error: ${this.nvimBinary.error?.message}
`);
      return;
    }

    const foundNvimBinaries = findNvim({ orderBy: "desc", paths: searchDirs });
    if (foundNvimBinaries.matches.length > 0) {
      this.nvimBinary = foundNvimBinaries.matches[0];
      console.log(`Neovim Information:
  - Term Path: ${this.termBinary || "NOT FOUND"}
  - Nvim Path: ${this.nvimBinary.path}
  - Version: ${this.nvimBinary.nvimVersion}
  - Error: ${this.nvimBinary.error?.message}
`);
      return;
    }

    this.nvimBinary = { path: "", nvimVersion: undefined, error: new Error("Neovim binary not found, and no manual path specified") };
    console.warn("Using fallback neovim configuration, plugin will likely not function");

    if (!this.termBinary || !this.nvimBinary.nvimVersion || this.nvimBinary.error) {
      new Notice("edit-in-neovim:\nPotential issues in plugin config, check logs for more details", 5000);
    }
  }

  getBuffers = async () => {
    if (!this.instance) return [];

    try {
      return await this.instance.buffers;
    } catch (error) {
      new Notice(`edit-in-neovim:\nUnable to get Neovim buffers due to: ${error.message}`, 5000);
      return [];
    }
  };

  async newInstance(adapter: FileSystemAdapter) {
    if (this.process) {
      new Notice("edit-in-neovim:\nInstance already running", 5000);
      return;
    }

    if (!this.nvimBinary || this.nvimBinary?.path === "") {
      new Notice("No path to valid nvim binary has been found, skipping command", 5000)
      return;
    }

    const extraEnvVars: Record<string, string> = {}
    if (this.apiKey) extraEnvVars["OBSIDIAN_REST_API_KEY"] = this.apiKey
    if (this.settings.appname !== "") extraEnvVars["NVIM_APPNAME"] = this.settings.appname

    const useHeadless = !this.termBinary;

    if (useHeadless) {
      await this.spawnHeadless(adapter, extraEnvVars);
    } else {
      await this.spawnWithTerminal(adapter, extraEnvVars);
    }
  }

  private async spawnHeadless(adapter: FileSystemAdapter, extraEnvVars: Record<string, string>) {
    const spawnArgs = ['--headless', '--listen', this.settings.listenOn];

    console.debug(`Attempting to spawn headless Neovim:
      Executable: ${this.nvimBinary!.path}
      Arguments: ${JSON.stringify(spawnArgs)}`);

    try {
      this.process = child_process.spawn(this.nvimBinary!.path, spawnArgs, {
        cwd: adapter.getBasePath(),
        env: { ...process.env, ...extraEnvVars },
        stdio: 'ignore',
      });

      if (!this.process || this.process.pid === undefined) {
        new Notice("Failed to create Neovim process", 5000);
        this.process = undefined;
        return;
      }

      console.debug(`Neovim headless process running, PID: ${this.process.pid}`);
      this.registerProcessEvents();

      // Attach via socket after nvim starts
      setTimeout(async () => {
        try {
          const listenAddr = this.settings.listenOn;
          const colonIdx = listenAddr.lastIndexOf(':');
          if (colonIdx > 0) {
            const host = listenAddr.substring(0, colonIdx);
            const port = parseInt(listenAddr.substring(colonIdx + 1));
            const socket = net.createConnection({ host, port });
            this.instance = attach({ reader: socket, writer: socket });
          } else {
            this.instance = attach({ socket: listenAddr });
          }
          await this.instance.eval('1');
          console.debug("Neovim RPC connection test successful.");
          new Notice(`Neovim server started on ${this.settings.listenOn}\nConnect with: nvim --server ${this.settings.listenOn} --remote-ui`, 5000);
        } catch (error) {
          console.error("Neovim RPC connection failed after spawn:", error);
          new Notice(`Failed to connect to Neovim server: ${(error as Error).message}`, 7000);
          this.close();
        }
      }, 1500);
    } catch (error) {
      console.error("Error caught during child_process.spawn call itself:", error);
      new Notice(`Error trying to spawn Neovim: ${(error as Error).message}`, 10000);
      this.process = undefined;
      this.instance = undefined;
    }
  }

  private async spawnWithTerminal(adapter: FileSystemAdapter, extraEnvVars: Record<string, string>) {
    const terminalName = this.termBinary!.split('\\').pop()?.toLowerCase() || '';
    const defaultSpawnOptions: SpawnProcessOptions = {
      spawnArgs: [],
      cwd: adapter.getBasePath(),
      env: { ...process.env, ...extraEnvVars },
      shell: false,
      detached: false,
    };

    const spawnOptions = configureProcessSpawnArgs(defaultSpawnOptions, terminalName, this.termBinary!, this.nvimBinary!.path, this.settings.listenOn);

    console.debug(`Attempting to spawn process:
      Platform: ${process.platform}
      Executable: ${this.termBinary}
      Arguments: ${JSON.stringify(spawnOptions.spawnArgs)}
      Options: ${JSON.stringify(spawnOptions)}`);

    try {
      this.process = child_process.spawn(this.termBinary!, spawnOptions.spawnArgs, spawnOptions);

      if (!this.process || this.process.pid === undefined) {
        new Notice("Failed to create Neovim process", 5000);
        this.process = undefined;
        return;
      }

      console.debug(`Neovim process running, PID: ${this.process.pid}`);
      this.registerProcessEvents();

      console.debug("Attaching to Neovim process...")
      this.instance = attach({ proc: this.process! });

      setTimeout(async () => {
        if (!this.instance) return;
        try {
          await this.instance.eval('1');
          console.debug("Neovim RPC connection test successful.");
          new Notice("Neovim instance started and connected.", 3000);
        } catch (error) {
          console.error("Neovim RPC connection failed after spawn:", error);
          new Notice(`Failed to establish RPC connection: ${(error as Error).message}`, 7000);
          this.close();
        }
      }, 1500);
    } catch (error) {
      console.error("Error caught during child_process.spawn call itself:", error);
      new Notice(`Error trying to spawn Neovim: ${(error as Error).message}`, 10000);
      this.process = undefined;
      this.instance = undefined;
    }
  }

  private registerProcessEvents() {
    this.process?.on("error", (err) => {
      new Notice("edit-in-neovim:\nNeovim ran into an error, see logs for details");
      console.error(`Neovim process ran into an error: ${JSON.stringify(err, null, 2)}`);
      this.process = undefined;
      this.instance = undefined;
    });

    this.process?.on("close", (code) => {
      console.info(`nvim closed with code: ${code}`);
      this.process = undefined;
      this.instance = undefined;
    });

    this.process?.on("disconnect", () => {
      console.info("nvim disconnected");
      this.process = undefined;
      this.instance = undefined;
    });

    this.process?.on("exit", (code) => {
      console.info(`nvim closed with code: ${code}`);
      this.process = undefined;
      this.instance = undefined;
    });
  }

  openFile = async (file: TFile | null) => {
    if (!file) return;
    if (!this.nvimBinary?.path) return;

    const isExcalidrawMd = file.extension === "md" && file.path.endsWith(".excalidraw.md");
    let isSupported = this.settings.supportedFileTypes.includes(file.extension);

    isSupported = isSupported || (isExcalidrawMd && this.settings.supportedFileTypes.includes("excalidraw"))

    if (!isSupported) return;

    const port = this.settings.listenOn.split(':').at(-1);

    if (!(this.instance && this.process) && !port) {
      console.debug("No known neovim instance is running")
      return;
    };

    try {
      if (!(port && await isPortInUse(port))) {
        console.debug("Port is either missing, or nothing was listening on it, skipping command")
        return;
      }
    } catch (error) {
      console.error(`Error checking port ${port}: ${error.message}`)
    }

    const absolutePath = this.adapter.getFullPath(file.path);
    const args = ['--server', this.settings.listenOn, '--remote', absolutePath];

    console.debug(`Opening ${absolutePath} in neovim`);

    child_process.exec(
      `${this.nvimBinary?.path} --server ${this.settings.listenOn} --remote '${absolutePath}'`,
    );

    try {
      child_process.execFile(this.nvimBinary?.path, args, (error, stdout, stderr) => {
        if (error) {
          let noticeMessage = `edit-in-neovim:\nError opening file in Neovim: ${error.message}`;
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            noticeMessage = `edit-in-neovim:\nNeovim executable not found at: ${this.nvimBinary?.path}`;
          } else if (stderr && (stderr.includes('ECONNREFUSED') || stderr.includes('Connection refused'))) {
            noticeMessage = `edit-in-neovim:\nCould not connect to Neovim server at ${this.settings.listenOn}. Is it running?`;
          } else if (stderr && stderr.includes("No such file or directory") && stderr.includes(absolutePath)) {
            noticeMessage = `edit-in-neovim:\nNeovim server reported error finding file: ${file.basename}`;
          } else if (stderr) {
            noticeMessage = `edit-in-neovim:\nError opening file in Neovim: ${stderr.split('\n')[0]}`;
          }
          new Notice(noticeMessage, 10000);
          return;
        }

        if (stdout) console.log(`Neovim --remote stdout: ${stdout}`);
        if (stderr) console.warn(`Neovim --remote stderr: ${stderr}`);
      });
    } catch (execFileError) {
      console.error("Error opening file in neovim", execFileError);
      new Notice(`Failed to run Neovim command: ${execFileError.message}`, 10000);
    }

  };

  close = () => {
    this.process?.kill();
    this.instance?.quit();

    this.instance = undefined;
    this.process = undefined;

    new Notice("edit-in-neovim:\nNeovim instance closed.", 3000);
  };
}
