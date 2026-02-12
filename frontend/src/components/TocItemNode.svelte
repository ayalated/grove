<script lang="ts">
    import type { StoredTocItem } from '../db/books';

    export let node: StoredTocItem;
    export let level = 0;
    export let activeHref = '';
    export let onSelect: (href: string) => void;

    $: isActive = normalizeHref(activeHref) === normalizeHref(node.href);

    function normalizeHref(href: string): string {
        return href.split('#')[0].split('?')[0];
    }
</script>

<div class="toc-node" style={`padding-left: ${level * 12}px`}>
    <button class:active={isActive} class="toc-link" on:click={() => onSelect(node.href)}>
        {node.label}
    </button>

    {#if node.children && node.children.length > 0}
        {#each node.children as child}
            <svelte:self node={child} level={level + 1} {activeHref} {onSelect} />
        {/each}
    {/if}
</div>

<style>
    .toc-link {
        text-align: left;
        width: 100%;
    }

    .toc-link.active {
        border-color: #646cff;
    }
</style>
