# Edit in Neovim

For those who love the power of Obsidian, but just can't shake wanting absolutely any and all text editing to happen inside of neovim.

## What does it do?

This plugin will pop open a new terminal and runs neovim inside it (You can turn this off in the settings) when Obsidian starts up.

After that, every time you open a file inside of Obsidian, that same file will get opened as a new buffer (or focused if already open) inside of the listening neovim instance. This effectively gives you the "linked tabs" functionality you would get inside Obsidian, but with an external editor (in this case neovim) instead.

### Have new Neovim buffers open in Obsidian

If you also want new buffers in Neovim to open up in Obsidian, here's what you'll need:

- The [obsidian.nvim](https://github.com/epwalsh/obsidian.nvim) plugin, also highly recommended in general for interacting with Obsidian vaults from Neovim
- Add the following `autocmd` to your neovim config:

```lua
-- If you want to use "~", you need to prefix the vault path with vim.fn.expand "~"
local vault_location = <PATH_TO_VAULT> .. "/**.md"
local group = vim.api.nvim_create_augroup("obsidian_cmds", { clear = true })
vim.api.nvim_create_autocmd("BufAdd", {
  command = "ObsidianOpen",
  pattern = { vault_location },
  group = group,
  desc = "Opens the current buffer in Obsidian",
})
```

Fair warning this `autocmd` is alil buggy in cases where you have multiple tabs open in Obsidian, as well as the potential for it to create cycles. If anyone can has an idea for addressing these issues I'm all for it, since having the link go both ways is the ideal.

## Why?

I know Obsidian has vim bindings, but I've built up my own Neovim config and customised it to my liking and that's where I like to edit text.

## Future Plans

A few ideas I have about where to take this plugin or at least the idea behind it beyond just fixing bugs and keeping things functioning:

- Embed the neovim instance in Obsidian(?), there's already a plugin someone else made for embedding consoles/terminals you can check out [here](https://github.com/polyipseity/obsidian-terminal).
- Make the plugin play nicely with multiple obsidian tabs, current neovim gets alil confused if there are multiple tabs open.
- Allow other editors? I like the idea of having a more fleshed-out external editor experience for Obsidian, though having a single plugin to integrate with any/all the different editors and the different ways they talk to each other might be abit much to contain in a single plugin.
