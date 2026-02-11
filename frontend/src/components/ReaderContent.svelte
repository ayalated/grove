<script lang="ts">
    export let loading = false;
    export let error: string | null = null;
    export let chapterHtml = '';

    let contentEl: HTMLDivElement | null = null;

    $: if (contentEl) {
        contentEl.scrollTop = 0;
    }
</script>

<div class="reader-content" bind:this={contentEl}>
    {#if loading}
        <p>Loading chapter...</p>
    {:else if error}
        <p>{error}</p>
    {:else}
        <article>{@html chapterHtml}</article>
    {/if}
</div>

<style>
    .reader-content {
        --reader-bg-color: #fafafa;
        --reader-text-color: #1f2937;
        --reader-link-color: #1d4ed8;

        height: 100%;
        overflow: auto;
        padding: 16px;
        box-sizing: border-box;
        background: var(--reader-bg-color);
        color: var(--reader-text-color);
    }

    .reader-content :global(article),
    .reader-content :global(article *) {
        color: var(--reader-text-color) !important;
    }

    .reader-content :global(article a) {
        color: var(--reader-link-color) !important;
    }
</style>
