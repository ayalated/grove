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
    let processingToken = 0;
    let lastProcessedId = -1;
    let lastScrolledFragmentRequestId = -1;
    let pageIndex = 0;
    let touchMoveCleanup: (() => void) | null = null;

    let pageIndex = 0;
    let pageCount = 1;
    let viewportWidth = 0;
    let touchMoveCleanup: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;

    let pageIndex = 0;
    let pageCount = 1;
    let viewportWidth = 0;
    let touchMoveCleanup: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let anchorLogicalOffsetX: number | null = null;

    let pageIndex = 0;
    let pageCount = 1;
    let viewportWidth = 0;
    let touchMoveCleanup: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let anchorLogicalOffsetX: number | null = null;
    let layoutMeasurePending = false;

    let viewportWidth = 0;
    let touchMoveCleanup: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let anchorLogicalOffsetX: number | null = null;
    let layoutMeasurePending = false;

    const pagination = createPaginationController();

    $: if (contentEl) {
        contentEl.scrollTop = 0;
        contentEl.scrollLeft = 0;
    }

    $: if (chapterRenderId !== lastProcessedId) {
        lastProcessedId = chapterRenderId;
        pagination.setPage(0);
        syncPaginationState();
        void preprocessChapterHtml();
    }

    $: if (!loading && !error && pendingFragment && pendingFragmentRequestId !== lastFragmentRequestId) {
        lastFragmentRequestId = pendingFragmentRequestId;
        void jumpToPendingFragment();
    }

    $: if (isVertical) {
        applyPageTransform();
    } else if (articleEl) {
        articleEl.style.transform = '';
    }

    $: {
        touchMoveCleanup?.();
        touchMoveCleanup = null;

        if (contentEl) {
            const listener = (event: TouchEvent) => handleTouchMove(event);
            contentEl.addEventListener('touchmove', listener, { passive: false });
            touchMoveCleanup = () => contentEl?.removeEventListener('touchmove', listener);
        }
    }

    $: if (isVertical) {
        applyPageTransform();
    } else if (articleEl) {
        articleEl.style.transform = '';
    }

    $: {
        touchMoveCleanup?.();
        touchMoveCleanup = null;

        if (contentEl) {
            const listener = (event: TouchEvent) => handleTouchMove(event);
            contentEl.addEventListener('touchmove', listener, { passive: false });
            touchMoveCleanup = () => contentEl?.removeEventListener('touchmove', listener);
        }
    }

    $: {
        touchMoveCleanup?.();
        touchMoveCleanup = null;

        if (contentEl && isVertical) {
            const listener = (event: TouchEvent) => handleTouchMove(event);
            contentEl.addEventListener('touchmove', listener, { passive: false });
            touchMoveCleanup = () => contentEl?.removeEventListener('touchmove', listener);
        }
    }

    $: if (isVertical && !loading && !error && !showCoverPage) {
        setupVerticalViewport();
    } else {
        teardownVerticalViewport();
    }

    $: {
        touchMoveCleanup?.();
        touchMoveCleanup = null;

        if (contentEl && isVertical) {
            const listener = (event: TouchEvent) => handleTouchMove(event);
            contentEl.addEventListener('touchmove', listener, { passive: false });
            touchMoveCleanup = () => contentEl?.removeEventListener('touchmove', listener);
        }
    }

    $: if (isVertical && !loading && !error && !showCoverPage) {
        setupVerticalViewport();
    } else {
        teardownVerticalViewport();
    }

    $: {
        touchMoveCleanup?.();
        touchMoveCleanup = null;

        if (contentEl && isVertical) {
            const listener = (event: TouchEvent) => handleTouchMove(event);
            contentEl.addEventListener('touchmove', listener, { passive: false });
            touchMoveCleanup = () => contentEl?.removeEventListener('touchmove', listener);
        }
    }

    $: if (isVertical && !loading && !error && !showCoverPage) {
        setupVerticalViewport();
    } else {
        teardownVerticalViewport();
    }

    $: {
        touchMoveCleanup?.();
        touchMoveCleanup = null;

        if (contentEl && isVertical) {
            const listener = (event: TouchEvent) => handleTouchMove(event);
            contentEl.addEventListener('touchmove', listener, { passive: false });
            touchMoveCleanup = () => contentEl?.removeEventListener('touchmove', listener);
        }
    }

    $: if (isVertical && !loading && !error && !showCoverPage) {
        setupVerticalViewport();
    } else {
        teardownVerticalViewport();
    }

    onDestroy(() => {
        teardownVerticalViewport();
        touchMoveCleanup?.();
    });

    function syncPaginationState() {
        viewportWidth = pagination.getState().viewportWidth;
    }

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
            if (!src) continue;

            if (isAbsoluteUrl(src)) {
                continue;
            }

            const resolvedUrl = await resolveAssetUrl(src);
            if (!resolvedUrl) {
                img.remove();
                continue;
            }

            img.setAttribute('src', resolvedUrl);
        }

        const svgImageTags = Array.from(doc.querySelectorAll('image'));
        for (const svgImage of svgImageTags) {
            const href =
                svgImage.getAttribute('href') ||
                svgImage.getAttribute('xlink:href');
            if (!href) continue;

            if (isAbsoluteUrl(href)) {
                continue;
            }

            const resolvedUrl = await resolveAssetUrl(href);
            if (!resolvedUrl) {
                const svgContainer = svgImage.closest('svg');
                if (svgContainer) {
                    svgContainer.remove();
                } else {
                    svgImage.remove();
                }
                continue;
            }

            svgImage.setAttribute('href', resolvedUrl);
            svgImage.setAttribute('xlink:href', resolvedUrl);
        }

        if (token !== processingToken) {
            return;
        }

        renderedHtml = doc.body.innerHTML;
        await measureLayoutAndUpdatePaging();
    }

    function setupVerticalViewport() {
        if (!viewportEl || !trackEl || !articleEl) return;

        if (!resizeObserver) {
            resizeObserver = new ResizeObserver(() => {
                void scheduleMeasureLayoutAndUpdatePaging();
            });
        }

        resizeObserver.disconnect();
        resizeObserver.observe(viewportEl);
        resizeObserver.observe(articleEl);
        void scheduleMeasureLayoutAndUpdatePaging();
    }

    async function scheduleMeasureLayoutAndUpdatePaging() {
        if (layoutMeasurePending) return;
        layoutMeasurePending = true;
        try {
            await measureLayoutAndUpdatePaging();
        } finally {
            layoutMeasurePending = false;
        }
    }

    async function measureLayoutAndUpdatePaging() {
        await tick();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

        recalculatePageMetrics();
        if (anchorLogicalOffsetX !== null && pagination.getState().viewportWidth > 0) {
            pagination.setPage(Math.floor(anchorLogicalOffsetX / pagination.getState().viewportWidth));
            syncPaginationState();
        }
        applyTrackTransform();
    }

    function teardownVerticalViewport() {
        resizeObserver?.disconnect();
        pagination.recalcLayout(0, 0);
        pagination.setPage(0);
        syncPaginationState();
        if (trackEl) {
            trackEl.style.transform = '';
        }
        anchorLogicalOffsetX = null;
    }

    function recalculatePageMetrics() {
        if (!isVertical || !viewportEl || !articleEl) {
            pagination.recalcLayout(0, 0);
            syncPaginationState();
            return;
        }

        const nextViewportWidth = viewportEl.clientWidth;
        if (nextViewportWidth <= 0) {
            pagination.recalcLayout(0, 0);
            syncPaginationState();
            return;
        }

        const contentWidth = Math.max(articleEl.scrollWidth, nextViewportWidth);
        pagination.recalcLayout(contentWidth, nextViewportWidth);
        syncPaginationState();
    }

    function applyTrackTransform() {
        if (!isVertical || !trackEl) return;
        trackEl.style.transform = pagination.getTransform();
    }

    function applyTrackTransform() {
        if (!isVertical || !trackEl || viewportWidth <= 0) return;
        clampPageIndex();
        trackEl.style.transform = `translate3d(${-pageIndex * viewportWidth}px, 0, 0)`;
    }

    onDestroy(() => {
        touchMoveCleanup?.();
    });

    function isAbsoluteUrl(url: string): boolean {
        return /^(data:|blob:|https?:|\/)/i.test(url);
    }

    function handleWheel(event: WheelEvent) {
        if (!isVertical) return;

        event.preventDefault();

        if (event.deltaY > 0) {
            pagination.nextPage();
        } else if (event.deltaY < 0) {
            pagination.prevPage();
        }

        syncPaginationState();
        applyTrackTransform();
    }

    function handleTouchMove(event: TouchEvent) {
        if (!isVertical) return;
        event.preventDefault();
    }

    function handleVerticalScrollKeys(event: KeyboardEvent) {
        if (!isVertical) return;

        const blockedKeys = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', ' ']);
        if (blockedKeys.has(event.key)) {
            event.preventDefault();
        }
    }

    async function scrollToPendingFragment() {
        if (!pendingFragment) return;

        await tick();

        const target = document.getElementById(pendingFragment);
        if (!target) {
            onFragmentHandled();
            return;
        }

        if (isVertical && articleEl && pagination.getState().viewportWidth > 0) {
            const rect = target.getBoundingClientRect();
            const contentRect = articleEl.getBoundingClientRect();
            const currentTranslateOffset = pagination.getState().pageIndex * pagination.getState().viewportWidth;
            const offsetX = rect.left - contentRect.left + currentTranslateOffset;

            anchorLogicalOffsetX = Math.max(0, offsetX);
            pagination.setPage(Math.floor(anchorLogicalOffsetX / pagination.getState().viewportWidth));
            syncPaginationState();
            applyTrackTransform();
        } else if (!isVertical) {
            target.scrollIntoView({ block: 'start' });
        }

        onFragmentHandled();
    }
</script>

<svelte:window on:keydown={handleVerticalScrollKeys} />

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
        <div class="reader-viewport" bind:this={viewportEl} style={`--viewport-width: ${Math.max(viewportWidth, 1)}px`}>
            <div class="reader-track" bind:this={trackEl}>
                <article class="reader-page-content" bind:this={articleEl}>{@html renderedHtml}</article>
            </div>
        </div>
    {:else}
        <article bind:this={articleEl}>{@html renderedHtml}</article>
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
        position: relative;
        overflow: hidden;
        width: 100%;
        height: 100%;
    }

    .reader-track {
        display: flex;
        flex-direction: row;
        width: max-content;
        min-height: 100%;
        will-change: transform;
    }

    .reader-page-content {
        width: 100%;
        flex-shrink: 0;
        min-height: 100%;
    }

    .reader-content.vertical-mode .reader-page-content {
        writing-mode: vertical-rl;
        column-width: var(--viewport-width);
        column-gap: 0;
        column-fill: auto;
    }

    .reader-content :global(article),
    .reader-content :global(article *) {
        color: var(--reader-text-color) !important;
        text-align: left !important;
    }

    .reader-content.vertical-mode :global(article) {
        writing-mode: vertical-rl;
        height: 100%;
        column-width: calc(100% - 32px);
        column-gap: 0;
        column-fill: auto;
        overflow: hidden;
        transition: transform 0.2s ease-out;
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
