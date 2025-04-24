# Edit in Neovim

For those who love the power of Obsidian, but just can't shake wanting absolutely any and all text editing to happen inside of neovim.

## Important

Several users have reported that the plugin doesn't function when obsidian is installed using flatpak.

## What does it do?

This plugin will pop open a new terminal and runs neovim inside it (You can turn this off in the settings) when Obsidian starts up.

After that, every time you open a file inside of Obsidian, that same file will get opened as a new buffer (or focused if already open) inside of the listening neovim instance. This effectively gives you the "linked tabs" functionality you would get inside Obsidian, but with an external editor (in this case neovim) instead.

### Have new Neovim buffers open in Obsidian

If you also want new buffers in Neovim to open up in Obsidian, here's what you'll need:

- The [obsidian.nvim](https://github.com/epwalsh/obsidian.nvim) plugin, also highly recommended in general for interacting with Obsidian vaults from Neovim
- The [obsidian-bridge.nvim](https://github.com/oflisback/obsidian-bridge.nvim) along side the [obsidian-local-rest-api](https://github.com/coddingtonbear/obsidian-local-rest-api), this is what enables to communication to happen in the reverse direction.

These _should_ work out of the box. But there is a bug that occurs when files are being renamed or deleted from within obsidian while the corresponding buffer is open in neovim; resulting in infinite loops. It's recommend to do file operations from within neovim while using the plugin.

## Why?

I know Obsidian has vim bindings, but I've built up my own Neovim config and customised it to my liking and that's where I like to edit text.
