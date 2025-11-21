import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

export interface JetBrainsApp {
  name: string;
  exec: string;
  configDir: string;
  toolboxDir: string;
  iconFile: string;
}

export const JETBRAINS_APPS: JetBrainsApp[] = [
  {
    name: 'IntelliJ IDEA',
    exec: 'idea',
    configDir: '.IntelliJIdea',
    toolboxDir: 'intellij-idea-ultimate',
    iconFile: 'idea.svg'
  },
  {
    name: 'PyCharm',
    exec: 'pycharm',
    configDir: '.PyCharm',
    toolboxDir: 'pycharm-community',
    iconFile: 'pycharm.svg'
  },
  {
    name: 'WebStorm',
    exec: 'webstorm',
    configDir: '.WebStorm',
    toolboxDir: 'webstorm',
    iconFile: 'webstorm.svg'
  },
  {
    name: 'PhpStorm',
    exec: 'phpstorm',
    configDir: '.PhpStorm',
    toolboxDir: 'phpstorm',
    iconFile: 'phpstorm.svg'
  },
  {
    name: 'GoLand',
    exec: 'goland',
    configDir: '.GoLand',
    toolboxDir: 'goland',
    iconFile: 'goland.svg'
  },
  {
    name: 'CLion',
    exec: 'clion',
    configDir: '.CLion',
    toolboxDir: 'clion',
    iconFile: 'clion.svg'
  },
  {
    name: 'Rider',
    exec: 'rider',
    configDir: '.Rider',
    toolboxDir: 'rider',
    iconFile: 'rider.svg'
  },
  {
    name: 'RubyMine',
    exec: 'rubymine',
    configDir: '.RubyMine',
    toolboxDir: 'rubymine',
    iconFile: 'rubymine.svg'
  },
  {
    name: 'DataGrip',
    exec: 'datagrip',
    configDir: '.DataGrip',
    toolboxDir: 'datagrip',
    iconFile: 'datagrip.svg'
  },
  {
    name: 'Android Studio',
    exec: 'android-studio',
    configDir: '.AndroidStudio',
    toolboxDir: 'android-studio',
    iconFile: 'studio.svg'
  },
  {
    name: 'RustRover',
    exec: 'rustrover',
    configDir: '.RustRover',
    toolboxDir: 'rustrover',
    iconFile: 'rustrover.svg'
  }
];

export class JetBrainsProject {
  name: string;
  path: string;
  appName: string;
  appExec: string;
  toolboxDir: string;
  iconFile: string;

  constructor(name: string, path: string, appName: string, appExec: string, toolboxDir: string, iconFile: string) {
    this.name = name;
    this.path = path;
    this.appName = appName;
    this.appExec = appExec;
    this.toolboxDir = toolboxDir;
    this.iconFile = iconFile;
  }

  launch(): void {
    // Try different launch methods in order of preference
    const launchMethods = [
      this._launchViaToolbox.bind(this),
      this._launchViaDesktopFile.bind(this),
      this._launchViaSystemCommand.bind(this)
    ];

    for (const method of launchMethods) {
      if (method()) {
        return; // Successfully launched
      }
    }

    console.warn(`JetBrains Extension: Failed to launch ${this.appName} project ${this.name}`);
  }

  private _launchViaToolbox(): boolean {
    if (!this.toolboxDir) return false;

    const homeDir = GLib.get_home_dir();
    const executablePath = GLib.build_filenamev([
      homeDir, '.local', 'share', 'JetBrains', 'Toolbox', 'apps',
      this.toolboxDir, 'bin', this.appExec
    ]);

    const executableFile = Gio.File.new_for_path(executablePath);
    if (executableFile.query_exists(null)) {
      try {
        GLib.spawn_command_line_async(`"${executablePath}" "${this.path}"`);
        return true;
      } catch (e) {
        console.warn(`JetBrains Extension: Failed to launch via Toolbox executable ${executablePath}: ${e}`);
      }
    }
    return false;
  }

  private _launchViaDesktopFile(): boolean {
    const homeDir = GLib.get_home_dir();
    const desktopDir = GLib.build_filenamev([ homeDir, '.local', 'share', 'applications' ]);

    try {
      const dirFile = Gio.File.new_for_path(desktopDir);
      if (!dirFile.query_exists(null)) return false;

      const enumerator = dirFile.enumerate_children(
        'standard::name',
        Gio.FileQueryInfoFlags.NONE,
        null
      );

      let info;
      while ((info = enumerator.next_file(null))) {
        const filename = info.get_name();
        if (!filename.endsWith('.desktop')) continue;

        // Look for JetBrains desktop files that might match this app
        if (filename.includes('jetbrains') &&
          (filename.toLowerCase().includes(this.appExec.toLowerCase()) ||
            filename.toLowerCase().includes(this.appName.toLowerCase().replace(/\s+/g, '-')))) {

          const desktopFilePath = GLib.build_filenamev([ desktopDir, filename ]);
          const desktopFile = Gio.File.new_for_path(desktopFilePath);

          try {
            const [ success, contents ] = desktopFile.load_contents(null);
            if (success) {
              const text = new TextDecoder().decode(contents);
              const execMatch = text.match(/^Exec=(.+)$/m);
              if (execMatch) {
                let execCommand = execMatch[1];
                // Replace %f, %F, %u, %U with the project path
                execCommand = execCommand.replace(/%[fFuU]/g, `"${this.path}"`);

                GLib.spawn_command_line_async(execCommand);
                return true;
              }
            }
          } catch (e) {
            console.warn(`JetBrains Extension: Error processing desktop file ${filename}: ${e}`);
          }
        }
      }
    } catch (e) {
      console.warn(`JetBrains Extension: Error searching desktop files: ${e}`);
    }

    return false;
  }

  private _launchViaSystemCommand(): boolean {
    try {
      GLib.spawn_command_line_async(`${this.appExec} "${this.path}"`);
      return true;
    } catch (e) {
      console.warn(`JetBrains Extension: Failed to launch via system command ${this.appExec}: ${e}`);
      return false;
    }
  }

  getProjectIconPath(): string | null {
    const iconPath = GLib.build_filenamev([ this.path, '.idea', 'icon.png' ]);
    const iconFile = Gio.File.new_for_path(iconPath);
    if (iconFile.query_exists(null)) {
      return iconPath;
    }
    return null;
  }

  private _getIdeIconFromToolbox(): Gio.Icon | null {
    if (!this.toolboxDir || !this.iconFile) return null;

    const homeDir = GLib.get_home_dir();
    const iconPath = GLib.build_filenamev([
      homeDir, '.local', 'share', 'JetBrains', 'Toolbox', 'apps',
      this.toolboxDir, 'bin', this.iconFile
    ]);

    const iconFile = Gio.File.new_for_path(iconPath);
    if (iconFile.query_exists(null)) {
      try {
        return new Gio.FileIcon({ file: iconFile });
      } catch (e) {
        console.warn(`JetBrains Extension: Could not load Toolbox icon ${iconPath}: ${e}`);
      }
    }

    return null;
  }

  createIcon(size: number, _scaleFactor: number): St.Icon {
    // Try project icon first
    const projectIconPath = this.getProjectIconPath();
    if (projectIconPath) {
      try {
        const file = Gio.File.new_for_path(projectIconPath);
        const gicon = new Gio.FileIcon({ file: file });
        return new St.Icon({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          gicon: gicon as any,
          icon_size: size
        });
      } catch (e) {
        // Silently fall back to IDE icon
      }
    }

    // Try IDE icon from Toolbox
    const ideIcon = this._getIdeIconFromToolbox();
    if (ideIcon) {
      return new St.Icon({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        gicon: ideIcon as any,
        icon_size: size
      });
    }

    // Fallback to generic folder icon
    return new St.Icon({
      icon_name: 'folder-symbolic',
      icon_size: size
    });
  }
}
