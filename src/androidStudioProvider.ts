import BaseJetBrainsProvider from "./baseProvider.js";

/**
 * Android Studio Search Provider
 *
 * Specialized provider for Android Studio, which keeps its recent-project
 * config under ~/.config/Google (e.g. ~/.config/Google/AndroidStudio2024.3)
 * instead of ~/.config/JetBrains like the other IDEs.
 */
export default class AndroidStudioProvider extends BaseJetBrainsProvider {
    protected usesGoogleConfigDir(): boolean {
        return true;
    }
}
