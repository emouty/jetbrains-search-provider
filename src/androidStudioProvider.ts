import GLib from "gi://GLib";
import Gio from "gi://Gio";
import BaseJetBrainsProvider from "./baseProvider.js";

/**
 * Android Studio Search Provider
 *
 * Specialized provider for Android Studio that only includes Android projects
 * and also searches IntelliJ IDEA config directories. Android Studio projects
 * are identified by the presence of AndroidProjectSystem.xml in the .idea directory.
 */
export default class AndroidStudioProvider extends BaseJetBrainsProvider {
    protected shouldIncludeProject(projectPath: string, cancellable: Gio.Cancellable | null): boolean {
        const androidSystemFile = GLib.build_filenamev([
            projectPath, '.idea', 'AndroidProjectSystem.xml'
        ]);
        const file = Gio.File.new_for_path(androidSystemFile);
        // Only include Android Studio projects
        return file.query_exists(cancellable);
    }

    protected usesGoogleConfigDir(): boolean {
        return true;
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

