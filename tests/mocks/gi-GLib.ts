// noinspection JSUnusedGlobalSymbols -- referenced via vitest.config.ts alias for gi://GLib
export default {
    get_home_dir: () => '/home/test',
    build_filenamev: (parts: string[]) => parts.join('/'),
    path_get_basename: (path: string) => path.split('/').filter(Boolean).pop() ?? path,
    shell_quote: (s: string) => `'${s}'`,
    shell_parse_argv: (cmd: string): [boolean, string[]] => [true, cmd.split(' ')],
};
