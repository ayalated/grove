<script lang="ts">
    import { onDestroy, tick } from 'svelte';
    import { createPaginationController } from './paginationController';

    export let loading = false;
    export let error: string | null = null;
    export let chapterHtml = '';
    export let chapterRenderId = 0;
    export let showCoverPage = false;
    export let coverPageUrl: string | null = null;
    export let pendingFragment: string | null = null;
    export let pendingFragmentRequestId = 0;
    export let onFragmentHandled: () => void;
    export let resolveAssetUrl: (relativePath: string) => Promise<string | null>;
    export let isVertical = false;

    let contentEl: HTMLDivElement | null = null;
    let viewportEl: HTMLDivElement | null = null;
    let trackEl: HTMLDivElement | null = null;
    let articleEl: HTMLElement | null = null;
    let renderedHtml = '';
    let viewportWidth = 1;

    let processingToken = 0;
    let lastProcessedId = -1;
    let lastFragmentRequestId = -1;
    let touchMoveCleanup: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const pagination = createPaginationController();

    $: if (chapterRenderId !== lastProcessedId) {
        lastProcessedId = chapterRenderId;
        pagination.setPage(0);
        void preprocessChapterHtml();
    }

    $: if (!loading && !error && pendingFragment && pendingFragmentRequestId !== lastFragmentRequestId) {
        lastFragmentRequestId = pendingFragmentRequestId;
        void handlePendingFragment();
    }

    $: syncVerticalModeBindings();

    onDestroy(() => {
        touchMoveCleanup?.();
        resizeObserver?.disconnect();
    });

    async function preprocessChapterHtml() {
        const token = ++processingToken;

        if (showCoverPage) {
            renderedHtml = '';
            return;
        }

        if (!chapterHtml || error) {
            renderedHtml = chapterHtml || '';
            return;
        }

        const doc = new DOMParser().parseFromString(chapterHtml, 'text/html');

        const imgTags = Array.from(doc.querySelectorAll('img[src]'));
        for (const img of imgTags) {
            const src = img.getAttribute('src');
            if (!src || isAbsoluteUrl(src)) continue;

            const resolvedUrl = await resolveAssetUrl(src);
            if (!resolvedUrl) {
                img.remove();
                continue;
            }

            img.setAttribute('src', resolvedUrl);
        }

        const svgImageTags = Array.from(doc.querySelectorAll('image'));
        for (const svgImage of svgImageTags) {
            const href = svgImage.getAttribute('href') || svgImage.getAttribute('xlink:href');
            if (!href || isAbsoluteUrl(href)) continue;

            const resolvedUrl = await resolveAssetUrl(href);
            if (!resolvedUrl) {
                const svgContainer = svgImage.closest('svg');
                if (svgContainer) svgContainer.remove();
                else svgImage.remove();
                continue;
            }

            svgImage.setAttribute('href', resolvedUrl);
            svgImage.setAttribute('xlink:href', resolvedUrl);
        }

        if (token !== processingToken) return;

        renderedHtml = doc.body.innerHTML;
        await tick();
        updatePaginationLayout();
        applyTransform();
    }

    function syncVerticalModeBindings() {
        touchMoveCleanup?.();
        touchMoveCleanup = null;
        resizeObserver?.disconnect();

        if (!isVertical) return;

        if (contentEl) {
            const touchListener = (event: TouchEvent) => event.preventDefault();
            contentEl.addEventListener('touchmove', touchListener, { passive: false });
            touchMoveCleanup = () => contentEl?.removeEventListener('touchmove', touchListener);
        }

        if (!resizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                updatePaginationLayout();
                applyTransform();
            });
        }

        if (viewportEl) resizeObserver.observe(viewportEl);
        if (articleEl) resizeObserver.observe(articleEl);

        updatePaginationLayout();
        applyTransform();
    }

    function updatePaginationLayout() {
        if (!isVertical || !viewportEl || !articleEl) return;

        const measuredViewportWidth = Math.max(1, viewportEl.clientWidth);
        const contentWidth = Math.max(articleEl.scrollWidth, measuredViewportWidth);
        pagination.recalcLayout(contentWidth, measuredViewportWidth);
        viewportWidth = measuredViewportWidth;
    }

    function applyTransform() {
        if (!isVertical || !trackEl) return;
        trackEl.style.transform = pagination.getTransform();
    }

    function handleWheel(event: WheelEvent) {
        if (!isVertical) return;

        event.preventDefault();

        if (event.deltaY > 0) pagination.nextPage();
        else if (event.deltaY < 0) pagination.prevPage();

        applyTransform();
    }

    function handleVerticalPageKeys(event: KeyboardEvent) {
        if (!isVertical) return;

        const nextKeys = new Set(['ArrowDown', 'PageDown', ' ']);
        const prevKeys = new Set(['ArrowUp', 'PageUp']);

        if (nextKeys.has(event.key)) {
            event.preventDefault();
            pagination.nextPage();
            applyTransform();
            return;
        }

        if (prevKeys.has(event.key)) {
            event.preventDefault();
            pagination.prevPage();
            applyTransform();
        }
    }

    function isAbsoluteUrl(url: string): boolean {
        return /^(data:|blob:|https?:|\/)/i.test(url);
    }

    async function handlePendingFragment() {
        if (!pendingFragment) return;
        await tick();

        if (!isVertical) {
            const target = document.getElementById(pendingFragment);
            if (target) target.scrollIntoView({ block: 'start' });
        }

        onFragmentHandled();
    }
</script>

<svelte:window on:keydown={handleVerticalPageKeys} />

<div
    class="reader-content"
    class:vertical-mode={isVertical && !showCoverPage}
    bind:this={contentEl}
    on:wheel={handleWheel}
>
    {#if loading}
        <p>Loading chapter...</p>
    {:else if error}
        <p>{error}</p>
    {:else if showCoverPage && coverPageUrl}
        <div class="cover-page">
            <img src={coverPageUrl} alt="Book cover" />
        </div>
    {:else if isVertical}
        <div class="reader-viewport" bind:this={viewportEl}>
            <div class="reader-track" bind:this={trackEl}>
                <article class="reader-page-content" bind:this={articleEl} style={`--viewport-width: ${viewportWidth}px`}>
                    {@html renderedHtml}
                </article>
            </div>
        </div>
    {:else}
        <article>{@html renderedHtml}</article>
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

    .reader-content.vertical-mode {
        overflow: hidden;
    }

    .reader-viewport {
        width: 100%;
        height: 100%;
        overflow: hidden;
        position: relative;
    }

    .reader-track {
        display: flex;
        flex-direction: row;
        width: max-content;
        min-height: 100%;
    }

    .reader-page-content {
        writing-mode: vertical-rl;
        height: 100%;
        column-width: var(--viewport-width);
        column-gap: 0;
        column-fill: auto;
    }

    .reader-content :global(article),
    .reader-content :global(article *) {
        color: var(--reader-text-color) !important;
        text-align: left !important;
    }

    .reader-content :global(article a) {
        color: var(--reader-link-color) !important;
    }

    .cover-page {
        min-height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 16px;
        box-sizing: border-box;
    }

    .cover-page img {
        max-width: 100%;
        max-height: 100vh;
        width: auto;
        height: auto;
        object-fit: contain;
    }
</style>
