// noinspection JSUnusedGlobalSymbols -- referenced via vitest.config.ts alias for gi://Shell
/** Context returned by every Shell.Global.get().create_app_launch_context() call. */
export const __launchContext = { name: 'launch-context' };

export default {
    AppSystem: { get_default: () => ({ lookup_app: (_id: string) => null }) },
    Global: {
        get: () => ({ create_app_launch_context: (_timestamp: number, _workspace: number) => __launchContext }),
    },
    App: class App {},
};
