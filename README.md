# JetBrains Project Search Provider

A GNOME Shell extension that integrates JetBrains IDE projects into the system search, allowing you to quickly find and
open your projects directly from the Activities overview.

> **Disclaimer**: This extension is not affiliated with, endorsed by, or in any way officially connected to JetBrains
> s.r.o. JetBrains and all related trademarks are property of their respective owners.

## Features

- Supports GNOME Shell 45 → 49+
- **Universal Search**: Find JetBrains projects from GNOME's search overlay
- **Recent Projects Only**: Searches are limited to projects in each IDE's recent projects list
- **IDE-Specific Icons**: Each project displays with its corresponding IDE icon (IntelliJ IDEA, PyCharm, RustRover,
  etc.)
- **Multi-IDE Support**: Supports all major JetBrains IDEs including IntelliJ IDEA, PyCharm, RustRover, Android
  Studio ...
- **Instant Launch**: Click to open projects directly in their respective IDEs
- **Project Icons**: Shows custom project icons when available, with intelligent fallbacks

## Usage

1. Open Activities overview (`Super` key)
2. Start typing your project name
3. Projects appear grouped by IDE with their respective icons
4. Click or press Enter to open the project

## Configuration

Access extension preferences through:

- Extensions app → JetBrains Project Search → Settings
- `gnome-extensions prefs jetbrains-search@emouty.github.com`

### Available Options

- **Override Results Order**: Prioritize JetBrains projects in search results

## Development

### Prerequisites

- Node.js and npm
- TypeScript
- GNOME Shell development environment

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
npm run setup && npm run debug

# Monitor logs
journalctl /usr/bin/gnome-shell -f -o cat
```

## Acknowledgments

This extension was inspired by [vscode-search-provider](https://github.com/MrMarble/vscode-search-provider) by MrMarble.
