import { describe, it, expect, beforeEach } from 'vitest';
import type Gio from 'gi://Gio';
import { __reset, __setFiles, __getSpawnedArgv } from './mocks/gi-Gio.js';
import { JetBrainsProject } from '../src/project.js';

const PROJECT_PATH = '/home/test/work/app';
const TOOLBOX_BIN = '/home/test/.local/share/JetBrains/Toolbox/apps/intellij-idea-community/bin/idea';

function proj(toolboxDir: string | null): JetBrainsProject {
    return new JetBrainsProject('app', PROJECT_PATH, 'IntelliJ IDEA', 'idea', toolboxDir, 'idea.svg');
}

/** Minimal stand-in for the provider's Gio.AppInfo; launch() only calls launch_uris. */
function fakeAppInfo(result: boolean | Error) {
    const calls: string[][] = [];
    const appInfo = {
        calls,
        launch_uris: (uris: string[]) => {
            calls.push(uris);
            if (result instanceof Error) throw result;
            return result;
        },
    };
    return appInfo;
}

beforeEach(() => {
    __reset();
});

describe('launch', () => {
    it('prefers the Toolbox binary when it exists', () => {
        __setFiles({ [TOOLBOX_BIN]: '' });
        const appInfo = fakeAppInfo(true);

        proj('intellij-idea-community').launch(appInfo as unknown as Gio.AppInfo);

        expect(__getSpawnedArgv()).toEqual([[TOOLBOX_BIN, PROJECT_PATH]]);
        expect(appInfo.calls).toEqual([]);
    });

    it('skips the Toolbox leg when no edition is installed', () => {
        const appInfo = fakeAppInfo(true);

        proj(null).launch(appInfo as unknown as Gio.AppInfo);

        expect(appInfo.calls).toEqual([[`file://${PROJECT_PATH}`]]);
        expect(__getSpawnedArgv()).toEqual([]);
    });

    it('uses the app info when the Toolbox binary is missing', () => {
        const appInfo = fakeAppInfo(true);

        proj('intellij-idea-community').launch(appInfo as unknown as Gio.AppInfo);

        expect(appInfo.calls).toEqual([[`file://${PROJECT_PATH}`]]);
        expect(__getSpawnedArgv()).toEqual([]);
    });

    it('falls back to the system command when no app info was resolved', () => {
        proj(null).launch(null);

        expect(__getSpawnedArgv()).toEqual([['idea', PROJECT_PATH]]);
    });

    it('falls back to the system command when the app info launch fails', () => {
        const appInfo = fakeAppInfo(new Error('no such app'));

        proj(null).launch(appInfo as unknown as Gio.AppInfo);

        expect(appInfo.calls).toHaveLength(1);
        expect(__getSpawnedArgv()).toEqual([['idea', PROJECT_PATH]]);
    });
});
