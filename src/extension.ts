import Gio from "gi://Gio";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import { AppSearchProvider } from "resource:///org/gnome/shell/ui/appDisplay.js";
import { JETBRAINS_APPS } from "./project.js";
import BaseJetBrainsProvider from "./baseProvider.js";
import IntelliJProvider from "./intellijProvider.js";
import AndroidStudioProvider from "./androidStudioProvider.js";

// noinspection JSUnusedGlobalSymbols
export default class JetBrainsSearchProviderExtension extends Extension {
  providers: AppSearchProvider[] = [];
  _settings: Gio.Settings | null = null;

  enable() {
    this._settings = this.getSettings('org.gnome.shell.extensions.jetbrains-search');

    // Create a separate provider for each JetBrains IDE
    for (const jetbrainsApp of JETBRAINS_APPS) {
      // Use specialized providers for IntelliJ IDEA and Android Studio
      let provider: BaseJetBrainsProvider;

      if (jetbrainsApp.exec === 'idea') {
        provider = new IntelliJProvider(this, jetbrainsApp);
      } else if (jetbrainsApp.exec === 'android-studio') {
        provider = new AndroidStudioProvider(this, jetbrainsApp);
      } else {
        provider = new BaseJetBrainsProvider(this, jetbrainsApp);
      }

      if (provider.projects.length > 0) {
        this.providers.push(provider);
        Main.overview.searchController.addProvider(provider);

        if (this._settings?.get_boolean("override-results-order")) {
          const searchResults = Main.overview.searchController._searchResults;
          searchResults._content.remove_child(provider.display);
          searchResults._content.insert_child_at_index(provider.display, 1 + this.providers.length - 1);
        }
      }
    }
  }

  disable() {
    if (this._settings) {
      this._settings = null;
    }

    for (const provider of this.providers) {
      Main.overview.searchController.removeProvider(provider);
    }
    this.providers = [];
  }
}
