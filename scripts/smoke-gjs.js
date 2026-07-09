// Smoke-test entry point, copied next to the built extension modules and run
// under real gjs (see smoke-gjs.sh). Exercises the discovery + project-loading
// pipeline against this machine's real ~/.config/JetBrains and
// ~/.local/share/applications, without a running GNOME Shell.
import GLib from 'gi://GLib';
import system from 'system';

const loop = new GLib.MainLoop(null, false);
let status = 0;

(async () => {
    try {
        const {JETBRAINS_APPS} = await import('./jetBrainsApp.js');
        const {findJetBrainsApp} = await import('./appDiscovery.js');
        const {loadProjects} = await import('./projectLoader.js');
        const {ScanCache} = await import('./scanCache.js');

        const scanCache = new ScanCache();
        for (const app of JETBRAINS_APPS) {
            const found = await findJetBrainsApp(app, scanCache, null);
            const projects = await loadProjects(app, scanCache, {
                additionalPatterns: [],
                shouldInclude: () => true,
            }, null);
            print(`${app.name}: app=${found ? 'yes' : 'no'} projects=${projects.length}`);
        }
        print('SMOKE OK');
    } catch (e) {
        print(`SMOKE FAIL: ${e}\n${e.stack ?? ''}`);
        status = 1;
    } finally {
        loop.quit();
    }
})();

loop.run();
system.exit(status);
