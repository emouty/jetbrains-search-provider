// noinspection JSUnusedGlobalSymbols -- referenced via vitest.config.ts alias for resource:///org/gnome/shell/ui/main.js

/** Providers currently added to the shell search, in the order they were added. */
export const __addedProviders: unknown[] = [];

export function __reset(): void {
    __addedProviders.length = 0;
}

export const overview = {
    searchController: {
        addProvider(provider: unknown): void {
            __addedProviders.push(provider);
        },
        removeProvider(provider: unknown): void {
            const index = __addedProviders.indexOf(provider);
            if (index >= 0) __addedProviders.splice(index, 1);
        },
        _searchResults: { _content: { remove_child() {}, insert_child_at_index() {} } },
    },
};
