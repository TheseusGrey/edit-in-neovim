import { accessSync, existsSync, constants } from "node:fs";

import * as child_process from "node:child_process";
import { Notice } from "obsidian";

export type SpawnProcessOptions = child_process.SpawnOptionsWithoutStdio & {
  spawnArgs: string[];
};

function notifyDuration(msg: string) {
  return (msg.split(" ").length / 220) * 60000;
}
export function notify(msg: string, duration?: number): void {
  new Notice(`edit-in-neovim:\n${msg}`, duration || notifyDuration(msg));
}

export function verifyPath(name: string): string | undefined {
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
