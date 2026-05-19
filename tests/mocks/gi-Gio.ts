// noinspection JSUnusedGlobalSymbols -- referenced via vitest.config.ts alias for gi://Gio
class FakeFile {
    query_exists(_cancellable?: unknown) { return false; }
    load_contents(_cancellable?: unknown): [boolean, Uint8Array | null] { return [false, null]; }
}

export default {
    File: { new_for_path: (_path: string) => new FakeFile() },
    Cancellable: class Cancellable { is_cancelled() { return false; } },
    FileQueryInfoFlags: { NONE: 0 },
    FileType: { DIRECTORY: 2 },
    SubprocessFlags: { NONE: 0 },
    FileIcon: class FileIcon { constructor(p: unknown) { Object.assign(this as object, p ?? {}); } },
};
