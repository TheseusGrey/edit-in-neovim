// @ts-ignore
import systeminformation from "systeminformation";

import * as child_process from "node:child_process";
import { FileSystemAdapter } from "obsidian";
import Neovim from "src/Neovim";
import { EditInNeovimSettings } from "src/Settings";
import { notify, verifyPath } from "src/utils";
import { platform } from "node:process";
import { isAbsolute, join } from "node:path";

type HostOptions = {
  restAPIKey?: string,
};

type SpawnProcessOptions = child_process.SpawnOptionsWithoutStdio & {
  spawnArgs: string[],
}

export default class Host {
  adapter: FileSystemAdapter;
  settings: EditInNeovimSettings;
  hostBinary: string | undefined;
  process: ReturnType<(typeof child_process)["spawn"]> | undefined;
  processOptions: SpawnProcessOptions;
  options: HostOptions | undefined;



  constructor(adapter: FileSystemAdapter, settings: EditInNeovimSettings, options?: HostOptions) {
    this.adapter = adapter;
    this.settings = settings;
    this.options = options;
    this.hostBinary = this.searchForBinary(settings.terminalPath);

  }

  searchForBinary(name: string): string | undefined {
    if (isAbsolute(name)) {
      return verifyPath(name);
    }

    const paths = this.getSearchPaths();
    const allPaths = [...paths].map(p => join(p, name))

    for (const path of allPaths) {
      const verifiedPath = verifyPath(path);
      if (verifiedPath) {
        return verifiedPath;
      }
    }

    return undefined;
  }

  async newInstance(neovim: Neovim, adapter: FileSystemAdapter) {
    if (this.process) {
      notify("edit-in-neovim:\nInstance already running", 5000);
      return;
    }

    if (!this.hostBinary) {
      notify("Terminal undefined, skipping", 5000)
      return;
    }

    // Replace with proper check
    if (!neovim.nvimBinary) {
      notify("No path to valid nvim binary has been found, skipping command", 5000)
      return;
    }

    const extraEnvVars: Record<string, string> = {}
    if (this.options?.restAPIKey) extraEnvVars["OBSIDIAN_REST_API_KEY"] = this.options.restAPIKey
    if (this.settings.appname !== "") extraEnvVars["NVIM_APPNAME"] = this.settings.appname

    const spawnOptions = this.configureHostArgs(neovim.nvimBinary?.path, {
      spawnArgs: [],
      cwd: adapter.getBasePath(),
      env: { ...process.env, ...extraEnvVars },
      shell: false,
      detached: false,
    })

    console.debug(`Attempting to spawn process:
      Platform: ${process.platform}
      Executable: ${this.hostBinary}
      Arguments: ${JSON.stringify(spawnOptions.spawnArgs)}
      Options: ${JSON.stringify(spawnOptions)}`);

    try {
      this.process = child_process.spawn(this.hostBinary, spawnOptions.spawnArgs, spawnOptions);

      if (!this.process || this.process.pid === undefined) {
        notify("Failed to create Neovim process", 5000);
        this.process = undefined;
        return;
      }

      console.debug(`Neovim process running, PID: ${this.process.pid}`);

      this.process?.on("error", (err) => {
        notify("edit-in-neovim:\nNeovim ran into a error, see logs for details");
        console.error(`Neovim process ran into an error: ${JSON.stringify(err, null, 2)}`);
        this.process = undefined;
        neovim.close();
      });

      this.process?.on("close", (code) => {
        console.info(`nvim closed with code: ${code}`);
        this.process = undefined;
        neovim.close();
      });

      this.process?.on("disconnect", () => {
        console.info("nvim disconnected");
        this.process = undefined;
        neovim.close();
      });

      this.process?.on("exit", (code) => {
        console.info(`nvim closed with code: ${code}`);
        this.process = undefined;
        neovim.close();
      });

      console.debug("Attaching to Neovim process...")

      setTimeout(async () => {
        if (!neovim) return;
        try {
          // await neovim.eval('1');
          console.debug("Neovim RPC connection test successful.");
          notify("Neovim instance started and connected.", 3000);
        } catch (error) {
          console.error("Neovim RPC connection failed after spawn:", error);
          notify(`Failed to establish RPC connection: ${error.message}`, 7000);
          neovim.close();
        }
      }, 1500);
    } catch (error) {
      console.error("Error caught during child_process.spawn call itself:", error);
      notify(`Error trying to spawn Neovim: ${error.message}`, 10000);
      this.process = undefined;
      neovim.close();
    }
  }

  async isPortInUse(port: string) {
    const networkConnections = await systeminformation.networkConnections();

    return networkConnections.find((networkConnection: { localPort: string; }): boolean => {
      return networkConnection.localPort === String(port);
    }) !== undefined;
  }

  configureHostArgs(_neovimPath: string, _defaults: SpawnProcessOptions): SpawnProcessOptions {
    notify(`edit-in-neovim: Unrecognised OS (${platform})`, 10000);
    throw new Error(`Unable to get search paths, unrecognised OS: ${platform}`);
  }


  getSearchPaths(): Set<string> {
    notify(`edit-in-neovim: Unrecognised OS (${platform})`, 10000);
    throw new Error(`Unable to get search paths, unrecognised OS: ${platform}`);
  }

  close = () => {
    this.process?.kill();
    this.process = undefined;

    notify("edit-in-neovim:\nClosing host process.");
  };
}

