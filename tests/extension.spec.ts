import { describe, it, expect, beforeEach, vi } from 'vitest';
import Gio from 'gi://Gio';
import { __emitFileChange, __reset as resetFiles, __setFiles } from './mocks/gi-Gio.js';
import { __addedProviders, __reset as resetMain } from './mocks/gnome-main.js';
import { Extension } from './mocks/gnome-extension.js';
import JetBrainsSearchProviderExtension from '../src/extension.js';

const IDEA_DIR = '/home/test/.config/JetBrains/IntelliJIdea2025.1';
const XML = `${IDEA_DIR}/options/recentProjects.xml`;
const xmlWith = (...keys: string[]) =>
    `<application>${keys.map(k => `<entry key="${k}"/>`).join('')}</application>`;

/** Every fake filesystem call resolves in microtasks, so one macrotask drains them all. */
const settle = () => new Promise(resolve => setTimeout(resolve, 0));

function enabledExtension(): JetBrainsSearchProviderExtension {
    const extension = new JetBrainsSearchProviderExtension({
        uuid: 'jetbrains-search@test', name: 'test', description: 'test', 'shell-version': [],
    } as unknown as ConstructorParameters<typeof JetBrainsSearchProviderExtension>[0]);
    extension.enable();
    return extension;
}

beforeEach(() => {
    resetFiles();
    resetMain();
    __setFiles({
        '/home/test/.config/JetBrains': null,
        [IDEA_DIR]: null,
        [XML]: xmlWith(),
        '/home/test/work/keycloak': null,
    });
});

describe('late registration', () => {
    it('adds a provider to search once a reload brings its first project', async () => {
        enabledExtension();
        await settle();
        expect(__addedProviders).toHaveLength(0);

        __setFiles({ [XML]: xmlWith('$USER_HOME$/work/keycloak') });
        __emitFileChange(XML, Gio.FileMonitorEvent.CHANGES_DONE_HINT);
        await vi.waitFor(() => expect(__addedProviders).toHaveLength(1));

        __emitFileChange(XML, Gio.FileMonitorEvent.CHANGES_DONE_HINT);
        await settle();
        expect(__addedProviders).toHaveLength(1);
    });

    it('adds nothing after disable, even with a reload in flight', async () => {
        const extension = enabledExtension();
        await settle();

        __setFiles({ [XML]: xmlWith('$USER_HOME$/work/keycloak') });
        __emitFileChange(XML, Gio.FileMonitorEvent.CHANGES_DONE_HINT);
        extension.disable();
        await settle();

        expect(__addedProviders).toHaveLength(0);
    });

    it('removes the providers it added on disable', async () => {
        __setFiles({ [XML]: xmlWith('$USER_HOME$/work/keycloak') });
        const extension = enabledExtension();
        await vi.waitFor(() => expect(__addedProviders).toHaveLength(1));

        extension.disable();

        expect(__addedProviders).toHaveLength(0);
    });
});

describe('results order', () => {
    const apps = { id: 'apps', display: {} };
    const remote = { id: 'remote', display: {} };

    function enabledWith(settings: Record<string, boolean>) {
        vi.spyOn(Extension.prototype, 'getSettings')
            .mockReturnValueOnce({ get_boolean: (key: string) => settings[key] ?? false });
        __addedProviders.push(apps, remote);
        __setFiles({ [XML]: xmlWith('$USER_HOME$/work/keycloak') });
        return enabledExtension();
    }

    it('moves the provider after apps when the first result is selected', async () => {
        enabledWith({ 'override-results-order': true, 'select-first-result': true });
        await vi.waitFor(() => expect(__addedProviders).toHaveLength(3));

        expect(__addedProviders.indexOf(apps)).toBe(0);
        expect(__addedProviders.indexOf(remote)).toBe(2);
    });

    it.each<Record<string, boolean>>([
        { 'override-results-order': true },
        { 'select-first-result': true },
    ])('keeps the provider order unless both settings are on: %o', async settings => {
        enabledWith(settings);
        await vi.waitFor(() => expect(__addedProviders).toHaveLength(3));

        expect(__addedProviders.slice(0, 2)).toEqual([apps, remote]);
    });
});
