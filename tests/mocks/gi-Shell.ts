// noinspection JSUnusedGlobalSymbols -- referenced via vitest.config.ts alias for gi://Shell
export default {
    AppSystem: { get_default: () => ({ lookup_app: (_id: string) => null }) },
    Global: { get: () => ({ stage: null }) },
    App: class App {},
};
