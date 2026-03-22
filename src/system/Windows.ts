import { normalize } from "node:path";
import Host, { SpawnProcessOptions } from "./Host";

export class Windows extends Host {
  configureHostArgs(
    neovimPath: string,
    defaults: SpawnProcessOptions,
  ): SpawnProcessOptions {
    if (defaults.headless) return this.configureHeadlessArgs(defaults);

    const terminalName =
      this.hostBinary?.split("\\").pop()?.toLowerCase() || "";

    switch (terminalName) {
      case "wt.exe":
        console.debug(
          `edit-in-neovim:\nProcess spawn config for windows terminal: ${JSON.stringify(defaults, null, 2)}`,
        );
        return {
          ...defaults,
          spawnArgs: [
            "new-tab",
            "--title",
            "Neovim",
            neovimPath,
            "--listen",
            this.settings.listenOn,
          ],
        };
      case "cmd.exe":
        console.debug(
          `edit-in-neovim:\nProcess spawn config for ${terminalName}: ${JSON.stringify(defaults, null, 2)}`,
        );
        return {
          ...defaults,
          spawnArgs: [
            "/c",
            "start",
            `"Neovim"`,
            `"${neovimPath}"`,
            "--listen",
            this.settings.listenOn,
          ],
          shell: true,
        };
      case "powershell.exe":
      case "pwsh.exe":
        const command = `Start-Process -FilePath '${neovimPath}' -ArgumentList '--listen ${this.settings.listenOn}' -WindowStyle Normal`;
        console.debug(
          `edit-in-neovim:\nProcess spawn config for powershell: ${JSON.stringify(defaults, null, 2)}`,
        );
        return {
          ...defaults,
          spawnArgs: [
            "-ExecutionPolicy",
            "Bypass",
            "-NoProfile",
            "-NoExit",
            "-Command",
            command,
          ],
          shell: true,
        };
      default: // alacritty, wezterm, kitty, etc.
        console.debug(
          `edit-in-neovim:\nProcess spawn config for windows and ${terminalName}: ${JSON.stringify(defaults, null, 2)}`,
        );
        return {
          ...defaults,
          spawnArgs: ["-e", neovimPath, "--listen", this.settings.listenOn],
        };
    }
  }

  getSearchPaths(): Set<string> {
    const paths = new Set<string>();
    const { USERPROFILE, LOCALAPPDATA, PROGRAMFILES } = process.env;

    // Scoop common install location
    if (USERPROFILE) {
      paths.add(Windows.normalizePath(`${USERPROFILE}/scoop/shims`));
    }
    paths.add(Windows.normalizePath("C:/ProgramData/scoop/shims"));

    // Winget common install location
    // See https://github.com/microsoft/winget-cli/blob/master/doc/specs/%23182%20-%20Support%20for%20installation%20of%20portable%20standalone%20apps.md
    if (LOCALAPPDATA) {
      paths.add(Windows.normalizePath(`${LOCALAPPDATA}/Microsoft/WindowsApps`));
      paths.add(
        Windows.normalizePath(`${LOCALAPPDATA}/Microsoft/WinGet/Packages`),
      );
    }
    if (PROGRAMFILES) {
      paths.add(Windows.normalizePath(`${PROGRAMFILES}/WinGet/Packages`));
      paths.add(Windows.normalizePath(`${PROGRAMFILES} (x86)/WinGet/Packages`));
    }

    return paths;
  }

  private static normalizePath(path: string): string {
    return normalize(path.toLowerCase());
  }
}
