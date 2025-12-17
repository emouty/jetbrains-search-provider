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

    enable() {
        this.settings = this.getSettings('org.gnome.shell.extensions.jetbrains-search');

        for (const jetbrainsApp of JETBRAINS_APPS) {
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

            if (provider.projects.length > 0) {
                this.providers.push(provider);
                Main.overview.searchController.addProvider(provider);

                if (this.settings?.get_boolean("override-results-order")) {
                    const searchResults = Main.overview.searchController._searchResults;
                    searchResults._content.remove_child(provider.display);
                    searchResults._content.insert_child_at_index(provider.display, 1 + this.providers.length - 1);
                }
            }
        }
    }

    disable() {
        if (this.settings) {
            this.settings = null;
        }

        for (const provider of this.providers) {
            Main.overview.searchController.removeProvider(provider);
        }
        this.providers = [];
    }
}
