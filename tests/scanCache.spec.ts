import { describe, it, expect, beforeEach } from 'vitest';
import type Gio from 'gi://Gio';
import { __reset, __setFiles, __getEnumerateCount } from './mocks/gi-Gio.js';
import { ScanCache } from '../src/scanCache.js';

const DESKTOP_DIR = '/home/test/.local/share/applications';
const CONFIG_DIR = '/home/test/.config/JetBrains';

const neverCancelled = { is_cancelled: () => false } as unknown as Gio.Cancellable;
const cancelled = { is_cancelled: () => true } as unknown as Gio.Cancellable;

beforeEach(() => {
    __reset();
});

describe('getDesktopEntries', () => {
    it('returns .desktop files with lowercase variants', async () => {
        __setFiles({
            [DESKTOP_DIR]: null,
            [`${DESKTOP_DIR}/jetbrains-IDEA.desktop`]: '[Desktop Entry]',
            [`${DESKTOP_DIR}/notes.txt`]: 'not a desktop file',
        });
        const entries = await new ScanCache().getDesktopEntries(neverCancelled);
        expect(entries).toEqual([
            { filename: 'jetbrains-IDEA.desktop', lowerFilename: 'jetbrains-idea.desktop' },
        ]);
    });

    it('enumerates the directory only once for concurrent calls', async () => {
        __setFiles({
            [DESKTOP_DIR]: null,
            [`${DESKTOP_DIR}/a.desktop`]: '',
        });
        const cache = new ScanCache();
        const [first, second] = await Promise.all([
            cache.getDesktopEntries(neverCancelled),
            cache.getDesktopEntries(neverCancelled),
        ]);
        expect(first).toEqual(second);
        expect(__getEnumerateCount(DESKTOP_DIR)).toBe(1);
    });

    it('resolves to empty array when the directory is missing', async () => {
        await expect(new ScanCache().getDesktopEntries(neverCancelled)).resolves.toEqual([]);
    });

    it('rejects on cancellation', async () => {
        __setFiles({ [DESKTOP_DIR]: null });
        await expect(new ScanCache().getDesktopEntries(cancelled)).rejects.toThrow();
    });
});

describe('getDesktopFileContents', () => {
    it('returns lowercased contents and memoizes per filename', async () => {
        __setFiles({
            [DESKTOP_DIR]: null,
            [`${DESKTOP_DIR}/jetbrains-idea.desktop`]: 'Name=IntelliJ IDEA',
        });
        const cache = new ScanCache();
        const a = await cache.getDesktopFileContents('jetbrains-idea.desktop', neverCancelled);
        const b = await cache.getDesktopFileContents('jetbrains-idea.desktop', neverCancelled);
        expect(a).toBe('name=intellij idea');
        expect(b).toBe(a);
    });

    it('returns null for a missing file', async () => {
        await expect(new ScanCache().getDesktopFileContents('nope.desktop', neverCancelled))
            .resolves.toBeNull();
    });
});

describe('getConfigDirNames', () => {
    it('returns only directories', async () => {
        __setFiles({
            [CONFIG_DIR]: null,
            [`${CONFIG_DIR}/IntelliJIdea2025.1`]: null,
            [`${CONFIG_DIR}/stray-file.txt`]: 'noise',
        });
        const names = await new ScanCache().getConfigDirNames(neverCancelled);
        expect(names).toEqual(['IntelliJIdea2025.1']);
    });

    it('enumerates the directory only once across calls', async () => {
        __setFiles({
            [CONFIG_DIR]: null,
            [`${CONFIG_DIR}/GoLand2025.1`]: null,
        });
        const cache = new ScanCache();
        await cache.getConfigDirNames(neverCancelled);
        await cache.getConfigDirNames(neverCancelled);
        expect(__getEnumerateCount(CONFIG_DIR)).toBe(1);
    });

    it('resolves to empty array when ~/.config/JetBrains is missing', async () => {
        await expect(new ScanCache().getConfigDirNames(neverCancelled)).resolves.toEqual([]);
    });
});

describe('getRecentProjectsXml', () => {
    it('reads and memoizes the xml per config dir name', async () => {
        const xml = '<application><entry key="$USER_HOME$/work/app"/></application>';
        __setFiles({
            [`${CONFIG_DIR}/IntelliJIdea2025.1/options/recentProjects.xml`]: xml,
        });
        const cache = new ScanCache();
        const a = await cache.getRecentProjectsXml('IntelliJIdea2025.1', neverCancelled);
        const b = await cache.getRecentProjectsXml('IntelliJIdea2025.1', neverCancelled);
        expect(a).toBe(xml);
        expect(b).toBe(xml);
    });

    it('returns null when the xml does not exist', async () => {
        await expect(new ScanCache().getRecentProjectsXml('GoLand2025.1', neverCancelled))
            .resolves.toBeNull();
    });
});
