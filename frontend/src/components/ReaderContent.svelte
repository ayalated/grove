<script lang="ts">
    export let loading = false;
    export let error: string | null = null;
    export let chapterHtml = '';
    export let coverFallbackUrl: string | null = null;
    export let resolveAssetUrl: (relativePath: string) => Promise<string | null>;

    let contentEl: HTMLDivElement | null = null;
    let renderedHtml = '';
    let processingToken = 0;

    $: if (contentEl) {
        contentEl.scrollTop = 0;
    }

    $: {
        void preprocessChapterHtml();
    }

    async function preprocessChapterHtml() {
        const token = ++processingToken;

        if (!chapterHtml || loading || error) {
            renderedHtml = '';
            return;
        }

        const doc = new DOMParser().parseFromString(chapterHtml, 'text/html');
        let hasRenderableCover = false;

        const imgTags = Array.from(doc.querySelectorAll('img[src]'));
        for (const img of imgTags) {
            const src = img.getAttribute('src');
            if (!src) continue;

            if (isAbsoluteUrl(src)) {
                hasRenderableCover = true;
                continue;
            }

            const resolvedUrl = await resolveAssetUrl(src);
            if (!resolvedUrl) {
                img.remove();
                continue;
            }

            img.setAttribute('src', resolvedUrl);
            hasRenderableCover = true;
        }

        const svgImageTags = Array.from(doc.querySelectorAll('image'));
        for (const svgImage of svgImageTags) {
            const href =
                svgImage.getAttribute('href') ||
                svgImage.getAttribute('xlink:href');
            if (!href) continue;

            if (isAbsoluteUrl(href)) {
                hasRenderableCover = true;
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
            hasRenderableCover = true;
        }

        if (!hasRenderableCover && coverFallbackUrl) {
            const coverImage = doc.createElement('img');
            coverImage.setAttribute('src', coverFallbackUrl);
            coverImage.setAttribute('alt', 'Book cover');
            coverImage.style.display = 'block';
            coverImage.style.margin = '0 auto 24px';
            coverImage.style.maxWidth = '100%';
            doc.body.prepend(coverImage);
        }

        if (token !== processingToken) {
            return;
        }

        renderedHtml = doc.body.innerHTML;
    }

    function isAbsoluteUrl(url: string): boolean {
        return /^(data:|blob:|https?:|\/)/i.test(url);
    }
</script>

<div class="reader-content" bind:this={contentEl}>
    {#if loading}
        <p>Loading chapter...</p>
    {:else if error}
        <p>{error}</p>
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

    .reader-content :global(article),
    .reader-content :global(article *) {
        color: var(--reader-text-color) !important;
        text-align: left !important;
    }

    .reader-content :global(article a) {
        color: var(--reader-link-color) !important;
    }
</style>
