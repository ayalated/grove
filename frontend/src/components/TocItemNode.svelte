<script lang="ts">
    import type { StoredTocItem } from '../db/books';

    export let node: StoredTocItem;
    export let level = 0;
    export let activeHref = '';
    export let onSelect: (href: string) => void;

    let expanded = true;

    $: isActive = normalizeHref(activeHref) === normalizeHref(node.href);

    function normalizeHref(href: string): string {
        return href.split('#')[0].split('?')[0];
    }
</script>

<div class="toc-node" style={`padding-left: ${level * 12}px`}>
    <div class="toc-row">
        {#if node.children && node.children.length > 0}
            <button class="toggle" on:click={() => (expanded = !expanded)} aria-label="Toggle toc branch">
                {expanded ? '▾' : '▸'}
            </button>
        {:else}
            <span class="toggle-space"></span>
        {/if}

        <button class:active={isActive} class="toc-link" on:click={() => onSelect(node.href)}>
            {node.label}
        </button>
    </div>

    {#if expanded && node.children && node.children.length > 0}
        {#each node.children as child}
            <svelte:self node={child} level={level + 1} {activeHref} {onSelect} />
        {/each}
    {/if}
</div>

<style>
    .toc-row {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .toggle,
    .toggle-space {
        width: 24px;
        flex-shrink: 0;
    }

    .toc-link {
        text-align: left;
        width: 100%;
    }

    .toc-link.active {
        border-color: #646cff;
    }
</style>
