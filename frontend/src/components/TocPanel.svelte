<script lang="ts">
    export let items: Array<{
        id: string;
        label: string;
        href: string;
    }> = [];
    export let collapsed = false;
    export let currentIndex = 0;

    export let onToggle: () => void;
    export let onSelect: (tocIndex: number) => void;
</script>

<div class:collapsed class="toc-panel">
    <button class="toggle" on:click={onToggle} aria-label="Toggle table of contents">
        {collapsed ? '☰' : '◀'}
    </button>

    {#if !collapsed && items.length > 0}
        <ul>
            {#each items as item, index}
                <li>
                    <button
                        class:active={index === currentIndex}
                        on:click={() => onSelect(index)}
                    >
                        {item.label}
                    </button>
                </li>
            {/each}
        </ul>
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

    ul {
        list-style: none;
        padding: 0 8px 12px;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        overflow-y: auto;
        max-height: calc(100% - 48px);
    }

    li button {
        width: 100%;
        text-align: left;
    }

    li button.active {
        border-color: #646cff;
    }
</style>
