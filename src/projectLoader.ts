import Gio from "gi://Gio";
import GLib from "gi://GLib";
import {JetBrainsApp} from "./jetBrainsApp.js";
import {JetBrainsProject} from "./project.js";
import {escapeRegex} from "./appDiscovery.js";

/**
 * Loads recent projects for one IDE from its ~/.config/JetBrains/<IDE><year>.<n>
 * directories by parsing options/recentProjects.xml.
 */

export interface ProjectLoaderOptions {
    /** Extra config-dir patterns from provider subclasses. */
    additionalPatterns: RegExp[];
    /** Per-project filter hook from provider subclasses. */
    shouldInclude: (projectPath: string) => boolean;
}

function buildConfigDirPatterns(jetbrainsApp: JetBrainsApp): RegExp[] {
    const escapedConfigDir = escapeRegex(jetbrainsApp.configDir.substring(1));
    const escapedName = escapeRegex(jetbrainsApp.name.replace(/\s+/g, ''));
    const escapedExec = escapeRegex(jetbrainsApp.exec);

    return [
        new RegExp(`^${escapedConfigDir}\\d{4}\\.\\d+`, 'i'),
        new RegExp(`^${escapedName}\\d{4}\\.\\d+`, 'i'),
        new RegExp(`^${escapedName}CE\\d{4}\\.\\d+`, 'i'),
        new RegExp(`^${escapedExec}IC\\d{4}\\.\\d+`, 'i'),
        new RegExp(`^_${escapedConfigDir}\\d{4}\\.\\d+`, 'i')
    ];
}

function parseRecentProjects(xml: string, jetbrainsApp: JetBrainsApp, opts: ProjectLoaderOptions,
                             projectsByPath: Map<string, JetBrainsProject>,
                             cancellable: Gio.Cancellable | null): void {
    const entryRegex = /<entry\s+key="([^"]+)"/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
        if (cancellable?.is_cancelled()) {
            throw new Error('Operation cancelled');
        }

        let projectPath = match[1];

        if (!projectPath.startsWith('$USER_HOME$/')) continue;

        projectPath = projectPath.replace('$USER_HOME$', GLib.get_home_dir());
        if (projectsByPath.has(projectPath)) continue;

        const projectFile = Gio.File.new_for_path(projectPath);
        if (!projectFile.query_exists(cancellable)) continue;
        if (!opts.shouldInclude(projectPath)) continue;

        projectsByPath.set(projectPath, new JetBrainsProject(
            GLib.path_get_basename(projectPath),
            projectPath,
            jetbrainsApp.name,
            jetbrainsApp.exec,
            jetbrainsApp.toolboxDir,
            jetbrainsApp.iconFile
        ));
    }
}

function loadRecentProjectsXml(configDirName: string, cancellable: Gio.Cancellable | null): string | null {
    const path = GLib.build_filenamev([
        GLib.get_home_dir(), '.config', 'JetBrains', configDirName, 'options', 'recentProjects.xml'
    ]);
    const file = Gio.File.new_for_path(path);
    if (!file.query_exists(cancellable)) {
        return null;
    }

    try {
        const [success, contents] = file.load_contents(cancellable);
        if (!success) return null;
        return new TextDecoder().decode(contents);
    } catch (e) {
        if (cancellable?.is_cancelled()) {
            throw e;
        }
        console.warn(`JetBrains Search Provider: Error reading ${path}: ${e}`);
        return null;
    }
}

export function loadProjects(jetbrainsApp: JetBrainsApp, opts: ProjectLoaderOptions,
                             cancellable: Gio.Cancellable | null = null): JetBrainsProject[] {
    const jetbrainsConfigDir = GLib.build_filenamev([GLib.get_home_dir(), '.config', 'JetBrains']);
    const patterns = [...buildConfigDirPatterns(jetbrainsApp), ...opts.additionalPatterns];
    const projectsByPath = new Map<string, JetBrainsProject>();

    const jetbrainsDir = Gio.File.new_for_path(jetbrainsConfigDir);
    if (!jetbrainsDir.query_exists(cancellable)) {
        return [];
    }

    try {
        const enumerator = jetbrainsDir.enumerate_children(
            'standard::name,standard::type',
            Gio.FileQueryInfoFlags.NONE,
            cancellable
        );

        try {
            let info;
            while ((info = enumerator.next_file(cancellable))) {
                if (cancellable?.is_cancelled()) {
                    throw new Error('Operation cancelled');
                }

                if (info.get_file_type() !== Gio.FileType.DIRECTORY) continue;

                const name = info.get_name();
                if (!patterns.some(pattern => pattern.test(name))) continue;

                const xml = loadRecentProjectsXml(name, cancellable);
                if (!xml) continue;

                try {
                    parseRecentProjects(xml, jetbrainsApp, opts, projectsByPath, cancellable);
                } catch (e) {
                    if (cancellable?.is_cancelled()) {
                        throw e;
                    }
                    console.warn(`JetBrains Search Provider: Error parsing recentProjects.xml in ${name}: ${e}`);
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
        if (cancellable?.is_cancelled()) {
            throw e;
        }
        console.warn(`JetBrains Search Provider: Error reading ${jetbrainsConfigDir} for ${jetbrainsApp.name}: ${e}`);
    }

    return [...projectsByPath.values()];
}
