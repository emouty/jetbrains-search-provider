import GLib from "gi://GLib";
import Gio from "gi://Gio";
import BaseJetBrainsProvider from "./baseProvider.js";

/**
 * IntelliJ IDEA Search Provider
 *
 * Specialized provider for IntelliJ IDEA that excludes Android Studio projects.
 * Android Studio projects are identified by the presence of AndroidProjectSystem.xml
 * in the .idea directory.
 */
export default class IntelliJProvider extends BaseJetBrainsProvider {
    protected shouldIncludeProject(projectPath: string, cancellable: Gio.Cancellable | null): boolean {
        const androidSystemFile = GLib.build_filenamev([
            projectPath, '.idea', 'AndroidProjectSystem.xml'
        ]);
        const file = Gio.File.new_for_path(androidSystemFile);
        // Exclude Android Studio projects (return false if it's an Android project)
        return !file.query_exists(cancellable);
    }
}

