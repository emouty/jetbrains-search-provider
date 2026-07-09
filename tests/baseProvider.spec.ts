import { describe, it, expect } from 'vitest';
import type Gio from 'gi://Gio';
import type { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import BaseJetBrainsProvider from '../src/baseProvider.js';
import { JetBrainsProject } from '../src/project.js';
import type { JetBrainsApp } from '../src/jetBrainsApp.js';

const ideaApp: JetBrainsApp = {
    name: 'IntelliJ IDEA',
    exec: 'idea',
    configDir: '.IntelliJIdea',
    toolboxDir: '',
    iconFile: 'idea.svg',
};

const fakeExtension = { uuid: 'jetbrains-search@test' } as unknown as Extension;
const neverCancelled = { is_cancelled: () => false } as unknown as Gio.Cancellable;
const cancelled = { is_cancelled: () => true } as unknown as Gio.Cancellable;

function makeProvider(projects: JetBrainsProject[]): BaseJetBrainsProvider {
    const p = new BaseJetBrainsProvider(fakeExtension, ideaApp);
    p.projects = projects;
    return p;
}

function proj(name: string, path: string): JetBrainsProject {
    return new JetBrainsProject(name, path, 'IntelliJ IDEA', 'idea', '', '');
}

// Replicates BaseJetBrainsProvider._getProjectId
function id(path: string): string {
    return `idea-${path.replace(/\//g, '_')}`;
}

// ── getInitialResultSet ──────────────────────────────────────────────────────

describe('getInitialResultSet', () => {
    it('returns empty array when no projects match', async () => {
        const p = makeProvider([proj('backend', '/home/test/backend')]);
        expect(await p.getInitialResultSet(['xyz'], neverCancelled)).toEqual([]);
    });

    it('returns matching project id', async () => {
        const p = makeProvider([proj('backend', '/home/test/backend')]);
        expect(await p.getInitialResultSet(['backend'], neverCancelled))
            .toEqual([id('/home/test/backend')]);
    });

    it('case-insensitive matching', async () => {
        const p = makeProvider([proj('MyProject', '/home/test/MyProject')]);
        expect(await p.getInitialResultSet(['myproject'], neverCancelled))
            .toEqual([id('/home/test/MyProject')]);
    });

    it('exact match (1000) outranks substring match (100)', async () => {
        const p = makeProvider([
            proj('super-backend', '/home/test/super-backend'),
            proj('backend', '/home/test/backend'),
        ]);
        const [first] = await p.getInitialResultSet(['backend'], neverCancelled);
        expect(first).toBe(id('/home/test/backend'));
    });

    it('word match (900) outranks word-start match (800)', async () => {
        // 'archive' is a complete word in 'backend-archive' → 900
        // 'archive' starts a word in 'backend-archiver' → 800
        const p = makeProvider([
            proj('backend-archiver', '/home/test/backend-archiver'),
            proj('backend-archive', '/home/test/backend-archive'),
        ]);
        const [first] = await p.getInitialResultSet(['archive'], neverCancelled);
        expect(first).toBe(id('/home/test/backend-archive'));
    });

    it('name match outranks path-only match', async () => {
        // 'workspace-tool' has 'workspace' in name → ≥100
        // 'other' only has 'workspace' in its path → 50
        const p = makeProvider([
            proj('other', '/home/test/workspace/other'),
            proj('workspace-tool', '/home/test/workspace-tool'),
        ]);
        const [first, second] = await p.getInitialResultSet(['workspace'], neverCancelled);
        expect(first).toBe(id('/home/test/workspace-tool'));
        expect(second).toBe(id('/home/test/workspace/other'));
    });

    it('path-only match is included (score 50)', async () => {
        const p = makeProvider([proj('other', '/home/test/workspace/other')]);
        expect(await p.getInitialResultSet(['workspace'], neverCancelled))
            .toEqual([id('/home/test/workspace/other')]);
    });

    it('multi-term: terms joined as phrase match "server-archiver"', async () => {
        // ['server','archiver'] → searchTerm 'server archiver'
        // 'server-archiver' normalizes to 'server archiver' → exact match (1000)
        const p = makeProvider([proj('server-archiver', '/home/test/server-archiver')]);
        expect(await p.getInitialResultSet(['server', 'archiver'], neverCancelled))
            .toEqual([id('/home/test/server-archiver')]);
    });

    it('dash in name treated same as space in search', async () => {
        const p = makeProvider([proj('server-api', '/home/test/server-api')]);
        expect(await p.getInitialResultSet(['server', 'api'], neverCancelled))
            .toEqual([id('/home/test/server-api')]);
    });

    it('underscore in name treated same as space in search', async () => {
        const p = makeProvider([proj('server_api', '/home/test/server_api')]);
        expect(await p.getInitialResultSet(['server', 'api'], neverCancelled))
            .toEqual([id('/home/test/server_api')]);
    });

    it('limits results to 10', async () => {
        const projects = Array.from({ length: 15 }, (_, i) =>
            proj(`project-${i}`, `/home/test/project-${i}`),
        );
        const p = makeProvider(projects);
        expect(await p.getInitialResultSet(['project'], neverCancelled)).toHaveLength(10);
    });

    it('equal-score results sorted alphabetically by name', async () => {
        // All match 'backend' as a complete word → equal score 900
        const p = makeProvider([
            proj('zeta-backend', '/home/test/zeta-backend'),
            proj('alpha-backend', '/home/test/alpha-backend'),
            proj('mango-backend', '/home/test/mango-backend'),
        ]);
        expect(await p.getInitialResultSet(['backend'], neverCancelled)).toEqual([
            id('/home/test/alpha-backend'),
            id('/home/test/mango-backend'),
            id('/home/test/zeta-backend'),
        ]);
    });

    it('throws when cancellable is cancelled', async () => {
        const p = makeProvider([]);
        await expect(p.getInitialResultSet(['test'], cancelled)).rejects.toThrow();
    });
});

// ── long project names ───────────────────────────────────────────────────────

describe('long project names', () => {
    const longProj = proj('jetbrains-search-provider-test', '/home/test/jetbrains-search-provider-test');
    // normalizedName: 'jetbrains search provider test'

    it('all terms exact → score 1000', async () => {
        const p = makeProvider([longProj]);
        expect(await p.getInitialResultSet(['jetbrains', 'search', 'provider', 'test'], neverCancelled))
            .toEqual([id('/home/test/jetbrains-search-provider-test')]);
    });

    it('middle word → word match (900)', async () => {
        const p = makeProvider([longProj]);
        expect(await p.getInitialResultSet(['provider'], neverCancelled))
            .toEqual([id('/home/test/jetbrains-search-provider-test')]);
    });

    it('word prefix → word-start match (800)', async () => {
        const p = makeProvider([longProj]);
        expect(await p.getInitialResultSet(['provid'], neverCancelled))
            .toEqual([id('/home/test/jetbrains-search-provider-test')]);
    });

    it('multi-term name prefix → name-start match (500)', async () => {
        // searchTerm 'jetbrains search' is a prefix of normalizedName but spans two words
        const p = makeProvider([longProj]);
        expect(await p.getInitialResultSet(['jetbrains', 'search'], neverCancelled))
            .toEqual([id('/home/test/jetbrains-search-provider-test')]);
    });

    it('mid-name multi-term substring → score 100', async () => {
        // 'search prov' appears inside the name but is not a prefix of any word or the whole name
        const p = makeProvider([longProj]);
        expect(await p.getInitialResultSet(['search', 'prov'], neverCancelled))
            .toEqual([id('/home/test/jetbrains-search-provider-test')]);
    });

    it('short exact name outranks long name with word match', async () => {
        // 'provider' exact (1000) vs 'jetbrains-search-provider-test' word match (900)
        const p = makeProvider([
            longProj,
            proj('provider', '/home/test/provider'),
        ]);
        const [first] = await p.getInitialResultSet(['provider'], neverCancelled);
        expect(first).toBe(id('/home/test/provider'));
    });

    it('unrelated term does not match long name', async () => {
        const p = makeProvider([longProj]);
        expect(await p.getInitialResultSet(['goland'], neverCancelled)).toEqual([]);
    });
});

// ── getSubsearchResultSet ────────────────────────────────────────────────────

describe('getSubsearchResultSet', () => {
    it('filters out non-matching previous results', async () => {
        const p = makeProvider([
            proj('backend', '/home/test/backend'),
            proj('frontend', '/home/test/frontend'),
        ]);
        const previous = [id('/home/test/backend'), id('/home/test/frontend')];
        expect(await p.getSubsearchResultSet(previous, ['front'], neverCancelled))
            .toEqual([id('/home/test/frontend')]);
    });

    it('returns empty when nothing matches refined terms', async () => {
        const p = makeProvider([proj('backend', '/home/test/backend')]);
        expect(await p.getSubsearchResultSet([id('/home/test/backend')], ['xyz'], neverCancelled))
            .toEqual([]);
    });

    it('re-sorts previous results by new score', async () => {
        const p = makeProvider([
            proj('search-backend', '/home/test/search-backend'),
            proj('backend', '/home/test/backend'),
        ]);
        // Provide results in wrong order; re-scoring puts exact match first
        const previous = [id('/home/test/search-backend'), id('/home/test/backend')];
        const [first] = await p.getSubsearchResultSet(previous, ['backend'], neverCancelled);
        expect(first).toBe(id('/home/test/backend'));
    });

    it('silently drops ids not present in projects', async () => {
        const p = makeProvider([proj('backend', '/home/test/backend')]);
        const previous = ['idea-_nonexistent', id('/home/test/backend')];
        expect(await p.getSubsearchResultSet(previous, ['backend'], neverCancelled))
            .toEqual([id('/home/test/backend')]);
    });

    it('throws when cancellable is cancelled', async () => {
        const p = makeProvider([]);
        await expect(p.getSubsearchResultSet([], ['test'], cancelled)).rejects.toThrow();
    });
});

// ── filterResults ────────────────────────────────────────────────────────────

describe('filterResults', () => {
    it('returns all results when count <= maxResults', () => {
        const p = makeProvider([]);
        expect(p.filterResults(['a', 'b', 'c'], 5)).toEqual(['a', 'b', 'c']);
    });

    it('returns all results when count === maxResults', () => {
        const p = makeProvider([]);
        expect(p.filterResults(['a', 'b'], 2)).toEqual(['a', 'b']);
    });

    it('truncates to maxResults', () => {
        const p = makeProvider([]);
        expect(p.filterResults(['a', 'b', 'c', 'd'], 2)).toEqual(['a', 'b']);
    });

    it('handles empty results', () => {
        const p = makeProvider([]);
        expect(p.filterResults([], 10)).toEqual([]);
    });
});

// ── getResultMetas ───────────────────────────────────────────────────────────

describe('getResultMetas', () => {
    it('returns meta with correct shape for known project', async () => {
        const p = makeProvider([proj('backend', '/home/test/backend')]);
        const [meta] = await p.getResultMetas([id('/home/test/backend')], neverCancelled);
        expect(meta.id).toBe(id('/home/test/backend'));
        expect(meta.name).toBe('backend');
        expect(meta.description).toBe('/home/test/backend');
        expect(typeof meta.createIcon).toBe('function');
    });

    it('returns unknown-project meta for unrecognised id', async () => {
        const p = makeProvider([]);
        const [meta] = await p.getResultMetas(['idea-_unknown'], neverCancelled);
        expect(meta.name).toBe('Unknown Project');
    });

    it('createIcon returns a truthy icon object', async () => {
        const p = makeProvider([proj('backend', '/home/test/backend')]);
        const [meta] = await p.getResultMetas([id('/home/test/backend')], neverCancelled);
        expect(meta.createIcon(32)).toBeTruthy();
    });

    it('throws when cancellable is cancelled', async () => {
        const p = makeProvider([]);
        await expect(p.getResultMetas([], cancelled)).rejects.toThrow();
    });
});

// ── projects setter / id map ─────────────────────────────────────────────────

describe('projects assignment', () => {
    it('reassigning projects updates id lookups', async () => {
        const p = makeProvider([proj('backend', '/home/test/backend')]);
        p.projects = [proj('frontend', '/home/test/frontend')];

        const [meta] = await p.getResultMetas([id('/home/test/frontend')], neverCancelled);
        expect(meta.name).toBe('frontend');

        const [stale] = await p.getResultMetas([id('/home/test/backend')], neverCancelled);
        expect(stale.name).toBe('Unknown Project');
    });

    it('activateResult launches the project resolved by id', () => {
        const project = proj('backend', '/home/test/backend');
        let launched = 0;
        project.launch = () => { launched++; };
        const p = makeProvider([project]);

        p.activateResult(id('/home/test/backend'), []);
        p.activateResult('idea-_nonexistent', []);
        expect(launched).toBe(1);
    });
});
