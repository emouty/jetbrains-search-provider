# JetBrains Project Search Provider

A GNOME Shell extension that integrates JetBrains IDE projects into the system search, allowing you to quickly find and
open your projects directly from the Activities overview.

> **Disclaimer**: This extension is not affiliated with, endorsed by, or in any way officially connected to JetBrains
> s.r.o. JetBrains and all related trademarks are property of their respective owners.

## Features

- Supports the GNOME Shell versions listed in `shell-version` in [metadata.json](metadata.json)
- **Universal Search**: Find JetBrains projects from GNOME's search overlay
- **Recent Projects Only**: Searches are limited to projects in each IDE's recent projects list
- **IDE-Specific Icons**: Each project displays with its corresponding IDE icon (IntelliJ IDEA, PyCharm, RustRover,
  etc.)
- **Multi-IDE Support**: Supports all major JetBrains IDEs including IntelliJ IDEA, PyCharm, RustRover, Android
  Studio (full list in [src/jetBrainsApp.ts](src/jetBrainsApp.ts))
- **Instant Launch**: Click to open projects directly in their respective IDEs (JetBrains Toolbox launcher first,
  then the IDE's desktop entry, then the IDE command on `PATH`)
- **Project Icons**: Shows custom project icons when available, with intelligent fallbacks

## Usage

1. Open Activities overview (`Super` key)
2. Start typing your project name (matches on the project path also appear, ranked below name matches)
3. Projects appear grouped by IDE with their respective icons
4. Click or press Enter to open the project

## Configuration

Access extension preferences through:

- Extensions app → JetBrains Project Search → Settings
- `gnome-extensions prefs jetbrains-search@emouty.github.io`

### Available Options

- **Override Results Order**: Place JetBrains projects directly underneath applications in search results. Disable
  and re-enable the extension for the change to take effect.

## Installation

Download the zip archive of the latest release from the [releases page](https://github.com/emouty/jetbrains-search-provider/releases)
and install it using the command line:

```bash
gnome-extensions install --force jetbrains-search-provider.zip
gnome-extensions enable jetbrains-search@emouty.github.io
```

Then restart GNOME Shell by logging out and back in (Wayland).

`gnome-extensions install` compiles the settings schema. If you unzip the archive into
`~/.local/share/gnome-shell/extensions/jetbrains-search@emouty.github.io/` by hand instead, run
`glib-compile-schemas schemas/` in that folder before enabling the extension.

## Development

### Prerequisites

- Node.js and npm (TypeScript and the other build tools come from `npm install`)
- `zip` (used by `npm run pack`)
- `mutter-devkit` for the nested session of `npm run debug` (GNOME 50+)

### Building from Source

```bash
# Clone the repository
git clone https://github.com/emouty/jetbrains-search-provider.git
cd jetbrains-search-provider

# Install dependencies
npm install

# build and install the extension
npm run setup 
```

### Testing

```bash
# Unit tests (vitest, no GNOME Shell needed)
npm test

# Nested GNOME Shell session with the extension installed
npm run setup && npm run debug

# Monitor logs
journalctl /usr/bin/gnome-shell -f -o cat
```

## Acknowledgments

This extension was inspired by [vscode-search-provider](https://github.com/MrMarble/vscode-search-provider) by MrMarble.
