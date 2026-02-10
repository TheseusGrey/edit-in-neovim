import { TFile, FileSystemAdapter, Notice } from "obsidian";
import { findNvim, attach } from "neovim";
import { EditInNeovimSettings } from "./Settings";
import * as child_process from "node:child_process";
import { isPortInUse, searchForBinary, searchDirs, configureProcessSpawnArgs, SpawnProcessOptions } from "./utils";

export default class Neovim {
  instance: ReturnType<typeof attach> | undefined;
  process: ReturnType<(typeof child_process)["spawn"]> | undefined;
  settings: EditInNeovimSettings;
  nvimBinary: ReturnType<typeof findNvim>["matches"][number] | undefined;
  termBinary: string | undefined;
  tmuxBinary: string | undefined;
  adapter: FileSystemAdapter;
  apiKey: string | undefined;
  private startedVia: "terminal" | "tmux" | "unknown" = "unknown";

  constructor(settings: EditInNeovimSettings, adapter: FileSystemAdapter, apiKey: string | undefined) {
    this.adapter = adapter;
    this.settings = settings;
    this.apiKey = apiKey;
    this.termBinary = searchForBinary(settings.terminal);
    this.tmuxBinary = searchForBinary("tmux");
    this.nvimBinary = undefined;

    if (!this.termBinary) {
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
    if (!this.nvimBinary || this.nvimBinary?.path === "") {
      new Notice("No path to valid nvim binary has been found, skipping command", 5000)
      return;
    }

    const extraEnvVars: Record<string, string> = {}
    if (this.apiKey) extraEnvVars["OBSIDIAN_REST_API_KEY"] = this.apiKey
    if (this.settings.appname !== "") extraEnvVars["NVIM_APPNAME"] = this.settings.appname

    if (this.settings.hostMode === "tmux") {
      await this.spawnWithTmux(adapter, extraEnvVars);
      return;
    }

    if (this.process) {
      new Notice("edit-in-neovim:\nInstance already running", 5000);
      return;
    }

    if (!this.termBinary) {
      new Notice("Terminal undefined, skipping command", 5000)
      return;
    }

    const terminalName = this.termBinary.split('\\').pop()?.toLowerCase() || '';
    const defaultSpawnOptions: SpawnProcessOptions = {
      spawnArgs: [],
      cwd: adapter.getBasePath(),
      env: { ...process.env, ...extraEnvVars },
      shell: false,
      detached: false,
    };

    const spawnOptions = configureProcessSpawnArgs(defaultSpawnOptions, terminalName, this.termBinary, this.nvimBinary.path, this.settings.listenOn);

    console.debug(`Attempting to spawn process:
      Platform: ${process.platform}
      Executable: ${this.termBinary}
      Arguments: ${JSON.stringify(spawnOptions.spawnArgs)}
      Options: ${JSON.stringify(spawnOptions)}`);

    try {
      this.startedVia = "terminal";
      this.process = child_process.spawn(this.termBinary, spawnOptions.spawnArgs, spawnOptions);

      if (!this.process || this.process.pid === undefined) {
        new Notice("Failed to create Neovim process", 5000);
        this.process = undefined;
        return;
      }

      console.debug(`Neovim process running, PID: ${this.process.pid}`);

      this.process?.on("error", (err) => {
        new Notice("edit-in-neovim:\nNeovim ran into a error, see logs for details");
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
          new Notice(`Failed to establish RPC connection: ${error.message}`, 7000);
          this.close();
        }
      }, 1500);
    } catch (error) {
      console.error("Error caught during child_process.spawn call itself:", error);
      new Notice(`Error trying to spawn Neovim: ${error.message}`, 10000);
      this.process = undefined;
      this.instance = undefined;
    }

  }

  private async tmuxHasSession(sessionName: string): Promise<boolean> {
    if (!this.tmuxBinary) return false;
    try {
      child_process.execFileSync(this.tmuxBinary, ["has-session", "-t", sessionName], { stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  private spawnTerminalToAttachTmux(sessionName: string) {
    if (!this.termBinary) return;
    if (!this.tmuxBinary) return;
    if (process.platform === "win32") return;

    // Best-effort: most terminals on Unix support `-e <cmd...>`.
    try {
      child_process.spawn(
        this.termBinary,
        ["-e", this.tmuxBinary, "attach", "-t", sessionName],
        {
          cwd: this.adapter.getBasePath(),
          env: process.env,
          detached: true,
          stdio: "ignore",
        },
      );
    } catch (e) {
      console.error("Failed to spawn terminal to attach tmux:", e);
    }
  }

  private async spawnWithTmux(adapter: FileSystemAdapter, extraEnvVars: Record<string, string>) {
    if (process.platform === "win32") {
      new Notice("edit-in-neovim:\ntmux host mode is not supported on Windows by this plugin.", 7000);
      return;
    }

    if (!this.tmuxBinary) {
      new Notice("edit-in-neovim:\nCould not find tmux on PATH. Install tmux or switch host mode back to 'nvim'.", 10000);
      return;
    }

    const sessionName = (this.settings.tmuxSessionName || "obsidian").trim();
    if (!sessionName) {
      new Notice("edit-in-neovim:\nInvalid tmux session name.", 7000);
      return;
    }

    const exists = await this.tmuxHasSession(sessionName);
    if (exists) {
      new Notice(`edit-in-neovim:\ntmux session '${sessionName}' already exists`, 3000);
      if (this.settings.tmuxAttachOnStart) this.spawnTerminalToAttachTmux(sessionName);
      this.startedVia = "tmux";
      return;
    }

    // If listenOn is TCP and already in use, tmux-hosted nvim will fail to bind.
    const listenAddr = this.settings.listenOn;
    const colonIdx = listenAddr.lastIndexOf(":");
    const portStr = colonIdx > 0 ? listenAddr.substring(colonIdx + 1) : "";
    const isTcpListen = colonIdx > 0 && /^\d+$/.test(portStr) && !listenAddr.startsWith("/");
    if (isTcpListen) {
      try {
        if (await isPortInUse(portStr)) {
          new Notice(
            `edit-in-neovim:\n${this.settings.listenOn} is already in use, so tmux-hosted Neovim can't bind to it.\n\nStop the existing Neovim server or choose a different listen address.`,
            12000,
          );
          return;
        }
      } catch (e) {
        console.error("Failed to check port:", e);
      }
    }

    const envPairs = Object.entries(extraEnvVars).flatMap(([k, v]) => [`${k}=${v}`]);
    const args = [
      "new-session",
      "-d",
      "-s",
      sessionName,
      "-c",
      adapter.getBasePath(),
      "env",
      ...envPairs,
      this.nvimBinary!.path,
      "--listen",
      this.settings.listenOn,
    ];

    console.debug(`Starting tmux-hosted Neovim:
      tmux: ${this.tmuxBinary}
      args: ${JSON.stringify(args)}`);

    try {
      child_process.execFileSync(this.tmuxBinary, args, { stdio: "ignore" });
      this.startedVia = "tmux";
      new Notice(`Neovim running in tmux session '${sessionName}'`, 4000);
      if (this.settings.tmuxAttachOnStart) this.spawnTerminalToAttachTmux(sessionName);
    } catch (e) {
      console.error("Failed to start tmux session:", e);
      new Notice("edit-in-neovim:\nFailed to start tmux session (see logs).", 10000);
    }
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

  onObsidianQuit = () => {
    if (this.startedVia === "tmux" && this.settings.tmuxKeepAliveOnQuit) {
      // Intentionally do not kill the tmux session.
      return;
    }
    this.close();
  };

  close = () => {
    if (this.startedVia === "tmux") {
      const sessionName = (this.settings.tmuxSessionName || "obsidian").trim();
      if (!this.tmuxBinary) {
        new Notice("edit-in-neovim:\nDisconnected from tmux-hosted Neovim (tmux not found).", 5000);
        return;
      }
      try {
        child_process.execFileSync(this.tmuxBinary, ["kill-session", "-t", sessionName], { stdio: "ignore" });
        new Notice(`edit-in-neovim:\nKilled tmux session '${sessionName}'.`, 4000);
      } catch (e) {
        console.error("Failed to kill tmux session:", e);
        new Notice(`edit-in-neovim:\nFailed to kill tmux session '${sessionName}' (see logs).`, 10000);
      }
      this.startedVia = "unknown";
      return;
    }

    this.process?.kill();
    this.instance?.quit();

    this.instance = undefined;
    this.process = undefined;

    new Notice("edit-in-neovim:\nNeovim instance closed.", 3000);
  };
}
