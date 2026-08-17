// noinspection JSUnusedGlobalSymbols -- referenced via vitest.config.ts alias for gi://Gio

// In-memory filesystem registry. Empty by default so existing tests keep the
// "nothing exists" behavior; specs stage entries via __setFiles().
type FakeNode = { type: 'file'; contents: string } | { type: 'dir' };

const nodes = new Map<string, FakeNode>();
const enumerateCounts = new Map<string, number>();
const spawnedArgv: string[][] = [];

/** Stage fake filesystem entries: string value = file contents, null = directory. */
export function __setFiles(map: Record<string, string | null>): void {
    for (const [path, value] of Object.entries(map)) {
        nodes.set(path, value === null ? { type: 'dir' } : { type: 'file', contents: value });
    }
}

export function __reset(): void {
    nodes.clear();
    enumerateCounts.clear();
    spawnedArgv.length = 0;
}

/** Argv of every Gio.Subprocess.new() call since the last __reset(). */
export function __getSpawnedArgv(): string[][] {
    return spawnedArgv;
}

/** Number of times a directory was enumerated (sync + async combined). */
export function __getEnumerateCount(path: string): number {
    return enumerateCounts.get(path) ?? 0;
}

const FileType = { UNKNOWN: 0, REGULAR: 1, DIRECTORY: 2 };

type MaybeCancellable = { is_cancelled?: () => boolean } | null | undefined;

function checkCancelled(cancellable: unknown): void {
    if ((cancellable as MaybeCancellable)?.is_cancelled?.()) {
        throw new Error('Operation cancelled');
    }
}

class FakeFileInfo {
    constructor(private readonly name: string, private readonly fileType: number) {}
    get_name() { return this.name; }
    get_file_type() { return this.fileType; }
}

type AsyncResult<T> = { data: T; cancellable: unknown };

class FakeEnumerator {
    private readonly remaining: FakeFileInfo[];

    constructor(infos: FakeFileInfo[]) {
        this.remaining = [...infos];
    }

    next_file(cancellable?: unknown): FakeFileInfo | null {
        checkCancelled(cancellable);
        return this.remaining.shift() ?? null;
    }

    next_files_async(numFiles: number, _ioPriority: number, cancellable: unknown,
                     callback: (source: FakeEnumerator, res: AsyncResult<number>) => void): void {
        queueMicrotask(() => callback(this, { data: numFiles, cancellable }));
    }

    next_files_finish(res: AsyncResult<number>): FakeFileInfo[] {
        checkCancelled(res.cancellable);
        return this.remaining.splice(0, res.data);
    }

    close(_cancellable?: unknown): void {}

    close_async(_ioPriority: number, cancellable: unknown,
                callback?: (source: FakeEnumerator, res: AsyncResult<null>) => void): void {
        if (callback) queueMicrotask(() => callback(this, { data: null, cancellable }));
    }

    close_finish(_res: AsyncResult<null>): boolean { return true; }
}

class FakeSubprocess {
    wait_async(cancellable: unknown, callback: (source: FakeSubprocess, res: AsyncResult<null>) => void): void {
        queueMicrotask(() => callback(this, { data: null, cancellable }));
    }

    wait_finish(_res: AsyncResult<null>): boolean { return true; }
}

class FakeFile {
    constructor(private readonly path: string) {}

    query_exists(_cancellable?: unknown): boolean {
        return nodes.has(this.path);
    }

    get_uri(): string {
        return `file://${this.path}`;
    }

    load_contents(cancellable?: unknown): [boolean, Uint8Array | null] {
        checkCancelled(cancellable);
        const node = nodes.get(this.path);
        if (node?.type === 'file') {
            return [true, new TextEncoder().encode(node.contents)];
        }
        return [false, null];
    }

    load_contents_async(cancellable: unknown,
                        callback: (source: FakeFile, res: AsyncResult<null>) => void): void {
        queueMicrotask(() => callback(this, { data: null, cancellable }));
    }

    load_contents_finish(res: AsyncResult<null>): [boolean, Uint8Array, string | null] {
        checkCancelled(res.cancellable);
        const node = nodes.get(this.path);
        if (node?.type !== 'file') {
            throw new Error(`No such file: ${this.path}`);
        }
        return [true, new TextEncoder().encode(node.contents), null];
    }

    enumerate_children(_attrs: string, _flags: number, cancellable?: unknown): FakeEnumerator {
        checkCancelled(cancellable);
        return this._enumerate();
    }

    enumerate_children_async(_attrs: string, _flags: number, _ioPriority: number, cancellable: unknown,
                             callback: (source: FakeFile, res: AsyncResult<null>) => void): void {
        queueMicrotask(() => callback(this, { data: null, cancellable }));
    }

    enumerate_children_finish(res: AsyncResult<null>): FakeEnumerator {
        checkCancelled(res.cancellable);
        return this._enumerate();
    }

    private _enumerate(): FakeEnumerator {
        if (nodes.get(this.path)?.type !== 'dir') {
            throw new Error(`Not a directory: ${this.path}`);
        }
        enumerateCounts.set(this.path, (enumerateCounts.get(this.path) ?? 0) + 1);
        const prefix = this.path.endsWith('/') ? this.path : `${this.path}/`;
        const infos: FakeFileInfo[] = [];
        for (const [path, node] of nodes) {
            if (!path.startsWith(prefix)) continue;
            const rest = path.slice(prefix.length);
            if (!rest || rest.includes('/')) continue;
            infos.push(new FakeFileInfo(rest, node.type === 'dir' ? FileType.DIRECTORY : FileType.REGULAR));
        }
        return new FakeEnumerator(infos);
    }
}

export default {
    File: { new_for_path: (path: string) => new FakeFile(path) },
    Cancellable: class Cancellable { is_cancelled() { return false; } },
    FileQueryInfoFlags: { NONE: 0 },
    FileType,
    SubprocessFlags: { NONE: 0 },
    Subprocess: {
        new: (argv: string[], _flags: number) => {
            spawnedArgv.push(argv);
            return new FakeSubprocess();
        },
    },
    FileIcon: class FileIcon { constructor(p: unknown) { Object.assign(this as object, p ?? {}); } },
};
