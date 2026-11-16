// noinspection JSUnusedGlobalSymbols -- referenced via vitest.config.ts alias for resource:///org/gnome/shell/misc/util.js
const spawnedArgv: string[][] = [];

export function trySpawn(argv: string[]): void {
    spawnedArgv.push(argv);
}

/** Argv of every trySpawn() call since the last __resetSpawned(). */
export function __getSpawnedArgv(): string[][] {
    return spawnedArgv;
}

export function __resetSpawned(): void {
    spawnedArgv.length = 0;
}
