import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import {Extension} from "resource:///org/gnome/shell/extensions/extension.js";
import {AppSearchProvider} from "resource:///org/gnome/shell/ui/appDisplay.js";
import BaseJetBrainsProvider from "./baseProvider.js";
import IntelliJProvider from "./intellijProvider.js";
import AndroidStudioProvider from "./androidStudioProvider.js";
import {JETBRAINS_APPS} from "./jetBrainsApp.js";

// noinspection JSUnusedGlobalSymbols
export default class JetBrainsSearchProviderExtension extends Extension {
    providers: AppSearchProvider[] = [];
    settings: Gio.Settings | null = null;
    private _initCancellable: Gio.Cancellable | null = null;

    enable() {
        this.settings = this.getSettings('org.gnome.shell.extensions.jetbrains-search');
        this._initCancellable = new Gio.Cancellable();

        this._initializeProvidersAsync(this._initCancellable).catch(e => {
            console.error(`JetBrains Search Provider: Failed to initialize: ${e}`);
        });
    }

    private async _initializeProvidersAsync(cancellable: Gio.Cancellable) {

        for (const jetbrainsApp of JETBRAINS_APPS) {
            if (cancellable.is_cancelled()) {
                break;
            }

            let provider: BaseJetBrainsProvider;
            switch (jetbrainsApp.exec) {
                case 'idea':
                    provider = new IntelliJProvider(this, jetbrainsApp);
                    break;
                case 'android-studio':
                    provider = new AndroidStudioProvider(this, jetbrainsApp);
                    break;
                default:
                    provider = new BaseJetBrainsProvider(this, jetbrainsApp);
                    break;
            }

            try {
                await provider.initialize(cancellable);

                if (provider.projects.length > 0) {
                    this.providers.push(provider);
                    Main.overview.searchController.addProvider(provider);

                    if (this.settings?.get_boolean("override-results-order")) {
                        const searchResults = Main.overview.searchController._searchResults;
                        searchResults._content.remove_child(provider.display);
                        searchResults._content.insert_child_at_index(provider.display, this.providers.length);
                    }
                }
            } catch (e) {
                console.error(`JetBrains Search Provider: Failed to initialize ${jetbrainsApp.name} provider: ${e}`);
            }
        }
    }

    disable() {
        this._initCancellable?.cancel();
        this._initCancellable = null;
        this.settings = null;

        for (const provider of this.providers) {
            Main.overview.searchController.removeProvider(provider);
        }
        this.providers = [];
    }
}
