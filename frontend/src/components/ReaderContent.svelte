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
    let lastScrolledFragmentRequestId = -1;
    let pageIndex = 0;
    let touchMoveCleanup: (() => void) | null = null;

    $: if (contentEl) {
        if (isVertical) {
            contentEl.scrollTop = 0;
            contentEl.scrollLeft = 0;
        } else {
            contentEl.scrollTop = 0;
        }
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
        applyPageTransform();
    }

    onDestroy(() => {
        touchMoveCleanup?.();
    });

    function isAbsoluteUrl(url: string): boolean {
        return /^(data:|blob:|https?:|\/)/i.test(url);
    }

    function applyPageTransform() {
        if (!isVertical || !contentEl || !articleEl) return;

        const containerWidth = contentEl.clientWidth;
        const safePageIndex = Math.max(0, pageIndex);
        if (safePageIndex !== pageIndex) {
            pageIndex = safePageIndex;
        }

        articleEl.style.transform = `translateX(${-safePageIndex * containerWidth}px)`;
    }

    function handleWheel(event: WheelEvent) {
        if (!isVertical) return;

        event.preventDefault();
        if (event.deltaY > 0) {
            pageIndex += 1;
        } else if (event.deltaY < 0) {
            pageIndex = Math.max(0, pageIndex - 1);
        }

        applyPageTransform();
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

        if (!contentEl) {
            onFragmentHandled();
            return;
        }

        const target = contentEl.querySelector<HTMLElement>(`#${CSS.escape(pendingFragment)}`);
        if (target) {
            if (isVertical && contentEl) {
                const containerWidth = contentEl.clientWidth;
                pageIndex = Math.max(0, Math.floor(target.offsetLeft / Math.max(1, containerWidth)));
                applyPageTransform();
            } else {
                target.scrollIntoView({ block: 'start' });
            }
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
        height: 100%;
        width: 100%;
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
