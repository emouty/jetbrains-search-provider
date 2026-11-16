import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Shell from "gi://Shell";
import {Extension} from "resource:///org/gnome/shell/extensions/extension.js";
import {AppSearchProvider, ResultMeta} from "resource:///org/gnome/shell/ui/appDisplay.js";
import {JetBrainsProject} from "./project.js";
import {JetBrainsApp} from "./jetBrainsApp.js";
import {calculateSearchScore, normalizeForSearch} from "./searchScoring.js";
import {findJetBrainsApp} from "./appDiscovery.js";
import {loadProjects} from "./projectLoader.js";
import {ScanCache} from "./scanCache.js";

/**
 * Base JetBrains Search Provider for GNOME Shell
 *
 * Provides core search functionality for JetBrains IDE projects through GNOME Shell's
 * search interface. This base class handles project discovery, search, and result creation
 * for any JetBrains IDE.
 */
export default class BaseJetBrainsProvider implements AppSearchProvider {
    protected extension: Extension;
    protected app: Shell.App | undefined;
    protected jetbrainsApp: JetBrainsApp;
    protected scanCache: ScanCache;
    /** Installed Toolbox edition directory, or null when the IDE is not installed via Toolbox. */
    protected resolvedToolboxDir: string | null = null;

    private _projects: JetBrainsProject[] = [];
    private _projectsById = new Map<string, JetBrainsProject>();

    // Set by GNOME Shell's search framework when the provider is registered
    display!: Clutter.Actor;

    constructor(extension: Extension, jetbrainsApp: JetBrainsApp, scanCache: ScanCache) {
        this.extension = extension;
        this.jetbrainsApp = jetbrainsApp;
        this.scanCache = scanCache;
    }

    get projects(): JetBrainsProject[] {
        return this._projects;
    }

    set projects(projects: JetBrainsProject[]) {
        this._projects = projects;
        this._projectsById = new Map(projects.map(p => [this._getProjectId(p), p]));
    }

    /**
     * Initialize the provider by loading the app and projects asynchronously.
     *
     * This method should be called immediately after construction to complete
     * the provider initialization. It performs asynchronous operations that
     * cannot be done in the constructor.
     *
     * @param cancellable - Optional cancellable for the operation
     */
    async initialize(cancellable: Gio.Cancellable | null = null): Promise<void> {
        if (cancellable?.is_cancelled()) {
            throw new Error('Initialization cancelled');
        }

        this.app = await findJetBrainsApp(this.jetbrainsApp, this.scanCache, cancellable);

        if (cancellable?.is_cancelled()) {
            throw new Error('Initialization cancelled');
        }

        this.resolvedToolboxDir = this._resolveToolboxDir(cancellable);

        this.projects = await loadProjects(this.jetbrainsApp, this.scanCache, {
            includeGoogleConfigDir: this.usesGoogleConfigDir(),
            resolvedToolboxDir: this.resolvedToolboxDir,
        }, cancellable);
    }

    /** First Toolbox edition directory that exists, or null when none is installed. */
    private _resolveToolboxDir(cancellable: Gio.Cancellable | null): string | null {
        const appsDir = GLib.build_filenamev([
            GLib.get_home_dir(), '.local', 'share', 'JetBrains', 'Toolbox', 'apps'
        ]);

        return this.jetbrainsApp.toolboxDirs.find(dir =>
            Gio.File.new_for_path(GLib.build_filenamev([appsDir, dir])).query_exists(cancellable)
        ) ?? null;
    }

    /** Only Android Studio keeps config outside ~/.config/JetBrains. */
    protected usesGoogleConfigDir(): boolean {
        return false;
    }

    private _getProjectId(project: JetBrainsProject): string {
        return `${this.jetbrainsApp.exec}-${project.path}`;
    }

    get canLaunchSearch(): boolean {
        return false;
    }

    get id(): string {
        return `${this.extension.uuid}-${this.jetbrainsApp.exec}`;
    }

    get appInfo(): Gio.AppInfo | null {
        return this.app?.get_app_info() ?? null;
    }

    /**
     * Initiate a new search.
     *
     * This method is called to start a new search and returns a list of
     * unique identifiers for matching JetBrains projects, scored by
     * {@link calculateSearchScore} and ordered by match quality.
     * The full list is returned: the shell feeds it back to
     * {@link getSubsearchResultSet} as the candidate set, and caps the display
     * through {@link filterResults}.
     *
     * If @cancellable is triggered, this method should throw an error.
     *
     * @param terms - The search terms
     * @param cancellable - A cancellable for the operation
     * @returns A list of result identifiers
     */
    async getInitialResultSet(terms: string[], cancellable: Gio.Cancellable): Promise<string[]> {
        if (cancellable.is_cancelled()) {
            throw new Error('Search cancelled');
        }

        const searchTerm = normalizeForSearch(terms.join(' '));

        // Score and filter projects
        const scoredProjects = this._projects
            .map(project => ({
                project,
                score: calculateSearchScore(project.normalizedName, project.normalizedPath, searchTerm)
            }))
            .filter(item => item.score > 0)
            .sort((a, b) => {
                // Sort by score (descending), then by name (ascending)
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                return a.project.name.localeCompare(b.project.name);
            });

        return scoredProjects.map(item => this._getProjectId(item.project));
    }

    /**
     * Refine the current search.
     *
     * This method is called to refine the current search results with
     * expanded terms and returns a subset of the original result set.
     * It filters and re-scores the previous results to only include projects
     * matching the new search terms, ordered by match quality.
     *
     * If @cancellable is triggered, this method should throw an error.
     *
     * @param previousResults - The original result set
     * @param terms - The search terms
     * @param cancellable - A cancellable for the operation
     * @returns A list of refined result identifiers
     */
    async getSubsearchResultSet(previousResults: string[], terms: string[], cancellable: Gio.Cancellable): Promise<string[]> {
        if (cancellable.is_cancelled()) {
            throw new Error('Search cancelled');
        }

        const searchTerm = normalizeForSearch(terms.join(' '));

        const scoredResults = previousResults
            .map(id => {
                const project = this._projectsById.get(id);
                if (!project) return null;

                const score = calculateSearchScore(project.normalizedName, project.normalizedPath, searchTerm);
                return score > 0 ? {id, project, score} : null;
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => {
                if (a.score !== b.score) return b.score - a.score;
                return a.project.name.localeCompare(b.project.name);
            });

        return scoredResults.map(item => item.id);
    }

    /**
     * Get result metadata.
     *
     * This method is called to get a `ResultMeta` for each identifier,
     * containing display information and icon creation functions for
     * JetBrains project results.
     *
     * If @cancellable is triggered, this method should throw an error.
     *
     * @param results - The result identifiers
     * @param cancellable - A cancellable for the operation
     * @returns A list of result metadata objects
     */
    async getResultMetas(results: string[], cancellable: Gio.Cancellable): Promise<ResultMeta[]> {
        if (cancellable.is_cancelled()) {
            throw new Error('Operation cancelled');
        }

        return results.map(id => {
            const project = this._projectsById.get(id);
            if (!project) {
                return {
                    id: id,
                    name: 'Unknown Project',
                    description: 'Project not found',
                    createIcon: (size: number) => new St.Icon({
                        icon_name: 'dialog-question-symbolic',
                        icon_size: size
                    })
                };
            }


            const createIcon = (size: number) => {
                try {
                    const projectIcon = project.createIcon(size);
                    if (projectIcon) {
                        return projectIcon;
                    }
                } catch {
                    // Silently fall back to app icon
                }

                if (this.app && this.app.get_app_info()) {
                    const appInfo = this.app.get_app_info();
                    const icon = appInfo.get_icon();
                    if (icon) {
                        return new St.Icon({
                            gicon: icon,
                            icon_size: size
                        });
                    }
                }

                return new St.Icon({
                    icon_name: 'folder-symbolic',
                    icon_size: size
                });
            };

            return {
                id: id,
                name: project.name,
                description: project.path,
                createIcon: createIcon
            };
        });
    }

    /**
     * Filter the current search.
     *
     * This method is called to truncate the number of search results.
     * Simply returns the first n-items when the result count exceeds maxResults.
     *
     * @param results - The original result set
     * @param maxResults - The maximum amount of results
     * @returns The filtered results
     */
    filterResults(results: string[], maxResults: number): string[] {
        return results.slice(0, maxResults);
    }

    /**
     * Launch the search result.
     *
     * This method is called when a search provider result is activated.
     * It finds the corresponding JetBrains project and launches it in the IDE.
     *
     * @param id - The result identifier
     * @param _terms - The search terms (unused)
     */
    activateResult(id: string, _terms: string[]): void {
        this._projectsById.get(id)?.launch(this.app?.get_app_info() ?? null);
    }

    launchSearch(_terms: string[]): void {
        this.app?.activate();
    }

    /**
     * This method is called to create an actor to represent a search result.
     * JetBrains providers use the default implementation.
     *
     * @param _meta - A result metadata object
     * @returns Always returns null to use the default implementation
     */
    createResultObject(_meta: ResultMeta): null {
        return null;
    }
}
