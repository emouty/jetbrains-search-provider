// noinspection JSUnusedGlobalSymbols -- referenced via vitest.config.ts alias for gi://Gio

// In-memory filesystem registry. Empty by default so existing tests keep the
// "nothing exists" behavior; specs stage entries via __setFiles().
type FakeNode = { type: 'file'; contents: string } | { type: 'dir' };

const nodes = new Map<string, FakeNode>();
const enumerateCounts = new Map<string, number>();

/** Stage fake filesystem entries: string value = file contents, null = directory. */
export function __setFiles(map: Record<string, string | null>): void {
    for (const [path, value] of Object.entries(map)) {
        nodes.set(path, value === null ? { type: 'dir' } : { type: 'file', contents: value });
    }
}

export function __reset(): void {
    nodes.clear();
    enumerateCounts.clear();
    monitors.length = 0;
    unmonitorablePaths.clear();
}

const FileMonitorEvent = { CHANGED: 0, CHANGES_DONE_HINT: 1, DELETED: 2, CREATED: 3 };

type ChangedHandler = (monitor: FakeFileMonitor, file: FakeFile, otherFile: null, event: number) => void;

class FakeFileMonitor {
    readonly handlers = new Map<number, ChangedHandler>();
    cancelled = false;
    private nextId = 1;

    constructor(readonly path: string) {}

    connect(_signal: 'changed', handler: ChangedHandler): number {
        this.handlers.set(this.nextId, handler);
        return this.nextId++;
    }

    disconnect(id: number): void { this.handlers.delete(id); }

    cancel(): boolean { this.cancelled = true; return true; }
}

const monitors: FakeFileMonitor[] = [];
const unmonitorablePaths = new Set<string>();

/** Make File.monitor_file() throw for `path`. */
export function __failMonitorFor(path: string): void {
    unmonitorablePaths.add(path);
}

/** Monitors created through File.monitor_file(), in creation order. */
export function __getMonitors(): readonly FakeFileMonitor[] {
    return monitors;
}

/** Deliver a 'changed' event to every live monitor on `path`. */
export function __emitFileChange(path: string, event: number): void {
    for (const monitor of monitors) {
        if (monitor.path !== path || monitor.cancelled) continue;
        for (const handler of monitor.handlers.values()) {
            handler(monitor, new FakeFile(path), null, event);
        }
    }
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

class FakeFile {
    constructor(private readonly path: string) {}

    query_exists(_cancellable?: unknown): boolean {
        return nodes.has(this.path);
    }

    get_uri(): string {
        return `file://${this.path}`;
    }

    monitor_file(_flags: number, _cancellable: unknown): FakeFileMonitor {
        if (unmonitorablePaths.has(this.path)) {
            throw new Error(`Cannot monitor ${this.path}`);
        }
        const monitor = new FakeFileMonitor(this.path);
        monitors.push(monitor);
        return monitor;
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
    Cancellable: class Cancellable {
        private cancelled = false;
        cancel() { this.cancelled = true; }
        is_cancelled() { return this.cancelled; }
    },
    FileQueryInfoFlags: { NONE: 0 },
    FileMonitorFlags: { NONE: 0 },
    FileMonitorEvent,
    FileType,
    FileIcon: class FileIcon { constructor(p: unknown) { Object.assign(this as object, p ?? {}); } },
};
