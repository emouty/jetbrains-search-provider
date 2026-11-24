import Gio from "gi://Gio";
import Adw from "gi://Adw";

import {ExtensionPreferences, gettext as _,} from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

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

        const selectFirstResult = new Adw.SwitchRow({
            title: _("Select First Result"),
            subtitle: _(
                "If enabled, the first JetBrains project is selected by default, so Enter opens it." +
                " Also turns on Override Results Order. Requires disabling and re-enabling the extension to take effect.",
            ),
        });
        group.add(selectFirstResult);
        this._settings!.bind(
            "select-first-result",
            selectFirstResult,
            "active",
            Gio.SettingsBindFlags.DEFAULT,
        );
        // Selecting the first result only works on top of the order override.
        selectFirstResult.connect("notify::active", () => {
            if (selectFirstResult.active) {
                overrideResultsOrder.active = true;
            }
        });
        overrideResultsOrder.connect("notify::active", () => {
            if (!overrideResultsOrder.active) {
                selectFirstResult.active = false;
            }
        });

        return page;
    }
}
