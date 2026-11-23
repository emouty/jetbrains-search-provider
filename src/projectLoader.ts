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
    /** Also scan ~/.config/Google, where Android Studio 4.1+ keeps its config. */
    includeGoogleConfigDir: boolean;
    /** Installed Toolbox edition directory, or null when the IDE is not installed via Toolbox. */
    resolvedToolboxDir: string | null;
}

/** Decode the five predefined XML entities. `&amp;` last, so `&amp;lt;` stays the literal `&lt;`. */
function decodeXmlEntities(value: string): string {
    return value
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&');
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

function parseRecentProjects(xml: string, jetbrainsApp: JetBrainsApp, resolvedToolboxDir: string | null,
                             projectsByPath: Map<string, JetBrainsProject>,
                             cancellable: Gio.Cancellable | null): void {
    const entryRegex = /<entry\s+key="([^"]+)"/g;
    let match;

    while ((match = entryRegex.exec(xml)) !== null) {
        if (cancellable?.is_cancelled()) {
            throw new Error('Operation cancelled');
        }

        // The capture is raw XML attribute text; entities must be decoded before use.
        let projectPath = decodeXmlEntities(match[1]);

        // Home-relative or absolute only; relative entries like ../../foo are noise.
        if (!projectPath.startsWith('$USER_HOME$/') && !projectPath.startsWith('/')) continue;

        projectPath = projectPath.replace('$USER_HOME$', GLib.get_home_dir());
        if (projectsByPath.has(projectPath)) continue;

        const projectFile = Gio.File.new_for_path(projectPath);
        if (!projectFile.query_exists(cancellable)) continue;

        projectsByPath.set(projectPath, new JetBrainsProject(
            GLib.path_get_basename(projectPath),
            projectPath,
            jetbrainsApp.name,
            jetbrainsApp.exec,
            resolvedToolboxDir,
            jetbrainsApp.iconFile,
            jetbrainsApp.launcher
        ));
    }
}

export interface LoadedProjects {
    projects: JetBrainsProject[];
    /** recentProjects.xml of every matching config dir, including the ones not written yet. */
    xmlPaths: string[];
}

export async function loadProjects(jetbrainsApp: JetBrainsApp, scanCache: ScanCache,
                                   opts: ProjectLoaderOptions,
                                   cancellable: Gio.Cancellable | null = null): Promise<LoadedProjects> {
    const patterns = buildConfigDirPatterns(jetbrainsApp);
    const projectsByPath = new Map<string, JetBrainsProject>();
    const xmlPaths: string[] = [];

    const roots = [{
        names: () => scanCache.getConfigDirNames(cancellable),
        path: (name: string) => scanCache.recentProjectsXmlPath(name),
        xml: (name: string) => scanCache.getRecentProjectsXml(name, cancellable)
    }];
    if (opts.includeGoogleConfigDir) {
        roots.push({
            names: () => scanCache.getGoogleConfigDirNames(cancellable),
            path: (name: string) => scanCache.googleRecentProjectsXmlPath(name),
            xml: (name: string) => scanCache.getGoogleRecentProjectsXml(name, cancellable)
        });
    }

    for (const root of roots) {
        for (const name of await root.names()) {
            if (cancellable?.is_cancelled()) {
                throw new Error('Operation cancelled');
            }

            if (!patterns.some(pattern => pattern.test(name))) continue;

            xmlPaths.push(root.path(name));
            const xml = await root.xml(name);
            if (!xml) continue;

            try {
                parseRecentProjects(xml, jetbrainsApp, opts.resolvedToolboxDir, projectsByPath, cancellable);
            } catch (e) {
                if (cancellable?.is_cancelled()) {
                    throw e;
                }
                console.warn(`JetBrains Search Provider: Error parsing recentProjects.xml in ${name}: ${e}`);
            }
        }
    }

    return {projects: [...projectsByPath.values()], xmlPaths};
}
