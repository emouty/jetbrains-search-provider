// noinspection JSUnusedGlobalSymbols -- referenced via vitest.config.ts alias for gi://GLib
export default {
    PRIORITY_DEFAULT: 0,
    get_home_dir: () => '/home/test',
    build_filenamev: (parts: string[]) => parts.join('/'),
    path_get_basename: (path: string) => path.split('/').filter(Boolean).pop() ?? path,
};
