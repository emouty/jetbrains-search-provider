import Gio from "gi://Gio";
import Adw from "gi://Adw";

import {ExtensionPreferences, gettext as _,} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

// noinspection JSUnusedGlobalSymbols
export default class JetBrainsPreferences extends ExtensionPreferences {
    _settings: Gio.Settings | null = null;

    // The default fillPreferencesWindow adds a returned PreferencesPage as is, which keeps the
    // deprecated Adw.PreferencesWindow API out of this file. Must stay synchronous: Shell 45 does
    // not await getPreferencesWidget().
    getPreferencesWidget(): Adw.PreferencesPage {
        this._settings = this.getSettings('org.gnome.shell.extensions.jetbrains-search');

        const page = new Adw.PreferencesPage({
            title: _("General"),
            icon_name: "dialog-information-symbolic",
        });

        const group = new Adw.PreferencesGroup({
            title: _("Search Results"),
            description: _("Configure the search results behavior"),
        });

        page.add(group);

        const overrideResultsOrder = new Adw.SwitchRow({
            title: _("Override Results Order"),
            subtitle: _(
                "If enabled, the extension will override the default search results order to prioritize JetBrains projects." +
                " Will place the results directly underneath applications. Requires disabling and re-enabling the" +
                " extension to take effect.",
            ),
        });
        group.add(overrideResultsOrder);
        this._settings!.bind(
            "override-results-order",
            overrideResultsOrder,
            "active",
            Gio.SettingsBindFlags.DEFAULT,
        );

        return page;
    }
}
