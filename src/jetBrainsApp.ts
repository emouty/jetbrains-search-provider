export interface JetBrainsApp {
    name: string;
    exec: string;
    configDir: string;
    toolboxDir: string;
    iconFile: string;
    /** Launcher binary/desktop-file name when it differs from `exec`. */
    launcher?: string;
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
        iconFile: 'studio.svg',
        // Toolbox ships bin/studio and jetbrains-studio.desktop, not android-studio.
        launcher: 'studio'
    },
    {
        name: 'RustRover',
        exec: 'rustrover',
        configDir: '.RustRover',
        toolboxDir: 'rustrover',
        iconFile: 'rustrover.svg'
    }
];