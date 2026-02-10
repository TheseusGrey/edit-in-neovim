# Edit in Neovim

For those who love the power of Obsidian, but just can't shake wanting absolutely any and all text editing to happen inside of neovim.

## Important

Several users have reported that the plugin doesn't function when obsidian is installed using flatpak.

## What does it do?

This plugin will pop open a new terminal and runs neovim inside it (You can turn this off in the settings) when Obsidian starts up.

After that, every time you open a file inside of Obsidian, that same file will get opened as a new buffer (or focused if already open) inside of the listening neovim instance. This effectively gives you the "linked tabs" functionality you would get inside Obsidian, but with an external editor (in this case neovim) instead.

## tmux-hosted Neovim (OSC52-friendly)

If you rely on OSC52 clipboard plugins (e.g. `nvim-osc52`), you may prefer running Neovim inside a `tmux` session so the "server side" is always a real TUI.

In settings, set:

- `Neovim host mode` to `tmux session`
- `tmux session name` to whatever you want (default: `edit-in-neovim`)
- (optional) enable `Attach tmux on start` to have the plugin try to open a terminal and run `tmux attach -t <session>`
- (optional) enable `Keep tmux session alive on quit` if you want the tmux session to survive Obsidian restarts

The plugin still uses Neovim's `--listen` / `--server` / `--remote` under the hood; tmux is only used to host the Neovim process.

Note: if `listenOn` is a TCP address (e.g. `127.0.0.1:2006`) and something is already listening on that port (often a leftover `nvim --headless --listen ...`), tmux-hosted Neovim won't be able to start. In that case, stop the existing server or switch `listenOn` to a different address (a unix socket path is recommended).

## Why?

I know Obsidian has vim bindings, but I've built up my own Neovim config and customised it to my liking and that's where I like to edit text.

### Have new Neovim buffers open in Obsidian

If you also want new buffers in Neovim to open up in Obsidian, here's what you'll need:

- The [obsidian.nvim](https://github.com/epwalsh/obsidian.nvim) plugin, also highly recommended in general for interacting with Obsidian vaults from Neovim
- The [obsidian-bridge.nvim](https://github.com/oflisback/obsidian-bridge.nvim) along side the [obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api), this is what enables to communication to happen in the reverse direction.

These _should_ work out of the box. But there is a bug that occurs when files are being renamed or deleted from within obsidian while the corresponding buffer is open in neovim; resulting in infinite loops. It's recommend to do file operations from within neovim while using the plugin.

## Edge Cases

There's alot of different terminals, systems, and just ways to install neovim. As
such there's a good chance there's a few cases where this plugin doesn't work as I'd
hope it would, or where you need to handle things alil differently. Below is a
non-exhaustive lists containing the ones I've seen so far:

- When using [Ghostty](https://ghostty.org/) on MacOS, set the terminal path to: `/Applications/Ghostty.app/Contents/MacOS/ghostty`.
