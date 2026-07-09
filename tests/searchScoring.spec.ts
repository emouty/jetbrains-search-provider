import { describe, it, expect } from 'vitest';
import { calculateSearchScore, normalizeForSearch, normalizePathForSearch } from '../src/searchScoring.js';

describe('normalizeForSearch', () => {
    it('lowercases and collapses separators into spaces', () => {
        expect(normalizeForSearch('Server-Archiver')).toBe('server archiver');
        expect(normalizeForSearch('server_api')).toBe('server api');
        expect(normalizeForSearch('my.project  name')).toBe('my project name');
    });

    it('trims leading/trailing separators', () => {
        expect(normalizeForSearch('-backend-')).toBe('backend');
    });
});

describe('normalizePathForSearch', () => {
    it('also collapses path separators', () => {
        expect(normalizePathForSearch('/home/test/work/back-end')).toBe('home test work back end');
    });
});

function score(name: string, path: string, term: string): number {
    return calculateSearchScore(
        normalizeForSearch(name),
        normalizePathForSearch(path),
        normalizeForSearch(term),
    );
}

describe('calculateSearchScore', () => {
    it('exact match → 1000', () => {
        expect(score('backend', '/home/test/backend', 'backend')).toBe(1000);
    });

    it('complete word in name → 900', () => {
        expect(score('backend-archive', '/x', 'archive')).toBe(900);
    });

    it('word-start in name → 800', () => {
        expect(score('backend-archiver', '/x', 'archive')).toBe(800);
    });

    it('name-start spanning words → 500', () => {
        expect(score('jetbrains-search-provider-test', '/x', 'jetbrains search')).toBe(500);
    });

    it('mid-name substring → 100', () => {
        expect(score('jetbrains-search-provider-test', '/x', 'search prov')).toBe(100);
    });

    it('path-only match → 50', () => {
        expect(score('other', '/home/test/workspace/other', 'workspace')).toBe(50);
    });

    it('no match → 0', () => {
        expect(score('backend', '/home/test/backend', 'xyz')).toBe(0);
    });
});
