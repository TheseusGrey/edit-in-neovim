import { Notice } from "obsidian";

function notifyDuration(msg: string) {
  return (msg.split(" ").length / 220) * 60000;
}
export function notify(msg: string, duration?: number): void {
  new Notice(`edit-in-neovim:\n${msg}`, duration || notifyDuration(msg));
}
