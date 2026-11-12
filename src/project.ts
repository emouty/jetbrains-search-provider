import St from "gi://St";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import Shell from "gi://Shell";
import {trySpawn} from "resource:///org/gnome/shell/misc/util.js";
import {normalizeForSearch, normalizePathForSearch} from "./searchScoring.js";

export class JetBrainsProject {
    name: string;
    path: string;
    appName: string;
    appExec: string;
    toolboxDir: string | null;
    iconFile: string;
    /** Launcher binary/desktop-file name; falls back to appExec when the IDE has none. */
    readonly launcher: string;
    readonly normalizedName: string;
    readonly normalizedPath: string;

    // Icon lookups are memoized per instance: one query_exists per project per
    // enable instead of one per rendered result. `undefined` = not checked yet.
    private _projectIconPath: string | null | undefined;
    private _toolboxIcon: Gio.Icon | null | undefined;

    constructor(name: string, path: string, appName: string, appExec: string, toolboxDir: string | null, iconFile: string,
                launcher?: string) {
        this.name = name;
        this.path = path;
        this.appName = appName;
        this.appExec = appExec;
        this.toolboxDir = toolboxDir;
        this.iconFile = iconFile;
        this.launcher = launcher ?? appExec;
        this.normalizedName = normalizeForSearch(name);
        this.normalizedPath = normalizePathForSearch(path);
    }

    /** @param appInfo the IDE's desktop app as resolved by the provider, when it found one. */
    launch(appInfo: Gio.AppInfo | null = null): void {
        if (this._launchViaToolbox() || this._launchViaAppInfo(appInfo) || this._launchViaSystemCommand()) {
            return;
        }

        console.warn(`JetBrains Search Provider: Failed to launch ${this.appName} project ${this.name}`);
    }

    private _spawnDetached(argv: string[], origin: string): boolean {
        try {
            trySpawn(argv);
            return true;
        } catch (e) {
            console.warn(`JetBrains Search Provider: Failed to launch via ${origin} (${argv[0]}): ${e}`);
            return false;
        }
    }

    private _launchViaToolbox(): boolean {
        if (!this.toolboxDir) return false;

        const homeDir = GLib.get_home_dir();
        const executablePath = GLib.build_filenamev([
            homeDir, '.local', 'share', 'JetBrains', 'Toolbox', 'apps',
            this.toolboxDir, 'bin', this.launcher
        ]);

        const executableFile = Gio.File.new_for_path(executablePath);
        if (!executableFile.query_exists(null)) {
            return false;
        }
        return this._spawnDetached([executablePath, this.path], 'Toolbox');
    }

    private _launchViaAppInfo(appInfo: Gio.AppInfo | null): boolean {
        if (!appInfo) return false;

        try {
            return appInfo.launch_uris([Gio.File.new_for_path(this.path).get_uri()],
                Shell.Global.get().create_app_launch_context(0, -1));
        } catch (e) {
            console.warn(`JetBrains Search Provider: Failed to launch via app info for ${this.name}: ${e}`);
            return false;
        }
    }

    private _launchViaSystemCommand(): boolean {
        return this._spawnDetached([this.launcher, this.path], 'system command');
    }

    // Icon lookups run uncancelled: they are single stats, and a cancelled one
    // would memoize a spurious "missing" for the rest of the provider's life.
    getProjectIconPath(): string | null {
        if (this._projectIconPath === undefined) {
            const iconPath = GLib.build_filenamev([this.path, '.idea', 'icon.png']);
            const iconFile = Gio.File.new_for_path(iconPath);
            this._projectIconPath = iconFile.query_exists(null) ? iconPath : null;
        }
        return this._projectIconPath;
    }

    private _getIdeIconFromToolbox(): Gio.Icon | null {
        if (this._toolboxIcon !== undefined) {
            return this._toolboxIcon;
        }
        this._toolboxIcon = null;

        if (!this.toolboxDir || !this.iconFile) return null;

        const homeDir = GLib.get_home_dir();
        const iconPath = GLib.build_filenamev([
            homeDir, '.local', 'share', 'JetBrains', 'Toolbox', 'apps',
            this.toolboxDir, 'bin', this.iconFile
        ]);

        const iconFile = Gio.File.new_for_path(iconPath);
        if (iconFile.query_exists(null)) {
            try {
                this._toolboxIcon = new Gio.FileIcon({file: iconFile});
            } catch (e) {
                console.warn(`JetBrains Search Provider: Could not load Toolbox icon ${iconPath}: ${e}`);
            }
        }

        return this._toolboxIcon;
    }

    createIcon(size: number): St.Icon | null {
        const projectIconPath = this.getProjectIconPath();
        if (projectIconPath) {
            try {
                const file = Gio.File.new_for_path(projectIconPath);
                const gicon = new Gio.FileIcon({file: file});
                return new St.Icon({
                    gicon: gicon,
                    icon_size: size
                });
            } catch {
                // Silently fall back to IDE icon
            }
        }

        const ideIcon = this._getIdeIconFromToolbox();
        if (ideIcon) {
            return new St.Icon({
                gicon: ideIcon,
                icon_size: size
            });
        }

        return null;
    }
}
