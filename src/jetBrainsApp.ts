export interface JetBrainsApp {
    name: string;
    exec: string;
    configDir: string;
    /** Toolbox app directory candidates, most specific first; the first existing one wins. */
    toolboxDirs: string[];
    iconFile: string;
    /** Launcher binary/desktop-file name when it differs from `exec`. */
    launcher?: string;
}

export const JETBRAINS_APPS: JetBrainsApp[] = [
    {
        name: 'IntelliJ IDEA',
        exec: 'idea',
        configDir: '.IntelliJIdea',
        toolboxDirs: ['intellij-idea-ultimate', 'intellij-idea-community'],
        iconFile: 'idea.svg'
    },
    {
        name: 'PyCharm',
        exec: 'pycharm',
        configDir: '.PyCharm',
        toolboxDirs: ['pycharm-professional', 'pycharm-community', 'pycharm'],
        iconFile: 'pycharm.svg'
    },
    {
        name: 'WebStorm',
        exec: 'webstorm',
        configDir: '.WebStorm',
        toolboxDirs: ['webstorm'],
        iconFile: 'webstorm.svg'
    },
    {
        name: 'PhpStorm',
        exec: 'phpstorm',
        configDir: '.PhpStorm',
        toolboxDirs: ['phpstorm'],
        iconFile: 'phpstorm.svg'
    },
    {
        name: 'GoLand',
        exec: 'goland',
        configDir: '.GoLand',
        toolboxDirs: ['goland'],
        iconFile: 'goland.svg'
    },
    {
        name: 'CLion',
        exec: 'clion',
        configDir: '.CLion',
        toolboxDirs: ['clion'],
        iconFile: 'clion.svg'
    },
    {
        name: 'Rider',
        exec: 'rider',
        configDir: '.Rider',
        toolboxDirs: ['rider'],
        iconFile: 'rider.svg'
    },
    {
        name: 'RubyMine',
        exec: 'rubymine',
        configDir: '.RubyMine',
        toolboxDirs: ['rubymine'],
        iconFile: 'rubymine.svg'
    },
    {
        name: 'DataGrip',
        exec: 'datagrip',
        configDir: '.DataGrip',
        toolboxDirs: ['datagrip'],
        iconFile: 'datagrip.svg'
    },
    {
        name: 'Android Studio',
        exec: 'android-studio',
        configDir: '.AndroidStudio',
        toolboxDirs: ['android-studio'],
        iconFile: 'studio.svg',
        // Toolbox ships bin/studio and jetbrains-studio.desktop, not android-studio.
        launcher: 'studio'
    },
    {
        name: 'RustRover',
        exec: 'rustrover',
        configDir: '.RustRover',
        toolboxDirs: ['rustrover'],
        iconFile: 'rustrover.svg'
    }
];
