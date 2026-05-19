// noinspection JSUnusedGlobalSymbols -- referenced via vitest.config.ts alias for resource:///org/gnome/shell/extensions/extension.js
export class Extension {
    uuid: string;
    constructor(meta: Record<string, unknown> = {}) {
        Object.assign(this, meta);
        this.uuid = (meta['uuid'] as string) ?? 'test-uuid';
    }
}
