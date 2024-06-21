# Edit in Neovim

For those who love the power of Obsidian, but just can't shake wanting absolutely any and all text editing to happen inside of neovim.

## What does it do?

This plugin will pop open a new terminal and run neovim inside (You can turn this off in the settings) when Obsidian starts up.

After that, every time you open a file inside of Obsidian, that same file will get opened as a new buffer (or focused if already open) inside of the listening neovim instance. This effectively gives you the "linked tabs" functionality you would get inside Obsidian, but with an external editor (in this case neovim) instead.

## Why?

I know Obsidian has vim bindings, but I've built up my own Neovim config and customised it to my liking and that's where I like to edit text.

## Future Plans

For now this is kind of it, if people use this and encounter bugs I'll try and fix them, but I don't have immediate plans to add new features after the initial release. That's not to say I don't have some ideas.

- Something on the Neovim side so active/focused buffers get opened in Obsidian, completing that two-way link.
- Embed the neovim instance in Obsidian(?), there's already a plugin someone else made for embedding consoles/terminals you can check out [here](https://github.com/polyipseity/obsidian-terminal).
- Allow other editors? I like the idea of having a more fleshed-out external editor experience for Obsidian, though having a single plugin to integrate with any/all the different editors and the different ways they talk to each other might be abit much to contain in a single plugin.
