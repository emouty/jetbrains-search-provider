import Gio from "gi://Gio";
import GLib from "gi://GLib";
import {JetBrainsApp} from "./jetBrainsApp.js";
import {JetBrainsProject} from "./project.js";
import {ScanCache} from "./scanCache.js";
import {escapeRegex} from "./appDiscovery.js";

/**
 * Loads recent projects for one IDE from its ~/.config/JetBrains/<IDE><year>.<n>
 * directories, using the shared ScanCache so the JetBrains config directory is
 * enumerated once for all providers.
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

export async function loadProjects(jetbrainsApp: JetBrainsApp, scanCache: ScanCache,
                                   opts: ProjectLoaderOptions,
                                   cancellable: Gio.Cancellable | null = null): Promise<JetBrainsProject[]> {
    const patterns = [...buildConfigDirPatterns(jetbrainsApp), ...opts.additionalPatterns];
    const projectsByPath = new Map<string, JetBrainsProject>();

    const configDirNames = await scanCache.getConfigDirNames(cancellable);
    for (const name of configDirNames) {
        if (cancellable?.is_cancelled()) {
            throw new Error('Operation cancelled');
        }

        if (!patterns.some(pattern => pattern.test(name))) continue;

        const xml = await scanCache.getRecentProjectsXml(name, cancellable);
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

    return [...projectsByPath.values()];
}
