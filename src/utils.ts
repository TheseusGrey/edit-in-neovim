import { join, delimiter, normalize } from 'node:path';
import { accessSync, existsSync, constants } from "node:fs";

// @ts-ignore
import systeminformation from "systeminformation";

const windows = process.platform === 'win32';

export async function isPortInUse(port: string) {
  const networkConnections = await systeminformation.networkConnections();

  return networkConnections.find((networkConnection: { localPort: string; }): boolean => {
    return networkConnection.localPort === String(port);
  }) !== undefined;
}

function normalizePath(path: string): string {
  return normalize(windows ? path.toLowerCase() : path);
}

export function searchForBinary(name: string): string | undefined {
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
    if (!existsSync(path)) { continue }
    try {
      accessSync(path, constants.X_OK)
      return path
    } catch (e) {
      console.log(`Could not find valid binary due to: ${e}, for name: ${name}`)
      return undefined;
    }
  }


  return undefined;
}
