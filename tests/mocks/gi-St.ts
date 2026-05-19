// noinspection JSUnusedGlobalSymbols -- referenced via vitest.config.ts alias for gi://St
export default {
    Icon: class Icon {
        icon_name?: string;
        icon_size?: number;
        gicon?: unknown;
        constructor(props: Record<string, unknown> = {}) {
            Object.assign(this, props);
        }
    },
    ThemeContext: {
        get_for_stage: (_stage: unknown) => ({ scaleFactor: 1 }),
    },
};
