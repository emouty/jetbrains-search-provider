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
        const discovery = await import('./appDiscovery.js').catch(() => null);
        const loader = await import('./projectLoader.js').catch(() => null);

        if (!discovery || !loader) {
            print('SKIP: appDiscovery/projectLoader not extracted yet, nothing to smoke-test');
            return;
        }

        for (const app of JETBRAINS_APPS) {
            const found = await discovery.findJetBrainsApp(app, null);
            const projects = await loader.loadProjects(app, {
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
