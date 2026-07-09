import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import {normalizeForSearch, normalizePathForSearch} from './searchScoring.js';

export class JetBrainsProject {
    name: string;
    path: string;
    appName: string;
    appExec: string;
    toolboxDir: string;
    iconFile: string;
    readonly normalizedName: string;
    readonly normalizedPath: string;

    // Icon lookups are memoized per instance: one query_exists per project per
    // enable instead of one per rendered result. `undefined` = not checked yet.
    private _projectIconPath: string | null | undefined;
    private _toolboxIcon: Gio.Icon | null | undefined;

    constructor(name: string, path: string, appName: string, appExec: string, toolboxDir: string, iconFile: string) {
        this.name = name;
        this.path = path;
        this.appName = appName;
        this.appExec = appExec;
        this.toolboxDir = toolboxDir;
        this.iconFile = iconFile;
        this.normalizedName = normalizeForSearch(name);
        this.normalizedPath = normalizePathForSearch(path);
    }

    launch(): void {
        const launchMethods = [
            this._launchViaToolbox.bind(this),
            this._launchViaDesktopFile.bind(this),
            this._launchViaSystemCommand.bind(this)
        ];

        for (const method of launchMethods) {
            if (method()) {
                return;
            }
        }

        console.warn(`JetBrains Search Provider: Failed to launch ${this.appName} project ${this.name}`);
    }

    private _spawnDetached(argv: string[], origin: string): boolean {
        try {
            const subprocess = Gio.Subprocess.new(argv, Gio.SubprocessFlags.NONE);
            subprocess.wait_async(null, (obj, res) => {
                try {
                    obj?.wait_finish(res);
                } catch (e) {
                    console.warn(`JetBrains Search Provider: ${origin} subprocess error for ${this.name}: ${e}`);
                }
            });
            return true;
        } catch (e) {
            console.warn(`JetBrains Search Provider: Failed to launch via ${origin} (${argv[0]}): ${e}`);
            return false;
        }
    }

    private _launchViaToolbox(cancellable: Gio.Cancellable | null = null): boolean {
        if (!this.toolboxDir) return false;

        const homeDir = GLib.get_home_dir();
        const executablePath = GLib.build_filenamev([
            homeDir, '.local', 'share', 'JetBrains', 'Toolbox', 'apps',
            this.toolboxDir, 'bin', this.appExec
        ]);

        const executableFile = Gio.File.new_for_path(executablePath);
        if (!executableFile.query_exists(cancellable)) {
            return false;
        }
        return this._spawnDetached([executablePath, this.path], 'Toolbox');
    }

    private _launchViaDesktopFile(cancellable: Gio.Cancellable | null = null): boolean {
        const homeDir = GLib.get_home_dir();
        const desktopDir = GLib.build_filenamev([homeDir, '.local', 'share', 'applications']);

        try {
            const dirFile = Gio.File.new_for_path(desktopDir);
            if (!dirFile.query_exists(cancellable)) return false;

            const enumerator = dirFile.enumerate_children(
                'standard::name',
                Gio.FileQueryInfoFlags.NONE,
                cancellable
            );

            try {
                let info;
                while ((info = enumerator.next_file(cancellable))) {
                    const filename = info.get_name();
                    if (!filename.endsWith('.desktop')) continue;

                    if (filename.includes('jetbrains') &&
                        (filename.toLowerCase().includes(this.appExec.toLowerCase()) ||
                            filename.toLowerCase().includes(this.appName.toLowerCase().replace(/\s+/g, '-')))) {

                        if (this._launchViaDesktopFileExec(desktopDir, filename, cancellable)) {
                            return true;
                        }
                    }
                }
            } finally {
                try {
                    enumerator.close(cancellable);
                } catch (e) {
                    console.warn(`JetBrains Search Provider: Error closing enumerator: ${e}`);
                }
            }
        } catch (e) {
            console.warn(`JetBrains Search Provider: Error searching desktop files: ${e}`);
        }

        return false;
    }

    private _launchViaDesktopFileExec(desktopDir: string, filename: string,
                                      cancellable: Gio.Cancellable | null): boolean {
        try {
            const desktopFile = Gio.File.new_for_path(GLib.build_filenamev([desktopDir, filename]));
            const [success, contents] = desktopFile.load_contents(cancellable);
            if (!success) return false;

            const text = new TextDecoder().decode(contents);
            const execMatch = text.match(/^Exec=(.+)$/m);
            if (!execMatch) return false;

            // Replace %f, %F, %u, %U with the project path, safely shell-quoted
            const execCommand = execMatch[1].replace(/%[fFuU]/g, GLib.shell_quote(this.path));

            // Parse the command into argv and launch without invoking a shell
            const [parsed, argv] = GLib.shell_parse_argv(execCommand);
            if (parsed && argv) {
                return this._spawnDetached(argv, 'desktop file');
            }
        } catch (e) {
            console.warn(`JetBrains Search Provider: Error processing desktop file ${filename}: ${e}`);
        }
        return false;
    }

    private _launchViaSystemCommand(): boolean {
        return this._spawnDetached([this.appExec, this.path], 'system command');
    }

    getProjectIconPath(cancellable: Gio.Cancellable | null = null): string | null {
        if (this._projectIconPath === undefined) {
            const iconPath = GLib.build_filenamev([this.path, '.idea', 'icon.png']);
            const iconFile = Gio.File.new_for_path(iconPath);
            this._projectIconPath = iconFile.query_exists(cancellable) ? iconPath : null;
        }
        return this._projectIconPath;
    }

    private _getIdeIconFromToolbox(cancellable: Gio.Cancellable | null = null): Gio.Icon | null {
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
        if (iconFile.query_exists(cancellable)) {
            try {
                this._toolboxIcon = new Gio.FileIcon({file: iconFile});
            } catch (e) {
                console.warn(`JetBrains Search Provider: Could not load Toolbox icon ${iconPath}: ${e}`);
            }
        }

        return this._toolboxIcon;
    }

    createIcon(size: number, _scaleFactor: number, cancellable: Gio.Cancellable | null = null): St.Icon {
        const projectIconPath = this.getProjectIconPath(cancellable);
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

        const ideIcon = this._getIdeIconFromToolbox(cancellable);
        if (ideIcon) {
            return new St.Icon({
                gicon: ideIcon,
                icon_size: size
            });
        }

        return new St.Icon({
            icon_name: 'folder-symbolic',
            icon_size: size
        });
    }
}
