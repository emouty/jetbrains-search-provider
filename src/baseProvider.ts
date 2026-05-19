import St from "gi://St";
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import Shell from "gi://Shell";
import {Extension} from "resource:///org/gnome/shell/extensions/extension.js";
import {AppSearchProvider, ResultMeta} from "resource:///org/gnome/shell/ui/appDisplay.js";
import {JetBrainsProject} from "./project.js";
import {JetBrainsApp} from "./jetBrainsApp.js";

/**
 * Base JetBrains Search Provider for GNOME Shell
 *
 * Provides core search functionality for JetBrains IDE projects through GNOME Shell's
 * search interface. This base class handles project discovery, search, and result creation
 * for any JetBrains IDE.
 */
export default class BaseJetBrainsProvider implements AppSearchProvider {
    public projects: JetBrainsProject[] = [];
    protected extension: Extension;
    protected app: Shell.App | undefined;
    protected jetbrainsApp: JetBrainsApp;

    // Set by GNOME Shell's search framework when the provider is registered
    display!: Clutter.Actor;

    constructor(extension: Extension, jetbrainsApp: JetBrainsApp) {
        this.extension = extension;
        this.jetbrainsApp = jetbrainsApp;
    }

    /**
     * Initialize the provider by loading the app and projects asynchronously.
     *
     * This method should be called immediately after construction to complete
     * the provider initialization. It performs asynchronous operations that
     * cannot be done in the constructor.
     *
     * @async
     * @param {Gio.Cancellable | null} cancellable - Optional cancellable for the operation
     */
    async initialize(cancellable: Gio.Cancellable | null = null): Promise<void> {
        if (cancellable?.is_cancelled()) {
            throw new Error('Initialization cancelled');
        }

        await this._setApp(cancellable);

        if (cancellable?.is_cancelled()) {
            throw new Error('Initialization cancelled');
        }

        await this._loadProjects(cancellable);
    }

    private async _setApp(cancellable: Gio.Cancellable | null = null): Promise<void> {
        if (cancellable?.is_cancelled()) {
            throw new Error('Operation cancelled');
        }

        this.app = await this._findJetBrainsAppByPattern(cancellable);

        if (!this.app) {
            const standardAppIds = [
                this.jetbrainsApp.exec,
                `jetbrains-${this.jetbrainsApp.exec}`,
                `${this.jetbrainsApp.exec}-ultimate`,
                `${this.jetbrainsApp.exec}-community`,
                `${this.jetbrainsApp.exec}-ce`,
                this.jetbrainsApp.name.toLowerCase().replace(/\s+/g, '-'),
                `jetbrains-${this.jetbrainsApp.name.toLowerCase().replace(/\s+/g, '-')}`
            ];

            this.app = standardAppIds
                .map((id) => Shell.AppSystem.get_default().lookup_app(id + ".desktop"))
                .find((app) => Boolean(app));
        }
    }

    private async _findJetBrainsAppByPattern(cancellable: Gio.Cancellable | null = null): Promise<Shell.App | undefined> {
        const homeDir = GLib.get_home_dir();
        const desktopDir = GLib.build_filenamev([homeDir, '.local', 'share', 'applications']);

        try {
            const dirFile = Gio.File.new_for_path(desktopDir);
            if (!dirFile.query_exists(cancellable)) return undefined;

            const enumerator = dirFile.enumerate_children(
                'standard::name',
                Gio.FileQueryInfoFlags.NONE,
                cancellable
            );

            try {
                let info;
                while ((info = enumerator.next_file(cancellable))) {
                    const filename = info.get_name();
                    if (!filename.endsWith('.desktop')) continue;

                    const lowerFilename = filename.toLowerCase();
                    if (lowerFilename.startsWith('jetbrains-')) {
                        const filenameMatch = this._matchesFilenamePattern(lowerFilename);

                        if (filenameMatch) {
                            const app = Shell.AppSystem.get_default().lookup_app(filename);
                            if (app) {
                                return app;
                            }
                        } else {
                            const contentMatch = this._matchesDesktopFileContent(desktopDir, filename, cancellable);
                            if (contentMatch) {
                                const app = Shell.AppSystem.get_default().lookup_app(filename);
                                if (app) {
                                    return app;
                                }
                            }
                        }
                    }
                }
            } finally {
                try {
                    enumerator.close(cancellable);
                } catch (e) {
                    console.warn(`JetBrains Search Provider: Error closing enumerator: ${e}`);
                }
            }
        } catch (e) {
            console.warn(`JetBrains Search Provider: Error searching for ${this.jetbrainsApp.name} desktop files: ${e}`);
        }

        return undefined;
    }

    private _matchesFilenamePattern(lowerFilename: string): boolean {
        // Check filename patterns for each IDE
        switch (this.jetbrainsApp.exec) {
            case 'idea':
                return lowerFilename.includes('-idea-') || lowerFilename === 'jetbrains-idea.desktop';
            case 'pycharm':
                return lowerFilename.includes('-pycharm-') || lowerFilename === 'jetbrains-pycharm-ce.desktop';
            case 'rustrover':
                return lowerFilename.includes('-rustrover-') || lowerFilename === 'jetbrains-rustrover.desktop';
            case 'android-studio':
                return lowerFilename.includes('-studio') || lowerFilename === 'jetbrains-studio.desktop';
            case 'webstorm':
                return lowerFilename.includes('-webstorm-') || lowerFilename === 'jetbrains-webstorm.desktop';
            case 'phpstorm':
                return lowerFilename.includes('-phpstorm-') || lowerFilename === 'jetbrains-phpstorm.desktop';
            case 'goland':
                return lowerFilename.includes('-goland-') || lowerFilename === 'jetbrains-goland.desktop';
            case 'clion':
                return lowerFilename.includes('-clion-') || lowerFilename === 'jetbrains-clion.desktop';
            case 'rider':
                return lowerFilename.includes('-rider-') || lowerFilename === 'jetbrains-rider.desktop';
            case 'rubymine':
                return lowerFilename.includes('-rubymine-') || lowerFilename === 'jetbrains-rubymine.desktop';
            case 'datagrip':
                return lowerFilename.includes('-datagrip-') || lowerFilename === 'jetbrains-datagrip.desktop';
            default:
                return false;
        }
    }

    private _matchesDesktopFileContent(desktopDir: string, filename: string, cancellable: Gio.Cancellable | null = null): boolean {
        try {
            const desktopFilePath = GLib.build_filenamev([desktopDir, filename]);
            const desktopFile = Gio.File.new_for_path(desktopFilePath);

            const [success, contents] = desktopFile.load_contents(cancellable);
            if (!success) return false;

            const text = new TextDecoder().decode(contents).toLowerCase();

            const searchPatterns = [
                this.jetbrainsApp.exec.toLowerCase(),
                this.jetbrainsApp.name.toLowerCase(),
                this.jetbrainsApp.name.toLowerCase().replace(/\s+/g, ''),
                this.jetbrainsApp.name.toLowerCase().replace(/\s+/g, '-')
            ];

            if (this.jetbrainsApp.exec === 'idea') {
                searchPatterns.push('intellij', 'intellij idea', 'intellij-idea');
            } else if (this.jetbrainsApp.exec === 'android-studio') {
                searchPatterns.push('android studio', 'studio');
            }

            return searchPatterns.some(pattern => {
                const regex = new RegExp(`\\b${this._escapeRegex(pattern)}\\b`, 'i');
                return regex.test(text);
            });
        } catch (e) {
            return false;
        }
    }

    protected getAdditionalConfigPatterns(): RegExp[] {
        return [];
    }

    protected shouldIncludeProject(_projectPath: string): boolean {
        return true;
    }

    private _escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    private async _loadProjects(cancellable: Gio.Cancellable | null = null): Promise<void> {
        const homeDir = GLib.get_home_dir();
        const jetbrainsConfigDir = GLib.build_filenamev([homeDir, '.config', 'JetBrains']);

        this.projects = [];

        const jetbrainsDir = Gio.File.new_for_path(jetbrainsConfigDir);
        if (!jetbrainsDir.query_exists(cancellable)) {
            return;
        }

        try {
            const enumerator = jetbrainsDir.enumerate_children(
                'standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE,
                cancellable
            );

            try {
                let info;
                while ((info = enumerator.next_file(cancellable))) {
                    if (cancellable?.is_cancelled()) {
                        throw new Error('Operation cancelled');
                    }

                    const name = info.get_name();
                    const fileType = info.get_file_type();
                    if (fileType !== Gio.FileType.DIRECTORY) continue;

                    const escapedConfigDir = this._escapeRegex(this.jetbrainsApp.configDir.substring(1));
                    const escapedName = this._escapeRegex(this.jetbrainsApp.name.replace(/\s+/g, ''));
                    const escapedExec = this._escapeRegex(this.jetbrainsApp.exec);

                    const patterns = [
                        new RegExp(`^${escapedConfigDir}\\d{4}\\.\\d+`, 'i'),
                        new RegExp(`^${escapedName}\\d{4}\\.\\d+`, 'i'),
                        new RegExp(`^${escapedName}CE\\d{4}\\.\\d+`, 'i'),
                        new RegExp(`^${escapedExec}IC\\d{4}\\.\\d+`, 'i'),
                        new RegExp(`^_${escapedConfigDir}\\d{4}\\.\\d+`, 'i')
                    ];

                    patterns.push(...this.getAdditionalConfigPatterns());

                    if (patterns.some(pattern => pattern.test(name))) {
                        const recentProjectsPath = GLib.build_filenamev([
                            jetbrainsConfigDir, name, 'options', 'recentProjects.xml'
                        ]);

                        await this._parseRecentProjects(recentProjectsPath, cancellable);
                    }
                }
            } finally {
                try {
                    enumerator.close(cancellable);
                } catch (e) {
                    console.warn(`JetBrains Search Provider: Error closing enumerator: ${e}`);
                }
            }
        } catch (e) {
            if (cancellable?.is_cancelled()) {
                throw e;
            }
            console.warn(`JetBrains Search Provider: Error reading ${jetbrainsConfigDir} for ${this.jetbrainsApp.name}: ${e}`);
        }
    }

    private async _parseRecentProjects(xmlPath: string, cancellable: Gio.Cancellable | null = null): Promise<void> {
        const file = Gio.File.new_for_path(xmlPath);
        if (!file.query_exists(cancellable)) {
            return;
        }

        try {
            const [success, contents] = file.load_contents(cancellable);
            if (!success) {
                return;
            }

            const text = new TextDecoder().decode(contents);
            const entryRegex = /<entry\s+key="([^"]+)"/g;
            let match;

            while ((match = entryRegex.exec(text)) !== null) {
                if (cancellable?.is_cancelled()) {
                    throw new Error('Operation cancelled');
                }

                let projectPath = match[1];

                if (!projectPath.startsWith('$USER_HOME$/')) continue;

                projectPath = projectPath.replace('$USER_HOME$', GLib.get_home_dir());

                const projectFile = Gio.File.new_for_path(projectPath);
                if (projectFile.query_exists(cancellable)) {
                    if (!this.shouldIncludeProject(projectPath)) {
                        continue;
                    }

                    const projectName = GLib.path_get_basename(projectPath);

                    if (!this.projects.some(p => p.path === projectPath)) {
                        this.projects.push(new JetBrainsProject(
                            projectName,
                            projectPath,
                            this.jetbrainsApp.name,
                            this.jetbrainsApp.exec,
                            this.jetbrainsApp.toolboxDir,
                            this.jetbrainsApp.iconFile
                        ));
                    }
                }
            }

        } catch (e) {
            if (cancellable?.is_cancelled()) {
                throw e;
            }
            console.warn(`JetBrains Search Provider: Error parsing ${xmlPath}: ${e}`);
        }
    }

    private _getProjectId(project: JetBrainsProject): string {
        return `${this.jetbrainsApp.exec}-${project.path.replace(/\//g, '_')}`;
    }

    get canLaunchSearch(): boolean {
        return false;
    }

    // noinspection JSUnusedGlobalSymbols
    get id(): string {
        return `${this.extension.uuid}-${this.jetbrainsApp.exec}`;
    }

    // noinspection JSUnusedGlobalSymbols
    get appInfo(): Gio.AppInfo {
        if (this.app && this.app.get_app_info()) {
            return this.app.get_app_info();
        }

        const uniqueId = `jetbrains-${this.jetbrainsApp.exec}-${this.jetbrainsApp.name.toLowerCase().replace(/\s+/g, '-')}`;
        return {
            get_name: () => this.jetbrainsApp.name,
            get_display_name: () => this.jetbrainsApp.name,
            get_description: () => `${this.jetbrainsApp.name} Projects`,
            get_icon: () => this._createFallbackIcon(),
            get_executable: () => this.jetbrainsApp.exec,
            get_commandline: () => this.jetbrainsApp.exec,
            get_id: () => uniqueId,
            equal: (other: Gio.AppInfo) => other && other.get_id && other.get_id() === uniqueId,
            should_show: () => true,
            get_categories: () => null,
            get_keywords: () => [],
            launch: () => false,
            launch_uris: () => false,
            launch_uris_async: () => {},
            supports_files: () => false,
            supports_uris: () => false,
            can_delete: () => false,
            delete: () => false,
            dup: () => null,
        } as unknown as Gio.AppInfo;
    }

    private _createFallbackIcon(cancellable: Gio.Cancellable | null = null): Gio.Icon | null {
        const homeDir = GLib.get_home_dir();
        const iconPath = GLib.build_filenamev([
            homeDir, '.local', 'share', 'JetBrains', 'Toolbox', 'apps',
            this.jetbrainsApp.toolboxDir, 'bin', this.jetbrainsApp.iconFile
        ]);

        const iconFile = Gio.File.new_for_path(iconPath);
        if (iconFile.query_exists(cancellable)) {
            try {
                return new Gio.FileIcon({file: iconFile});
            } catch (e) {
                console.warn(`JetBrains Search Provider: Could not create fallback icon: ${e}`);
            }
        }
        return null;
    }

    /**
     * Calculate a search score for a project name.
     *
     * Scores are calculated based on match quality:
     * - 1000: Exact match (project name equals search term)
     * - 900: Search term is a complete word in the project name
     * - 800: Search term starts a word in the project name
     * - 500: Search term appears at the start of the project name
     * - 100: Search term appears anywhere in the project name
     * - 0: No match
     *
     * Higher scores indicate better matches.
     *
     * @param {string} projectName - The project name to score
     * @param {string} searchTerm - The search term to match
     * @returns {number} The match score
     */
    private _calculateSearchScore(projectName: string, projectPath: string, terms: string[]): number {
        // Normalize: collapse any separator (-, _, space, .) into a space.
        // This lets "server archiver" (two GNOME terms) match "server-archiver".
        const normalize = (s: string) => s.toLowerCase().replace(/[-_\s.]+/g, ' ').trim();

        const normalizedName = normalize(projectName);
        const searchTerm = normalize(terms.join(' '));

        if (normalizedName.includes(searchTerm)) {
            if (normalizedName === searchTerm) return 1000;
            const nameParts = normalizedName.split(' ');
            if (nameParts.includes(searchTerm)) return 900;
            if (nameParts.some(p => p.startsWith(searchTerm))) return 800;
            if (normalizedName.startsWith(searchTerm)) return 500;
            return 100;
        }

        // Path match: lower score so name matches always rank higher.
        // Normalize path separators too so "work/backend" → "work backend".
        const normalizedPath = projectPath.toLowerCase().replace(/[-_\s./]+/g, ' ').trim();
        if (normalizedPath.includes(searchTerm)) return 50;

        return 0;
    }

    /**
     * Initiate a new search.
     *
     * This method is called to start a new search and returns a list of
     * unique identifiers for matching JetBrains projects. Results are filtered
     * by project name containing the search terms and ordered by match quality.
     * Results are limited to 10 projects.
     *
     * Search scoring prioritizes:
     * 1. Exact matches
     * 2. Complete word matches (e.g., "archive" matches "backend-archive")
     * 3. Word-start matches (e.g., "arch" matches "backend-archiver")
     * 4. Name-start matches
     * 5. Substring matches anywhere in the name
     *
     * If @cancellable is triggered, this method should throw an error.
     *
     * @async
     * @param {string[]} terms - The search terms
     * @param {Gio.Cancellable} cancellable - A cancellable for the operation
     * @returns {Promise<string[]>} A list of result identifiers
     */
    async getInitialResultSet(terms: string[], cancellable: Gio.Cancellable): Promise<string[]> {
        if (cancellable.is_cancelled()) {
            throw new Error('Search cancelled');
        }

        // Score and filter projects
        const scoredProjects = this.projects
            .map(project => ({
                project,
                score: this._calculateSearchScore(project.name, project.path, terms)
            }))
            .filter(item => item.score > 0)
            .sort((a, b) => {
                // Sort by score (descending), then by name (ascending)
                if (a.score !== b.score) {
                    return b.score - a.score;
                }
                return a.project.name.localeCompare(b.project.name);
            });

        return scoredProjects
            .map(item => this._getProjectId(item.project))
            .slice(0, 10);
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
     * @async
     * @param {string[]} previousResults - The original result set
     * @param {string[]} terms - The search terms
     * @param {Gio.Cancellable} cancellable - A cancellable for the operation
     * @returns {Promise<string[]>} A list of refined result identifiers
     */
    async getSubsearchResultSet(previousResults: string[], terms: string[], cancellable: Gio.Cancellable): Promise<string[]> {
        if (cancellable.is_cancelled()) {
            throw new Error('Search cancelled');
        }

        const scoredResults = previousResults
            .map(id => {
                const project = this.projects.find(p => this._getProjectId(p) === id);
                if (!project) return null;

                const score = this._calculateSearchScore(project.name, project.path, terms);
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
     * @async
     * @param {string[]} results - The result identifiers
     * @param {Gio.Cancellable} cancellable - A cancellable for the operation
     * @returns {Promise<ResultMeta[]>} A list of result metadata objects
     */
    async getResultMetas(results: string[], cancellable: Gio.Cancellable): Promise<ResultMeta[]> {
        if (cancellable.is_cancelled()) {
            throw new Error('Operation cancelled');
        }

        const {scaleFactor} = St.ThemeContext.get_for_stage(Shell.Global.get().stage);

        return results.map(id => {
            const project = this.projects.find(p => this._getProjectId(p) === id);
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
                    const projectIcon = project.createIcon(size, scaleFactor, cancellable);
                    if (projectIcon) {
                        return projectIcon;
                    }
                } catch (e) {
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
                    icon_name: 'application-x-executable-symbolic',
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
     * @param {string[]} results - The original result set
     * @param {number} maxResults - The maximum amount of results
     * @returns {string[]} The filtered results
     */
    filterResults(results: string[], maxResults: number): string[] {
        if (results.length <= maxResults) {
            return results;
        }
        return results.slice(0, maxResults);
    }

    /**
     * Launch the search result.
     *
     * This method is called when a search provider result is activated.
     * It finds the corresponding JetBrains project and launches it in the IDE.
     *
     * @param {string} id - The result identifier
     * @param {string[]} _terms - The search terms (unused)
     */
    activateResult(id: string, _terms: string[]): void {
        const project = this.projects.find(p => this._getProjectId(p) === id);
        if (project) {
            project.launch();
        }
    }

    // noinspection JSUnusedGlobalSymbols
    launchSearch(_terms: string[]): void {
    }

    /**
     *
     * This method is called to create an actor to represent a search result.
     * JetBrains providers use the default implementation.
     *
     * @param {ResultMeta} _meta - A result metadata object
     * @returns {null} Always returns null to use the default implementation
     */
    createResultObject(_meta: ResultMeta): null {
        return null;
    }
}
