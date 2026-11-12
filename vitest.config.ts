import { configDefaults, defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mock = (file: string) => path.resolve(__dirname, 'tests/mocks', file);

export default defineConfig({
    resolve: {
        alias: [
            { find: 'gi://St',      replacement: mock('gi-St.ts') },
            { find: 'gi://Clutter', replacement: mock('gi-Clutter.ts') },
            { find: 'gi://GLib',    replacement: mock('gi-GLib.ts') },
            { find: 'gi://Gio',     replacement: mock('gi-Gio.ts') },
            { find: 'gi://Shell',   replacement: mock('gi-Shell.ts') },
            {
                find: 'resource:///org/gnome/shell/extensions/extension.js',
                replacement: mock('gnome-extension.ts'),
            },
            {
                find: 'resource:///org/gnome/shell/ui/appDisplay.js',
                replacement: mock('gnome-appDisplay.ts'),
            },
            // GJS runtime requires .js extensions in TypeScript imports; map them to .ts for tests
            { find: /^(\..+)\.js$/, replacement: '$1.ts' },
        ],
    },
    test: {
        include: ['tests/**/*.spec.ts'],
        // JUnit XML for the CI "Tests" check (.github/workflows/ci.yml).
        reporters: ['junit', ...configDefaults.reporters],
        outputFile: { junit: 'reports/junit.xml' },
    },
});
