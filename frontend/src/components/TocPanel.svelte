<script lang="ts">
    import TocItemNode from './TocItemNode.svelte';
    import type { StoredTocItem } from '../db/books';

    export let items: StoredTocItem[] = [];
    export let collapsed = false;
    export let activeHref = '';

    export let onToggle: () => void;
    export let onSelect: (href: string) => void;
</script>

<div class:collapsed class="toc-panel">
    <button class="toggle" on:click={onToggle} aria-label="Toggle table of contents">
        {collapsed ? '☰' : '◀'}
    </button>

    {#if !collapsed && items.length > 0}
        <div class="toc-tree">
            {#each items as item}
                <TocItemNode node={item} level={0} {activeHref} {onSelect} />
            {/each}
        </div>
    {/if}
</div>

<style>
    .toc-panel {
        width: 20vw;
        max-width: 320px;
        min-width: 220px;
        height: 100%;
        border-right: 1px solid #ddd;
        overflow: hidden;
        transition: width 0.2s ease;
        background: #fff;
        flex-shrink: 0;
    }

    .toc-panel.collapsed {
        width: 0;
        min-width: 0;
        border-right: none;
    }

    .toggle {
        margin: 8px;
    }

    .toc-tree {
        padding: 0 8px 12px;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow-y: auto;
        max-height: calc(100% - 48px);
    }
</style>
