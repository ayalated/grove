<script lang="ts">
    import { onDestroy, tick } from 'svelte';

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
    let articleEl: HTMLElement | null = null;
    let renderedHtml = '';
    let processingToken = 0;
    let lastProcessedId = -1;
    let lastFragmentRequestId = -1;
    let pageIndex = 0;
    let pageCount = 1;
    let resizeObserver: ResizeObserver | null = null;

    $: if (!isVertical && contentEl) {
        contentEl.scrollTop = 0;
    }

    $: if (chapterRenderId !== lastProcessedId) {
        lastProcessedId = chapterRenderId;
        pageIndex = 0;
        void preprocessChapterHtml();
    }

    $: if (!loading && !error && pendingFragment && pendingFragmentRequestId !== lastFragmentRequestId) {
        lastFragmentRequestId = pendingFragmentRequestId;
        void jumpToPendingFragment();
    }

    $: if (isVertical) {
        clampPageIndex();
        applyPageTransform();
    }

    $: if (!isVertical && articleEl) {
        articleEl.style.transform = '';
    }

    onDestroy(() => {
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
        await tick();
        setupPaginationObserver();
        updatePageCount();
        applyPageTransform();
    }

    function isAbsoluteUrl(url: string): boolean {
        return /^(data:|blob:|https?:|\/)/i.test(url);
    }

    function setupPaginationObserver() {
        resizeObserver?.disconnect();
        if (!contentEl || !articleEl) return;

        resizeObserver = new ResizeObserver(() => {
            updatePageCount();
            applyPageTransform();
        });
        resizeObserver.observe(contentEl);
        resizeObserver.observe(articleEl);
    }

    function updatePageCount() {
        if (!isVertical || !contentEl || !articleEl) {
            pageCount = 1;
            pageIndex = 0;
            return;
        }

        const viewportWidth = contentEl.clientWidth;
        if (viewportWidth <= 0) {
            pageCount = 1;
            pageIndex = 0;
            return;
        }

        const totalWidth = articleEl.scrollWidth;
        pageCount = Math.max(1, Math.ceil(totalWidth / viewportWidth));
        clampPageIndex();
    }

    function clampPageIndex() {
        const maxPage = Math.max(0, pageCount - 1);
        if (pageIndex < 0) pageIndex = 0;
        if (pageIndex > maxPage) pageIndex = maxPage;
    }

    function applyPageTransform() {
        if (!isVertical || !contentEl || !articleEl) return;
        const viewportWidth = contentEl.clientWidth;
        const pageOffset = pageIndex * viewportWidth;
        articleEl.style.transform = `translateX(-${pageOffset}px)`;
    }

    function nextPage() {
        if (!isVertical) return;
        if (pageIndex >= pageCount - 1) return;
        pageIndex += 1;
        applyPageTransform();
    }

    function prevPage() {
        if (!isVertical) return;
        if (pageIndex <= 0) return;
        pageIndex -= 1;
        applyPageTransform();
    }

    function handleWheel(event: WheelEvent) {
        if (!isVertical) return;

        event.preventDefault();
        if (event.deltaY > 0) {
            nextPage();
        } else if (event.deltaY < 0) {
            prevPage();
        }
    }

    function handleClick(event: MouseEvent) {
        if (!isVertical || !contentEl) return;

        const bounds = contentEl.getBoundingClientRect();
        const clickX = event.clientX - bounds.left;
        if (clickX > bounds.width / 2) {
            nextPage();
        } else {
            prevPage();
        }
    }

    function handleKeydown(event: KeyboardEvent) {
        if (!isVertical) return;

        if (event.key === 'ArrowRight') {
            event.preventDefault();
            nextPage();
        }

        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            prevPage();
        }
    }

    async function jumpToPendingFragment() {
        if (!pendingFragment) return;

        await tick();

        if (!contentEl) {
            onFragmentHandled();
            return;
        }

        const target = contentEl.querySelector<HTMLElement>(`#${CSS.escape(pendingFragment)}`);
        if (target) {
            if (isVertical) {
                const viewportWidth = contentEl.clientWidth;
                if (viewportWidth > 0) {
                    pageIndex = Math.floor(target.offsetLeft / viewportWidth);
                    clampPageIndex();
                    applyPageTransform();
                }
            } else {
                target.scrollIntoView({ block: 'start' });
            }
        }

        onFragmentHandled();
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<div
    class="reader-content"
    class:vertical-mode={isVertical && !showCoverPage}
    bind:this={contentEl}
    on:wheel={handleWheel}
    on:click={handleClick}
>
    {#if loading}
        <p>Loading chapter...</p>
    {:else if error}
        <p>{error}</p>
    {:else if showCoverPage && coverPageUrl}
        <div class="cover-page">
            <img src={coverPageUrl} alt="Book cover" />
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
        position: relative;
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
