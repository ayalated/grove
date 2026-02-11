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
        height: 100%;
        overflow: auto;
        padding: 16px;
        box-sizing: border-box;
        background: #fafafa;
    }
</style>
