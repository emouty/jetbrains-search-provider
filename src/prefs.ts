import Gio from "gi://Gio";
import Adw from "gi://Adw";

import { ExtensionPreferences, gettext as _, } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

type Window = Adw.PreferencesWindow & {
  _settings: Gio.Settings | null;
};
// noinspection JSUnusedGlobalSymbols
export default class JetBrainsPreferences extends ExtensionPreferences {
  _settings: Gio.Settings | null = null;

  fillPreferencesWindow(window: Window) {
    // Create a settings object
    window._settings = this.getSettings('org.gnome.shell.extensions.jetbrains-search');

    // Create a preferences page, with a single group
    const page = new Adw.PreferencesPage({
      title: _("General"),
      icon_name: "dialog-information-symbolic",
    });
    window.add(page);

    const group = new Adw.PreferencesGroup({
      title: _("Search Results"),
      description: _("Configure the search results behavior"),
    });

    page.add(group);

    const overrideResultsOrder = new Adw.SwitchRow({
      title: _("Override Results Order"),
      subtitle: _(
        "If enabled, the extension will override the default search results order to prioritize JetBrains projects. Will place the results directly underneath applications. Requires disabling and re-enabling the extension to take effect.",
      ),
    });
    group.add(overrideResultsOrder);
    window._settings.bind(
      "override-results-order",
      overrideResultsOrder,
      "active",
      Gio.SettingsBindFlags.DEFAULT,
    );
  }
}
