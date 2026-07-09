import Shell from "gi://Shell";
import Gio from "gi://Gio";
import {JetBrainsApp} from "./jetBrainsApp.js";
import {ScanCache} from "./scanCache.js";

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

async function findByDesktopFiles(jetbrainsApp: JetBrainsApp, scanCache: ScanCache,
                                  cancellable: Gio.Cancellable | null): Promise<Shell.App | undefined> {
    let contentPatterns: RegExp[] | null = null;

    try {
        for (const {filename, lowerFilename} of await scanCache.getDesktopEntries(cancellable)) {
            if (!lowerFilename.startsWith('jetbrains-')) continue;

            let matches = matchesFilenamePattern(jetbrainsApp, lowerFilename);
            if (!matches) {
                const contents = await scanCache.getDesktopFileContents(filename, cancellable);
                if (contents) {
                    contentPatterns ??= buildContentPatterns(jetbrainsApp);
                    matches = contentPatterns.some(pattern => pattern.test(contents));
                }
            }

            if (matches) {
                const app = Shell.AppSystem.get_default().lookup_app(filename);
                if (app) {
                    return app;
                }
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

export async function findJetBrainsApp(jetbrainsApp: JetBrainsApp, scanCache: ScanCache,
                                       cancellable: Gio.Cancellable | null = null): Promise<Shell.App | undefined> {
    return await findByDesktopFiles(jetbrainsApp, scanCache, cancellable)
        ?? findByStandardAppIds(jetbrainsApp);
}
