import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import {Extension} from "resource:///org/gnome/shell/extensions/extension.js";
import {AppSearchProvider} from "resource:///org/gnome/shell/ui/appDisplay.js";
import BaseJetBrainsProvider from "./baseProvider.js";
import AndroidStudioProvider from "./androidStudioProvider.js";
import {JETBRAINS_APPS} from "./jetBrainsApp.js";
import {ScanCache} from "./scanCache.js";

export default class JetBrainsSearchProviderExtension extends Extension {
    providers: AppSearchProvider[] = [];
    settings: Gio.Settings | null = null;
    private _initCancellable: Gio.Cancellable | null = null;
    private _watchedProviders: BaseJetBrainsProvider[] = [];

    enable() {
        this.settings = this.getSettings('org.gnome.shell.extensions.jetbrains-search');
        this._initCancellable = new Gio.Cancellable();

        this._initializeProvidersAsync(this._initCancellable, new ScanCache()).catch(e => {
            console.error(`JetBrains Search Provider: Failed to initialize: ${e}`);
        });
    }

    private async _initializeProvidersAsync(cancellable: Gio.Cancellable, scanCache: ScanCache) {
        // Initialize all providers concurrently; the ScanCache deduplicates the
        // underlying directory scans.
        const providers = JETBRAINS_APPS.map(jetbrainsApp => {
            switch (jetbrainsApp.exec) {
                case 'android-studio':
                    return new AndroidStudioProvider(this, jetbrainsApp, scanCache);
                default:
                    return new BaseJetBrainsProvider(this, jetbrainsApp, scanCache);
            }
        });

        const results = await Promise.allSettled(
            providers.map(provider => provider.initialize(cancellable))
        );

        // Nothing may register after disable(); the registration loop below is
        // fully synchronous, so this single check is sufficient.
        if (cancellable.is_cancelled()) {
            return;
        }

        providers.forEach((provider, i) => {
            const result = results[i];
            if (result.status === 'rejected') {
                console.error(`JetBrains Search Provider: Failed to initialize ${JETBRAINS_APPS[i].name} provider: ${result.reason}`);
                return;
            }

            const name = JETBRAINS_APPS[i].name;
            this._watchedProviders.push(provider);
            provider.watchProjects(() => this._registerProvider(provider, name));
            this._registerProvider(provider, name);
        });
    }

    /** Add the provider to the shell search once it has projects; a reload can bring the first ones. */
    private _registerProvider(provider: BaseJetBrainsProvider, name: string) {
        if (provider.projects.length === 0 || this.providers.includes(provider)) {
            return;
        }

        this.providers.push(provider);
        Main.overview.searchController.addProvider(provider);

        // provider.display stays unset when the shell skips the provider (parental controls).
        if (this.settings?.get_boolean("override-results-order") && provider.display) {
            try {
                const searchResults = Main.overview.searchController._searchResults;
                searchResults._content.remove_child(provider.display);
                searchResults._content.insert_child_at_index(provider.display, this.providers.length);
                // The shell picks the default result in _providers order, not display order.
                const providers = searchResults._providers;
                const index = providers.indexOf(provider);
                if (this.settings.get_boolean("select-first-result") && index >= 0) {
                    providers.splice(index, 1);
                    providers.splice(this.providers.length, 0, provider);
                }
            } catch (e) {
                console.warn(`JetBrains Search Provider: Could not reorder ${name} results: ${e}`);
            }
        }
    }

    disable() {
        this._initCancellable?.cancel();
        this._initCancellable = null;
        this.settings = null;

        for (const provider of this._watchedProviders) {
            provider.unwatchProjects();
        }
        this._watchedProviders = [];

        for (const provider of this.providers) {
            Main.overview.searchController.removeProvider(provider);
        }
        this.providers = [];
    }
}
