import Gio from "gi://Gio";
import GLib from "gi://GLib";

/**
 * Shared, per-enable cache of the filesystem scans every provider needs.
 *
 * All eleven providers used to enumerate ~/.local/share/applications and
 * ~/.config/JetBrains independently. This class performs each scan once and
 * memoizes the in-flight Promise, so concurrent provider initialization still
 * triggers exactly one enumeration per directory. The instance is created in
 * Extension.enable() and dropped in disable(); nothing is cached at module level.
 *
 * Errors resolve to empty/null results with a single console.warn, except
 * cancellation, which rejects so callers can abort.
 */

export interface DesktopEntry {
    filename: string;
    lowerFilename: string;
}

function loadContentsAsync(file: Gio.File, cancellable: Gio.Cancellable | null): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        file.load_contents_async(cancellable, (source, res) => {
            try {
                const [, contents] = source!.load_contents_finish(res);
                resolve(contents);
            } catch (e) {
                reject(e);
            }
        });
    });
}

function enumerateChildrenAsync(file: Gio.File, attributes: string, cancellable: Gio.Cancellable | null): Promise<Gio.FileInfo[]> {
    return new Promise((resolve, reject) => {
        file.enumerate_children_async(attributes, Gio.FileQueryInfoFlags.NONE, GLib.PRIORITY_DEFAULT, cancellable,
            (source, res) => {
                let enumerator: Gio.FileEnumerator;
                try {
                    enumerator = source!.enumerate_children_finish(res);
                } catch (e) {
                    reject(e);
                    return;
                }

                const infos: Gio.FileInfo[] = [];
                const requestNextBatch = () => {
                    enumerator.next_files_async(100, GLib.PRIORITY_DEFAULT, cancellable, (en, nextRes) => {
                        try {
                            const batch = en!.next_files_finish(nextRes);
                            if (batch.length === 0) {
                                en!.close_async(GLib.PRIORITY_DEFAULT, null, null);
                                resolve(infos);
                                return;
                            }
                            infos.push(...batch);
                            requestNextBatch();
                        } catch (e) {
                            en!.close_async(GLib.PRIORITY_DEFAULT, null, null);
                            reject(e);
                        }
                    });
                };
                requestNextBatch();
            });
    });
}

export class ScanCache {
    private _desktopEntries: Promise<DesktopEntry[]> | null = null;
    private _desktopFileContents = new Map<string, Promise<string | null>>();
    private _configDirNames = new Map<string, Promise<string[]>>();
    private _recentProjectsXml = new Map<string, Promise<string | null>>();

    private get _desktopDir(): string {
        return GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'applications']);
    }

    private get _jetbrainsConfigDir(): string {
        return GLib.build_filenamev([GLib.get_home_dir(), '.config', 'JetBrains']);
    }

    /** Android Studio 4.1+ writes its config here instead of ~/.config/JetBrains. */
    private get _googleConfigDir(): string {
        return GLib.build_filenamev([GLib.get_home_dir(), '.config', 'Google']);
    }

    /** One enumeration of ~/.local/share/applications, filtered to *.desktop files. */
    getDesktopEntries(cancellable: Gio.Cancellable | null = null): Promise<DesktopEntry[]> {
        if (!this._desktopEntries) {
            const promise = this._scanDesktopEntries(cancellable);
            // Only cancellation rejects; don't memoize it, so a later caller retries.
            promise.catch(() => {
                if (this._desktopEntries === promise) this._desktopEntries = null;
            });
            this._desktopEntries = promise;
        }
        return this._desktopEntries;
    }

    private async _scanDesktopEntries(cancellable: Gio.Cancellable | null): Promise<DesktopEntry[]> {
        const dir = Gio.File.new_for_path(this._desktopDir);
        if (!dir.query_exists(cancellable)) {
            return [];
        }

        try {
            const infos = await enumerateChildrenAsync(dir, 'standard::name', cancellable);
            return infos
                .map(info => info.get_name())
                .filter(name => name.endsWith('.desktop'))
                .map(filename => ({filename, lowerFilename: filename.toLowerCase()}));
        } catch (e) {
            if (cancellable?.is_cancelled()) {
                throw e;
            }
            console.warn(`JetBrains Search Provider: Error scanning ${this._desktopDir}: ${e}`);
            return [];
        }
    }

    /** Lazily load, lowercase, and memoize the contents of a desktop file. */
    getDesktopFileContents(filename: string, cancellable: Gio.Cancellable | null = null): Promise<string | null> {
        let promise = this._desktopFileContents.get(filename);
        if (!promise) {
            const created = this._loadTextFile(GLib.build_filenamev([this._desktopDir, filename]), cancellable)
                .then(text => text?.toLowerCase() ?? null);
            created.catch(() => this._desktopFileContents.delete(filename));
            this._desktopFileContents.set(filename, created);
            promise = created;
        }
        return promise;
    }

    /** One enumeration of ~/.config/JetBrains, directory names only. */
    getConfigDirNames(cancellable: Gio.Cancellable | null = null): Promise<string[]> {
        return this._getConfigDirNames(this._jetbrainsConfigDir, cancellable);
    }

    /** Same, for ~/.config/Google (Android Studio only). */
    getGoogleConfigDirNames(cancellable: Gio.Cancellable | null = null): Promise<string[]> {
        return this._getConfigDirNames(this._googleConfigDir, cancellable);
    }

    private _getConfigDirNames(root: string, cancellable: Gio.Cancellable | null): Promise<string[]> {
        let promise = this._configDirNames.get(root);
        if (!promise) {
            const created = this._scanConfigDirNames(root, cancellable);
            created.catch(() => {
                if (this._configDirNames.get(root) === created) this._configDirNames.delete(root);
            });
            this._configDirNames.set(root, created);
            promise = created;
        }
        return promise;
    }

    private async _scanConfigDirNames(root: string, cancellable: Gio.Cancellable | null): Promise<string[]> {
        const dir = Gio.File.new_for_path(root);
        if (!dir.query_exists(cancellable)) {
            return [];
        }

        try {
            const infos = await enumerateChildrenAsync(dir, 'standard::name,standard::type', cancellable);
            return infos
                .filter(info => info.get_file_type() === Gio.FileType.DIRECTORY)
                .map(info => info.get_name());
        } catch (e) {
            if (cancellable?.is_cancelled()) {
                throw e;
            }
            console.warn(`JetBrains Search Provider: Error scanning ${root}: ${e}`);
            return [];
        }
    }

    /** Memoized read of <configDir>/options/recentProjects.xml. */
    getRecentProjectsXml(configDirName: string, cancellable: Gio.Cancellable | null = null): Promise<string | null> {
        return this._getRecentProjectsXml(this._jetbrainsConfigDir, configDirName, cancellable);
    }

    /** Same, for config dirs under ~/.config/Google (Android Studio only). */
    getGoogleRecentProjectsXml(configDirName: string, cancellable: Gio.Cancellable | null = null): Promise<string | null> {
        return this._getRecentProjectsXml(this._googleConfigDir, configDirName, cancellable);
    }

    private _getRecentProjectsXml(root: string, configDirName: string,
                                  cancellable: Gio.Cancellable | null): Promise<string | null> {
        const path = GLib.build_filenamev([root, configDirName, 'options', 'recentProjects.xml']);
        let promise = this._recentProjectsXml.get(path);
        if (!promise) {
            const created = this._loadTextFile(path, cancellable);
            created.catch(() => this._recentProjectsXml.delete(path));
            this._recentProjectsXml.set(path, created);
            promise = created;
        }
        return promise;
    }

    private async _loadTextFile(path: string, cancellable: Gio.Cancellable | null): Promise<string | null> {
        const file = Gio.File.new_for_path(path);
        if (!file.query_exists(cancellable)) {
            return null;
        }

        try {
            const contents = await loadContentsAsync(file, cancellable);
            return new TextDecoder().decode(contents);
        } catch (e) {
            if (cancellable?.is_cancelled()) {
                throw e;
            }
            console.warn(`JetBrains Search Provider: Error reading ${path}: ${e}`);
            return null;
        }
    }
}
