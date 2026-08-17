import { describe, it, expect, beforeEach } from 'vitest';
import type Gio from 'gi://Gio';
import { __reset, __setFiles } from './mocks/gi-Gio.js';
import { ScanCache } from '../src/scanCache.js';
import { loadProjects, type ProjectLoaderOptions } from '../src/projectLoader.js';
import type { JetBrainsApp } from '../src/jetBrainsApp.js';

const JETBRAINS_DIR = '/home/test/.config/JetBrains';
const GOOGLE_DIR = '/home/test/.config/Google';
const IDEA_DIR = `${JETBRAINS_DIR}/IntelliJIdea2025.1`;

const ideaApp: JetBrainsApp = {
    name: 'IntelliJ IDEA',
    exec: 'idea',
    configDir: '.IntelliJIdea',
    toolboxDirs: ['intellij-idea-ultimate'],
    iconFile: 'idea.svg',
};

const studioApp: JetBrainsApp = {
    name: 'Android Studio',
    exec: 'android-studio',
    configDir: '.AndroidStudio',
    toolboxDirs: ['android-studio'],
    iconFile: 'studio.svg',
    launcher: 'studio',
};

const neverCancelled = { is_cancelled: () => false } as unknown as Gio.Cancellable;

const defaultOpts: ProjectLoaderOptions = {
    includeGoogleConfigDir: false,
    resolvedToolboxDir: null,
};

function recentProjectsXml(keys: string[]): string {
    return `<application>${keys.map(k => `<entry key="${k}"/>`).join('')}</application>`;
}

/** Stage an IntelliJ config dir holding `keys`, plus any extra filesystem nodes. */
function stage(keys: string[], extra: Record<string, string | null> = {}): void {
    __setFiles({
        [JETBRAINS_DIR]: null,
        [IDEA_DIR]: null,
        [`${IDEA_DIR}/options/recentProjects.xml`]: recentProjectsXml(keys),
        ...extra,
    });
}

function load(opts: Partial<ProjectLoaderOptions> = {}, app: JetBrainsApp = ideaApp) {
    return loadProjects(app, new ScanCache(), { ...defaultOpts, ...opts }, neverCancelled);
}

beforeEach(() => {
    __reset();
});

describe('project path handling', () => {
    it('expands $USER_HOME$ to the home directory', async () => {
        stage(['$USER_HOME$/work/app'], { '/home/test/work/app': null });
        const projects = await load();
        expect(projects.map(p => p.path)).toEqual(['/home/test/work/app']);
        expect(projects[0].name).toBe('app');
    });

    it('admits raw absolute paths outside $HOME', async () => {
        stage(['/srv/code/app'], { '/srv/code/app': null });
        expect((await load()).map(p => p.path)).toEqual(['/srv/code/app']);
    });

    it('drops relative paths', async () => {
        stage(['../../elsewhere'], { '../../elsewhere': null });
        expect(await load()).toEqual([]);
    });

    it('drops paths that do not exist', async () => {
        stage(['$USER_HOME$/work/gone']);
        expect(await load()).toEqual([]);
    });

    it('deduplicates repeated paths', async () => {
        stage(['$USER_HOME$/work/app', '$USER_HOME$/work/app'], { '/home/test/work/app': null });
        expect(await load()).toHaveLength(1);
    });
});

describe('Toolbox edition', () => {
    it('passes the resolved Toolbox directory to constructed projects', async () => {
        stage(['$USER_HOME$/work/app'], { '/home/test/work/app': null });
        const projects = await load({ resolvedToolboxDir: 'intellij-idea-community' });
        expect(projects[0].toolboxDir).toBe('intellij-idea-community');
    });
});

describe('XML entity decoding', () => {
    it('decodes &amp; in the entry key', async () => {
        stage(['$USER_HOME$/work/a&amp;b'], { '/home/test/work/a&b': null });
        expect((await load()).map(p => p.path)).toEqual(['/home/test/work/a&b']);
    });

    it('does not double-decode &amp;lt;', async () => {
        stage(['$USER_HOME$/work/x&amp;lt;y'], {
            '/home/test/work/x&lt;y': null,
            '/home/test/work/x<y': null,
        });
        expect((await load()).map(p => p.path)).toEqual(['/home/test/work/x&lt;y']);
    });
});

describe('config roots', () => {
    it('reads ~/.config/Google when the provider opts in', async () => {
        __setFiles({
            [GOOGLE_DIR]: null,
            [`${GOOGLE_DIR}/AndroidStudio2024.3`]: null,
            [`${GOOGLE_DIR}/AndroidStudio2024.3/options/recentProjects.xml`]:
                recentProjectsXml(['$USER_HOME$/work/droid']),
            '/home/test/work/droid': null,
        });
        expect((await load({ includeGoogleConfigDir: true }, studioApp)).map(p => p.path))
            .toEqual(['/home/test/work/droid']);
    });

    it('ignores ~/.config/Google when the provider does not opt in', async () => {
        __setFiles({
            [GOOGLE_DIR]: null,
            [`${GOOGLE_DIR}/AndroidStudio2024.3`]: null,
            [`${GOOGLE_DIR}/AndroidStudio2024.3/options/recentProjects.xml`]:
                recentProjectsXml(['$USER_HOME$/work/droid']),
            '/home/test/work/droid': null,
        });
        expect(await load({}, studioApp)).toEqual([]);
    });
});
