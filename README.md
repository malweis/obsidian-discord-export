# Discord Export

An Obsidian plugin that prepares your notes for posting on Discord.

This started as a personal tool — I write a lot in Obsidian and regularly share that text on Discord. Manually splitting long notes to fit Discord's message limits and then fixing the formatting every time got old fast. This plugin automates all of that.

---

## What it does

When you trigger the command, a modal opens showing your note split into numbered chunks that fit within Discord's character limit. Each chunk has its own **Copy** button. Paste them into Discord one by one.

The plugin also handles indentation: Discord doesn't preserve the visual formatting of your editor, so the first paragraph of each message gets a special prefix that renders as an indent on Discord, and all following paragraphs get standard spacing.

<!-- Add a screenshot of the modal here once the UI is finalized -->
<!-- ![Discord Export modal](docs/screenshot-modal.png) -->

---

## Features

- **Automatic splitting** — chunks your note at paragraph boundaries, never mid-sentence
- **Indent mode** — adds Discord-compatible indentation to every paragraph (see below)
- **Splitter mode** — splits only, no indentation added
- **2000 / 4000 character limit** — toggle between standard and Nitro limits
- **Per-session overrides** — change mode and limit inside the modal without touching your settings
- **Copied state** — each chunk tracks whether you've already copied it
- **Ignore blocks** — wrap content in `{...}` to strip it from the output
- **Breakpoints** — force a chunk split at any point with `+++`

---

## Usage

Open the note you want to export, then run **Discord Export: Export note to Discord** from the command palette (`Ctrl+P`). You can assign a hotkey in **Settings → Hotkeys**.

The modal will show all chunks ready to copy.

---

## Special syntax

### Ignore blocks `{...}`

Wrap anything in curly braces and it will be stripped from the output entirely. Useful for personal notes, image reminders, or anything else you want visible in Obsidian but not on Discord.

```
He looked serious, his eyes fixed on the horizon.
{add character portrait here}
—We leave at dawn. —he said, turning away.
```

Output (what Discord sees):
```
He looked serious, his eyes fixed on the horizon.
—We leave at dawn. —he said, turning away.
```

Ignore blocks can span multiple lines:

```
The village burned through the night.
{
  insert map image here
  reference: scene-3-map.png
}
By morning, nothing remained.
```

### Breakpoints `+++`

Place `+++` on its own line to force a new chunk at that exact point, regardless of how full the current chunk is. This is useful when you want to post an image between two chunks — the breakpoint guarantees the image has its own slot.

```
He looked serious, his eyes fixed on the horizon.
—We leave at dawn. —he said, turning away.

+++

[image of the character here]

+++

The village burned through the night.
```

This produces three chunks: the text before the first `+++`, the image placeholder, and the text after the second `+++`.

---

## Settings

| Setting | Options | Default |
|---------|---------|---------|
| Character limit | 2000 / 4000 (Nitro) | 2000 |
| Default mode | Indent / Splitter | Indent |

Both settings can also be overridden per session directly inside the modal.

---

## Installation

### Community plugins (once published)

1. Open **Settings → Community plugins**
2. Search for **Discord Export**
3. Install and enable

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/malweis/obsidian-discord-export/releases)
2. Create a folder at `<your vault>/.obsidian/plugins/discord-export/`
3. Copy the three files into that folder
4. Enable the plugin in **Settings → Community plugins**

---

## Adding screenshots to this README

To add screenshots, take them and save them in a `docs/` folder at the root of this repo. Then replace the comment blocks at the top of this file with actual image tags:

```markdown
![Discord Export modal](docs/screenshot-modal.png)
```

GitHub will render them inline on the repo page. Recommended shots:
- The modal with a few chunks visible
- The copied state (green borders)
- The settings page

---

## License

MIT — see [LICENSE](LICENSE)
