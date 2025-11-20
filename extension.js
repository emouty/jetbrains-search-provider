import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const JETBRAINS_APPS = [
  {name: 'IntelliJ IDEA', exec: 'idea', configDir: '.IntelliJIdea', icon: 'intellij-idea-ultimate'},
  {name: 'PyCharm', exec: 'pycharm', configDir: '.PyCharm', icon: 'pycharm'},
  {name: 'WebStorm', exec: 'webstorm', configDir: '.WebStorm', icon: 'webstorm'},
  {name: 'PhpStorm', exec: 'phpstorm', configDir: '.PhpStorm', icon: 'phpstorm'},
  {name: 'GoLand', exec: 'goland', configDir: '.GoLand', icon: 'goland'},
  {name: 'CLion', exec: 'clion', configDir: '.CLion', icon: 'clion'},
  {name: 'Rider', exec: 'rider', configDir: '.Rider', icon: 'rider'},
  {name: 'RubyMine', exec: 'rubymine', configDir: '.RubyMine', icon: 'rubymine'},
  {name: 'DataGrip', exec: 'datagrip', configDir: '.DataGrip', icon: 'datagrip'},
  {name: 'Android Studio', exec: 'android-studio', configDir: '.AndroidStudio', icon: 'android-studio'},
  {name: 'RustRover', exec: 'rustrover', configDir: '.RustRover', icon: 'rustrover'}
];

class JetBrainsProject {
  constructor(name, path, appName, appExec, appIcon) {
    this.name = name;
    this.path = path;
    this.appName = appName;
    this.appExec = appExec;
    this.appIcon = appIcon;
    this._iconCache = null;
  }

  launch() {
    try {
      GLib.spawn_command_line_async(`${this.appExec} "${this.path}"`);
    } catch (e) {
      log(`Failed to launch ${this.appName}: ${e}`);
    }
  }

  getProjectIconPath() {
    const iconPath = GLib.build_filenamev([this.path, '.idea', 'icon.png']);
    const iconFile = Gio.File.new_for_path(iconPath);
    if (iconFile.query_exists(null)) {
      return iconPath;
    }
    return null;
  }

  createIcon(size, scaleFactor) {
    // Try project icon first
    const projectIconPath = this.getProjectIconPath();
    if (projectIconPath) {
      try {
        const file = Gio.File.new_for_path(projectIconPath);
        const gicon = new Gio.FileIcon({file: file});
        const icon = new St.Icon({
          gicon: gicon,
          icon_size: size
        });
        log(`JetBrains Extension: Using project icon for ${this.name}`);
        return icon;
      } catch (e) {
        log(`JetBrains Extension: Failed to load project icon ${projectIconPath}: ${e}`);
      }
    }

    // Try IDE icon with multiple fallback names
    if (this.appIcon) {
      const iconNames = [
        this.appIcon,
        this.appIcon.toLowerCase(),
        `jetbrains-${this.appExec}`,
        this.appExec,
        'application-x-executable'
      ];

      const gicon = new Gio.ThemedIcon({names: iconNames});
      const icon = new St.Icon({
        gicon: gicon,
        icon_size: size,
        fallback_icon_name: 'folder-symbolic'
      });
      log(`JetBrains Extension: Using IDE icon for ${this.name} with fallbacks: ${iconNames.join(', ')}`);
      return icon;
    }

    // Fallback to generic folder icon
    log(`JetBrains Extension: Using fallback icon for ${this.name}`);
    return new St.Icon({
      icon_name: 'folder-symbolic',
      icon_size: size
    });
  }
}

class JetBrainsSearchProvider {
  constructor(extension) {
    this._extension = extension;
    this.projects = [];
    this._loadProjects();
  }

  get appInfo() {
    return null;
  }

  get canLaunchSearch() {
    return false;
  }

  get id() {
    return this._extension.uuid;
  }

  _loadProjects() {
    const homeDir = GLib.get_home_dir();
    const jetbrainsConfigDir = GLib.build_filenamev([homeDir, '.config', 'JetBrains']);

    this.projects = [];
    log(`JetBrains Extension: Starting to load projects from ${jetbrainsConfigDir}`);

    const jetbrainsDir = Gio.File.new_for_path(jetbrainsConfigDir);
    if (!jetbrainsDir.query_exists(null)) {
      log(`JetBrains Extension: Config directory does not exist: ${jetbrainsConfigDir}`);
      return;
    }

    try {
      const enumerator = jetbrainsDir.enumerate_children(
        'standard::name,standard::type',
        Gio.FileQueryInfoFlags.NONE,
        null
      );

      let info;
      while ((info = enumerator.next_file(null))) {
        const name = info.get_name();
        const fileType = info.get_file_type();
        if (fileType !== Gio.FileType.DIRECTORY) continue;

        let app = null;
        for (const jetbrainsApp of JETBRAINS_APPS) {
          const patterns = [
            new RegExp(`^${jetbrainsApp.configDir.substring(1)}\\d{4}\\.\\d+`, 'i'),
            new RegExp(`^${jetbrainsApp.name.replace(/\s+/g, '')}\\d{4}\\.\\d+`, 'i'),
            new RegExp(`^${jetbrainsApp.name.replace(/\s+/g, '')}CE\\d{4}\\.\\d+`, 'i'),
            new RegExp(`^${jetbrainsApp.exec}IC\\d{4}\\.\\d+`, 'i'),
            new RegExp(`^_${jetbrainsApp.configDir.substring(1)}\\d{4}\\.\\d+`, 'i')
          ];

          if (patterns.some(pattern => pattern.test(name))) {
            app = jetbrainsApp;
            break;
          }
        }

        if (app) {
          const recentProjectsPath = GLib.build_filenamev([
            jetbrainsConfigDir, name, 'options', 'recentProjects.xml'
          ]);

          log(`JetBrains Extension: Checking for ${recentProjectsPath}`);
          this._parseRecentProjects(recentProjectsPath, app);
        }
      }
    } catch (e) {
      log(`JetBrains Extension: Error reading ${jetbrainsConfigDir}: ${e}`);
    }

    log(`JetBrains Extension: Loaded ${this.projects.length} projects total`);
  }

  _parseRecentProjects(xmlPath, app) {
    const file = Gio.File.new_for_path(xmlPath);
    if (!file.query_exists(null)) {
      log(`JetBrains Extension: recentProjects.xml not found: ${xmlPath}`);
      return;
    }

    try {
      const [success, contents] = file.load_contents(null);
      if (!success) {
        log(`JetBrains Extension: Failed to load contents of ${xmlPath}`);
        return;
      }

      const text = new TextDecoder().decode(contents);
      const entryRegex = /<entry\s+key="([^"]+)"/g;
      let match;
      let projectCount = 0;

      while ((match = entryRegex.exec(text)) !== null) {
        let projectPath = match[1];

        if (!projectPath.startsWith('$USER_HOME$/')) continue;

        projectPath = projectPath.replace('$USER_HOME$', GLib.get_home_dir());

        const projectFile = Gio.File.new_for_path(projectPath);
        if (projectFile.query_exists(null)) {
          const projectName = GLib.path_get_basename(projectPath);

          if (!this.projects.some(p => p.path === projectPath)) {
            this.projects.push(new JetBrainsProject(
              projectName,
              projectPath,
              app.name,
              app.exec,
              app.icon
            ));
            projectCount++;
            log(`JetBrains Extension: Added project ${projectName} (${projectPath}) for ${app.name}`);
          }
        } else {
          log(`JetBrains Extension: Project path does not exist: ${projectPath}`);
        }
      }

      log(`JetBrains Extension: Parsed ${projectCount} projects from ${xmlPath} for ${app.name}`);
    } catch (e) {
      log(`JetBrains Extension: Error parsing ${xmlPath}: ${e}`);
    }
  }

  _getProjectId(project) {
    return `jetbrains-${project.appExec}-${project.path.replace(/\//g, '_')}`;
  }

  getInitialResultSet(terms, cancellable) {
    log(`JetBrains Extension: getInitialResultSet called with terms: [${terms.join(', ')}]`);

    return new Promise((resolve, reject) => {
      const cancelledId = cancellable.connect(
        () => reject(Error('Search Cancelled'))
      );

      const query = terms.join(' ').toLowerCase();
      log(`JetBrains Extension: Searching for "${query}" in ${this.projects.length} projects`);

      const results = this.projects
        .filter(project => {
          const name = project.name.toLowerCase();
          const path = project.path.toLowerCase();
          const matches = name.includes(query) || path.includes(query);
          if (matches) {
            log(`JetBrains Extension: Match found: ${project.name}`);
          }
          return matches;
        })
        .map(project => this._getProjectId(project))
        .slice(0, 10);

      log(`JetBrains Extension: Returning ${results.length} results`);

      cancellable.disconnect(cancelledId);
      if (!cancellable.is_cancelled()) {
        resolve(results);
      }
    });
  }

  getSubsearchResultSet(previousResults, terms, cancellable) {
    log(`JetBrains Extension: getSubsearchResultSet called`);
    return this.getInitialResultSet(terms, cancellable);
  }

  getResultMetas(results, cancellable) {
    log(`JetBrains Extension: getResultMetas called with ${results.length} results`);

    return new Promise((resolve, reject) => {
      const cancelledId = cancellable.connect(
        () => reject(Error('Operation Cancelled'))
      );

      const {scaleFactor} = St.ThemeContext.get_for_stage(global.stage);

      const metas = results.map(id => {
        const project = this.projects.find(p => this._getProjectId(p) === id);
        if (!project) {
          log(`JetBrains Extension: Project not found for id: ${id}`);
          return {
            id: id,
            name: 'Unknown Project',
            description: 'Project not found',
            createIcon: size => new St.Icon({
              icon_name: 'dialog-question-symbolic',
              icon_size: size
            })
          };
        }
        log(`JetBrains Extension: Creating meta for project: ${project.name}`);
        return {
          id: id,
          name: project.name,
          description: `${project.appName} • ${project.path}`,
          createIcon: size => project.createIcon(size, scaleFactor)
        };
      });

      cancellable.disconnect(cancelledId);
      if (!cancellable.is_cancelled()) {
        resolve(metas);
      }
    });
  }

  filterResults(results, maxResults) {
    log(`JetBrains Extension: filterResults called with ${results.length} results, max: ${maxResults}`);
    if (results.length <= maxResults) {
      return results;
    }
    return results.slice(0, maxResults);
  }

  activateResult(id, terms) {
    log(`JetBrains Extension: activateResult called for id: ${id}`);
    const project = this.projects.find(p => this._getProjectId(p) === id);
    if (project) {
      log(`JetBrains Extension: Launching project ${project.name}`);
      project.launch();
    } else {
      log(`JetBrains Extension: Project not found for id ${id}`);
    }
  }

  launchSearch(terms) {
    log(`JetBrains Extension: launchSearch called with terms: [${terms.join(', ')}]`);
  }

  createResultObject(meta) {
    log(`JetBrains Extension: createResultObject called for ${meta.id}`);
    return null;
  }
}

export default class JetBrainsExtension {
  enable() {
    log('JetBrains Extension: Enabling extension');
    this._provider = new JetBrainsSearchProvider(this);
    Main.overview.searchController.addProvider(this._provider);
    log(`JetBrains Extension: Added search provider with ${this._provider.projects.length} projects`);
  }

  disable() {
    log('JetBrains Extension: Disabling extension');
    if (this._provider) {
      Main.overview.searchController.removeProvider(this._provider);
      this._provider = null;
    }
  }
}
