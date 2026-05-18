import GLib from "gi://GLib";
import Gio from "gi://Gio";
import {Extension} from "resource:///org/gnome/shell/extensions/extension.js";
import BaseJetBrainsProvider from "./baseProvider.js";

import {JetBrainsApp} from "./jetBrainsApp.js";

/**
 * Android Studio Search Provider
 *
 * Specialized provider for Android Studio that only includes Android projects
 * and also searches IntelliJ IDEA config directories. Android Studio projects
 * are identified by the presence of AndroidProjectSystem.xml in the .idea directory.
 */
export default class AndroidStudioProvider extends BaseJetBrainsProvider {
    constructor(extension: Extension, jetbrainsApp: JetBrainsApp) {
        super(extension, jetbrainsApp);
    }

    protected shouldIncludeProject(projectPath: string): boolean {
        const androidSystemFile = GLib.build_filenamev([
            projectPath, '.idea', 'AndroidProjectSystem.xml'
        ]);
        const file = Gio.File.new_for_path(androidSystemFile);
        // Only include Android Studio projects
        return file.query_exists(null);
    }


    protected getAdditionalConfigPatterns(): RegExp[] {
        return [
            new RegExp(`^\\.IntelliJIdea\\d{4}\\.\\d+`, 'i'),
            new RegExp(`^IntelliJIdea\\d{4}\\.\\d+`, 'i'),
            new RegExp(`^_IntelliJIdea\\d{4}\\.\\d+`, 'i'),
            new RegExp(`^IdeaIC\\d{4}\\.\\d+`, 'i')
        ];
    }
}

