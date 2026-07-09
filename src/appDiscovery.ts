import Shell from "gi://Shell";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import {JetBrainsApp} from "./jetBrainsApp.js";

/**
 * Desktop-file based discovery of an installed JetBrains IDE.
 *
 * Matching order:
 * 1. jetbrains-* desktop files whose filename matches the IDE's known patterns
 * 2. jetbrains-* desktop files whose contents mention the IDE
 * 3. Standard app-id lookups via Shell.AppSystem
 */

interface FilenamePattern {
    infix: string;
    exact: string;
}

const DESKTOP_FILENAME_PATTERNS: Record<string, FilenamePattern> = {
    'idea': {infix: '-idea-', exact: 'jetbrains-idea.desktop'},
    'pycharm': {infix: '-pycharm-', exact: 'jetbrains-pycharm-ce.desktop'},
    'rustrover': {infix: '-rustrover-', exact: 'jetbrains-rustrover.desktop'},
    'android-studio': {infix: '-studio', exact: 'jetbrains-studio.desktop'},
    'webstorm': {infix: '-webstorm-', exact: 'jetbrains-webstorm.desktop'},
    'phpstorm': {infix: '-phpstorm-', exact: 'jetbrains-phpstorm.desktop'},
    'goland': {infix: '-goland-', exact: 'jetbrains-goland.desktop'},
    'clion': {infix: '-clion-', exact: 'jetbrains-clion.desktop'},
    'rider': {infix: '-rider-', exact: 'jetbrains-rider.desktop'},
    'rubymine': {infix: '-rubymine-', exact: 'jetbrains-rubymine.desktop'},
    'datagrip': {infix: '-datagrip-', exact: 'jetbrains-datagrip.desktop'},
};

export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesFilenamePattern(jetbrainsApp: JetBrainsApp, lowerFilename: string): boolean {
    const pattern = DESKTOP_FILENAME_PATTERNS[jetbrainsApp.exec];
    if (!pattern) return false;
    return lowerFilename.includes(pattern.infix) || lowerFilename === pattern.exact;
}

function buildContentPatterns(jetbrainsApp: JetBrainsApp): RegExp[] {
    const lowerName = jetbrainsApp.name.toLowerCase();
    const searchPatterns = [
        jetbrainsApp.exec.toLowerCase(),
        lowerName,
        lowerName.replace(/\s+/g, ''),
        lowerName.replace(/\s+/g, '-')
    ];

    if (jetbrainsApp.exec === 'idea') {
        searchPatterns.push('intellij', 'intellij idea', 'intellij-idea');
    } else if (jetbrainsApp.exec === 'android-studio') {
        searchPatterns.push('android studio', 'studio');
    }

    return searchPatterns.map(pattern => new RegExp(`\\b${escapeRegex(pattern)}\\b`, 'i'));
}

function matchesDesktopFileContent(desktopDir: string, filename: string, patterns: RegExp[],
                                   cancellable: Gio.Cancellable | null): boolean {
    try {
        const desktopFile = Gio.File.new_for_path(GLib.build_filenamev([desktopDir, filename]));
        const [success, contents] = desktopFile.load_contents(cancellable);
        if (!success) return false;

        const text = new TextDecoder().decode(contents).toLowerCase();
        return patterns.some(pattern => pattern.test(text));
    } catch {
        return false;
    }
}

function findByDesktopFiles(jetbrainsApp: JetBrainsApp,
                            cancellable: Gio.Cancellable | null): Shell.App | undefined {
    const desktopDir = GLib.build_filenamev([GLib.get_home_dir(), '.local', 'share', 'applications']);
    let contentPatterns: RegExp[] | null = null;

    try {
        const dirFile = Gio.File.new_for_path(desktopDir);
        if (!dirFile.query_exists(cancellable)) return undefined;

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

                const lowerFilename = filename.toLowerCase();
                if (!lowerFilename.startsWith('jetbrains-')) continue;

                let matches = matchesFilenamePattern(jetbrainsApp, lowerFilename);
                if (!matches) {
                    contentPatterns ??= buildContentPatterns(jetbrainsApp);
                    matches = matchesDesktopFileContent(desktopDir, filename, contentPatterns, cancellable);
                }

                if (matches) {
                    const app = Shell.AppSystem.get_default().lookup_app(filename);
                    if (app) {
                        return app;
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
        if (cancellable?.is_cancelled()) {
            throw e;
        }
        console.warn(`JetBrains Search Provider: Error searching for ${jetbrainsApp.name} desktop files: ${e}`);
    }

    return undefined;
}

function findByStandardAppIds(jetbrainsApp: JetBrainsApp): Shell.App | undefined {
    const dashedName = jetbrainsApp.name.toLowerCase().replace(/\s+/g, '-');
    const standardAppIds = [
        jetbrainsApp.exec,
        `jetbrains-${jetbrainsApp.exec}`,
        `${jetbrainsApp.exec}-ultimate`,
        `${jetbrainsApp.exec}-community`,
        `${jetbrainsApp.exec}-ce`,
        dashedName,
        `jetbrains-${dashedName}`
    ];

    return standardAppIds
        .map((id) => Shell.AppSystem.get_default().lookup_app(id + ".desktop"))
        .find((app) => Boolean(app));
}

export function findJetBrainsApp(jetbrainsApp: JetBrainsApp,
                                 cancellable: Gio.Cancellable | null = null): Shell.App | undefined {
    return findByDesktopFiles(jetbrainsApp, cancellable) ?? findByStandardAppIds(jetbrainsApp);
}
