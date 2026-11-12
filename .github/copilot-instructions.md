# GitHub Copilot Instructions for GNOME Shell Extension (TypeScript)

## Project Context

This is a GNOME Shell Extension project written in TypeScript that compiles to JavaScript for distribution. The
extension follows GNOME 45+ standards and uses ESModules.

## Extension Lifecycle Rules

### Initialization

- NEVER create objects, connect signals, add main loop sources, or modify GNOME Shell during initialization (constructor
  or module import)
- Only use built-in JavaScript objects (RegExp, Map, etc.) in initialization - no GObject classes
- All extension functionality must be set up in `enable()` method

### Enable Method

- Create all necessary objects, widgets, and UI elements
- Connect all signal handlers
- Add all main loop sources (timeouts, idle callbacks)
- Register search providers or other GNOME Shell integrations
- Initialize all extension features

### Disable Method

- Destroy ALL objects and widgets created in `enable()`
- Disconnect ALL signal connections
- Remove ALL main loop sources using `GLib.Source.remove()`
- Clear dynamically stored memory (e.g., `Map.prototype.clear()`)
- Unregister search providers and other integrations
- Must restore GNOME Shell to its original state

## TypeScript Configuration

### Required Setup

- Use `@girs/gjs` and `@girs/gnome-shell` as dev dependencies
- Configure `tsconfig.json` with:
    - `target`: ES2022 or later
    - `module`: ES2022 or ESNext
    - `moduleResolution`: bundler or node16
    - `strict`: true (enable all strict type checks)
    - `outDir`: dist or output folder
- Declare `gi://` / `resource://` import mappings in `gnome.d.ts`
- Set `"type": "module"` in `package.json`

### Type Safety

- Always use proper types from `@girs` packages
- Avoid `any` type - use proper GObject introspection types
- Type all signal handlers with correct signatures
- Use proper null/undefined checks with TypeScript strict mode
- Type GLib sources, GSettings objects, and callbacks properly

### Import Syntax

- Use ES6 import/export syntax exclusively
- Import GObject libraries with `gi://` protocol: `import GLib from 'gi://GLib'`
- Import GNOME Shell modules with `resource://` URIs:
    - Extension: `resource:///org/gnome/shell/js/`
    - Preferences: `resource:///org/gnome/Shell/Extensions/js/`
- Use `.js` extension in import paths even in `.ts` files (runtime requirement)
- Example: `import { MyUtil } from './utils.js';`

## Library Import Restrictions

### Extension Files (extension.ts)

- ✅ Allowed: Clutter, Meta, St, Shell, GLib, Gio, GObject
- ❌ FORBIDDEN: Gdk, Gtk, Adw (these crash GNOME Shell process)

### Preference Files (prefs.ts)

- ✅ Allowed: Gtk, Adw, Gdk, GLib, Gio, GObject
- ❌ FORBIDDEN: Clutter, Meta, St, Shell (these crash preferences process)

## Extension Base Classes

### Extension Class

```typescript
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class MyExtension extends Extension {
    constructor(metadata: any) {
        super(metadata);
    }

    enable() {
        // Create objects, connect signals, add sources
    }

    disable() {
        // Clean up everything from enable()
    }
}
```

### ExtensionPreferences Class

```typescript
import Adw from 'gi://Adw';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MyPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window: Adw.PreferencesWindow) {
        // Build preferences UI
    }
}
```

## Signal Management

### Connecting Signals

```typescript
private _signalIds: number[] = [];

enable() {
    const id = someObject.connect('signal-name', () => {
        // handler
    });
    this._signalIds.push(id);
}
```

### Disconnecting Signals

```typescript
disable() {
    this._signalIds.forEach(id => {
        someObject.disconnect(id);
    });
    this._signalIds = [];
}
```

## Main Loop Sources

### Adding Sources

```typescript
private
_sourceIds: number[] = [];

enable()
{
    const sourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1000, () => {
        // timeout callback
        return GLib.SOURCE_CONTINUE; // or GLib.SOURCE_REMOVE
    });
    this._sourceIds.push(sourceId);
}
```

### Removing Sources

```typescript
disable()
{
    this._sourceIds.forEach(id => {
        if (id) GLib.Source.remove(id);
    });
    this._sourceIds = [];
}
```

## GSettings Integration

### Schema Configuration

- Place `.gschema.xml` files in `schemas/` subdirectory
- Schema ID must follow pattern: `org.gnome.shell.extensions.your-extension-name`
- Schema path must follow pattern: `/org/gnome/shell/extensions/your-extension-name/`
- Specify `settings-schema` in `metadata.json`

### Using GSettings

```typescript
import Gio from 'gi://Gio';

enable()
{
    this._settings = this.getSettings();

    // Get values
    const value = this._settings.get_boolean('my-key');

    // Connect to changes
    const id = this._settings.connect('changed::my-key', () => {
        // Handle change
    });
    this._signalIds.push(id);
}

disable()
{
    this._settings = null;
}
```

### GSettings Schema XML

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
    <schema id="org.gnome.shell.extensions.my-extension"
            path="/org/gnome/shell/extensions/my-extension/">
        <key name="my-boolean-key" type="b">
            <default>true</default>
            <summary>My boolean setting</summary>
            <description>Detailed description of the setting</description>
        </key>
        <key name="my-string-key" type="s">
            <default>'default-value'</default>
            <summary>My string setting</summary>
        </key>
        <key name="my-int-key" type="i">
            <default>42</default>
            <summary>My integer setting</summary>
        </key>
    </schema>
</schemalist>
```

## Translations (Gettext)

### Initialization

```typescript
constructor(metadata: ExtensionMetadata) {
    super(metadata);
    this.initTranslations();
}
```

### Usage

```typescript
const _ = this.gettext.bind(this);
const label = new St.Label({text: _('Translatable text')});
```

### Configuration

- Specify `gettext-domain` in `metadata.json`
- Place translation files in `locale/` subdirectory

## InjectionManager Pattern

### Setup

```typescript
import {InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';

enable()
{
    this._injectionManager = new InjectionManager();

    this._injectionManager.overrideMethod(
        SomeClass.prototype,
        'methodName',
        (originalMethod) => {
            return function (...args: any[]) {
                // Your override code
                const result = originalMethod.call(this, ...args);
                // More override code
                return result;
            };
        }
    );
}

disable()
{
    this._injectionManager?.clear();
    this._injectionManager = null;
}
```

## Deprecated Patterns to Avoid

- ❌ `ExtensionUtils` - use Extension class methods instead
- ❌ `init()` function - legacy pattern, not needed
- ❌ `ByteArray` module - use `TextDecoder`/`TextEncoder`
- ❌ `Lang` module - use ES6 classes and `Function.prototype.bind()`
- ❌ `Mainloop` module - use `GLib.timeout_add()` or `setTimeout()`
- ❌ `imports.*` syntax - use ES6 `import` statements

## Build and Packaging

### Build Process

1. Compile TypeScript to JavaScript
2. Compile GSettings schemas if present
3. Copy metadata.json, schemas/, locale/ to dist folder
4. Create distribution zip from dist folder

### Files to Exclude from Distribution

- All `.ts` source files
- `tsconfig.json`
- `package.json` and `package-lock.json`
- `node_modules/`
- `.git/` and `.gitignore`
- Development configuration files
- Source maps (unless debug build)

### Required in Distribution

- Compiled JavaScript files (`extension.js`, `prefs.js`)
- `metadata.json`
- `schemas/` folder with compiled schemas if using GSettings
- `locale/` folder if using translations
- Necessary assets (icons, stylesheets)

## Code Quality Standards

### General

- Write clean, readable, well-structured code
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and modular
- Use async/await for asynchronous operations

### Logging

- Log only important messages and errors
- Avoid excessive debug logging in production
- Use appropriate log levels

### Performance

- Minimize object creation in hot paths
- Clean up resources promptly in `disable()`
- Avoid memory leaks by disconnecting all signals
- Remove all timeouts and idle callbacks

## Security and Privacy

### Forbidden

- Telemetry or analytics that track users
- Sharing data with third parties without explicit consent
- Binary executables or compiled libraries
- Obfuscated or minified code
- Unauthorized use of brand names or copyrighted content

### Clipboard Access

- Must be declared in extension description
- No default keyboard shortcuts for clipboard operations
- Data must not be shared without explicit user action

### Subprocess Usage

- Avoid privileged subprocesses
- If necessary, use `pkexec`
- Ensure executables are not user-writable

## metadata.json Requirements

```json
{
  "uuid": "my-extension@example.com",
  "name": "My Extension Name",
  "description": "Brief description of functionality",
  "shell-version": [
    "45",
    "46"
  ],
  "url": "https://github.com/username/extension-repo",
  "settings-schema": "org.gnome.shell.extensions.my-extension",
  "gettext-domain": "my-extension"
}
```

### Rules

- UUID must be globally unique (email format: `name@domain.example`)
- Don't use `gnome.org` namespace
- Only list stable shell versions (plus max one development version)
- Include repository URL
- Don't manually set `version` field (managed by extensions.gnome.org)
- Drop `session-modes` if only using default 'user' mode

## Testing Workflow

1. Modify TypeScript source files
2. Compile TypeScript: `npm run build` or `tsc`
3. Install to: `~/.local/share/gnome-shell/extensions/your-uuid/`
4. Restart GNOME Shell:
    - X11: `Alt+F2`, type `r`, press Enter
    - Wayland: Log out and log back in
5. Test with nested session: `gnome-shell --devkit --wayland`

## Common Mistakes to Avoid

1. Creating objects during initialization instead of in `enable()`
2. Forgetting to disconnect signals in `disable()`
3. Not removing main loop sources in `disable()`
4. Importing GTK in extension.ts or Shell libraries in prefs.ts
5. Using `any` type instead of proper types
6. Forgetting `.js` extension in import paths
7. Not compiling GSettings schemas before testing
8. Including TypeScript source files in distribution
9. Memory leaks from unreleased object references
10. Not testing `disable()` thoroughly

## Remember

- Extension MUST be fully reversible - `disable()` must completely clean up
- All UI elements, signals, and sources created in `enable()` must be destroyed in `disable()`
- Never modify or interact with other extensions
- TypeScript compiles to JavaScript - runtime uses the compiled `.js` files
- Test both enable and disable cycles thoroughly
- Follow GNOME HIG (Human Interface Guidelines) for UI design
