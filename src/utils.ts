import { join, delimiter, normalize, isAbsolute } from 'node:path';
import { accessSync, existsSync, constants } from "node:fs";

import * as child_process from "node:child_process";
import * as os from "node:os";


export type SpawnProcessOptions = child_process.SpawnOptionsWithoutStdio & {
  spawnArgs: string[],
}

// @ts-ignore
import systeminformation from "systeminformation";

const windows = process.platform === 'win32';
export const searchDirs = windows ? [] : [
  '/usr/local/bin',
  '/usr/bin',
  '/opt/homebrew/bin',
  '/home/linuxbrew/.linuxbrew/bin',
  '/snap/nvim/current/usr/bin',
];

export async function isPortInUse(port: string) {
  const networkConnections = await systeminformation.networkConnections();

  return networkConnections.find((networkConnection: { localPort: string; }): boolean => {
    return networkConnection.localPort === String(port);
  }) !== undefined;
}

function normalizePath(path: string): string {
  return normalize(windows ? path.toLowerCase() : path);
}

export function configureProcessSpawnArgs(
  spawnOptions: SpawnProcessOptions,
  terminalName: string,
  terminalPath: string,
  nvimPath: string,
  port: string
) {
  if (!windows) {
    spawnOptions.spawnArgs = ["-e", nvimPath, "--listen", port];
    spawnOptions.shell = os.userInfo().shell || true;
    console.debug(`edit-in-neovim:\nProcess spawn config for macos/linux: ${JSON.stringify(spawnOptions, null, 2)}`)
    return spawnOptions;
  }

  if (terminalName === 'alacritty.exe' || terminalName === 'wezterm.exe' || terminalName === 'kitty.exe') {
    spawnOptions.spawnArgs = ['-e', nvimPath, '--listen', port];
    console.debug(`edit-in-neovim:\nProcess spawn config for windows and ${terminalName}: ${JSON.stringify(spawnOptions, null, 2)}`)
    return spawnOptions;
  }

  if (terminalName === 'wt.exe') {
    spawnOptions.spawnArgs = ['new-tab', '--title', 'Neovim', nvimPath, '--listen', port];
    console.debug(`edit-in-neovim:\nProcess spawn config for windows terminal: ${JSON.stringify(spawnOptions, null, 2)}`)
    return spawnOptions;
  }

  if (terminalName === 'powershell.exe' || terminalName === 'pwsh.exe') {
    const command = `Start-Process -FilePath '${nvimPath}' -ArgumentList '--listen ${port}' -WindowStyle Normal`;
    spawnOptions.spawnArgs = ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-NoExit', '-Command', command];
    spawnOptions.shell = true;
    console.debug(`edit-in-neovim:\nProcess spawn config for powershell: ${JSON.stringify(spawnOptions, null, 2)}`)
    return spawnOptions;
  }

  if (terminalName === 'cmd.exe') {
    spawnOptions.spawnArgs = ['/c', 'start', `"Neovim"`, `"${nvimPath}"`, '--listen', port];
    spawnOptions.shell = true;
    console.debug(`edit-in-neovim:\nProcess spawn config for ${terminalName}: ${JSON.stringify(spawnOptions, null, 2)}`)
    return spawnOptions;
  }

  console.warn(`Unknown/unhandled Windows terminal: ${terminalPath}. Using fallback, this is likely to fail.`);
  spawnOptions.spawnArgs = ['-e', nvimPath, '--listen', port];
  console.info(`edit-in-neovim:\nProcess spawn config for ${terminalName}: ${JSON.stringify(spawnOptions, null, 2)}`)
  return spawnOptions;
}

function verifyPath(name: string): string | undefined {
  if (!existsSync(name)) {
    return undefined;
  }
  try {
    accessSync(name, constants.X_OK);
    return name;
  } catch (e) {
    console.log(`Could not find valid binary due to: ${e}, for name: ${name}`);
    return undefined;
  }
}

export function searchForBinary(name: string): string | undefined {
  if (isAbsolute(name)) {
    return verifyPath(name);
  }

  const paths = new Set<string>();
  const { PATH, USERPROFILE, LOCALAPPDATA, PROGRAMFILES, HOME } = process.env;

  PATH?.split(delimiter).forEach(p => paths.add(normalizePath(p)));

  if (windows) {
    name = windows ? `${name}.exe` : name
    // Scoop common install location
    if (USERPROFILE) {
      paths.add(normalizePath(`${USERPROFILE}/scoop/shims`));
    }
    paths.add(normalizePath('C:/ProgramData/scoop/shims'));

    // Winget common install location
    // See https://github.com/microsoft/winget-cli/blob/master/doc/specs/%23182%20-%20Support%20for%20installation%20of%20portable%20standalone%20apps.md
    if (LOCALAPPDATA) {
      paths.add(normalizePath(`${LOCALAPPDATA}/Microsoft/WindowsApps`));
      paths.add(normalizePath(`${LOCALAPPDATA}/Microsoft/WinGet/Packages`));
    }
    if (PROGRAMFILES) {
      paths.add(normalizePath(`${PROGRAMFILES}/WinGet/Packages`));
      paths.add(normalizePath(`${PROGRAMFILES} (x86)/WinGet/Packages`));
    }
  } else {
    // Common paths for Unix-like systems
    [
      '/usr/local/bin',
      '/usr/bin',
      '/opt/homebrew/bin',
      '/home/linuxbrew/.linuxbrew/bin',
    ].forEach(p => paths.add(p));

    if (HOME) {
      paths.add(normalizePath(`${HOME}/bin`));
      paths.add(normalizePath(`${HOME}/.linuxbrew/bin`));
    }

  }

  const allPaths = [...paths].map(p => join(p, name))

  for (const path of allPaths) {
    const verifiedPath = verifyPath(path);
    if (verifiedPath) {
      return verifiedPath;
    }
  }

  return undefined;
}
