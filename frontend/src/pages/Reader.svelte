<script lang="ts">
    import JSZip from 'jszip';
    import { createEventDispatcher, onDestroy, onMount } from 'svelte';
    import { getBook, type StoredBook } from '../db/books';
    import TocPanel from '../components/TocPanel.svelte';
    import ReaderContent from '../components/ReaderContent.svelte';
    import ChapterNav from '../components/ChapterNav.svelte';

    export let currentBookId: string;

    const dispatch = createEventDispatcher<{ back: void }>();

    let book: StoredBook | undefined;
    let zipArchive: JSZip | null = null;
    let loading = true;
    let error: string | null = null;
    let chapterHtml = '';
    let chapterBasePath = '';
    let coverPageUrl: string | null = null;
    let hasCover = false;
    let showCoverPage = false;
    let chapterRenderId = 0;
    let currentIndex = 0;
    let tocCollapsed = false;
    let chapterResourceUrls: string[] = [];

    onMount(() => {
        void initReader();
    });

    onDestroy(() => {
        revokeChapterResourceUrls();
    });

    async function initReader() {
        loading = true;
        error = null;

        try {
            book = await getBook(currentBookId);
            if (!book) {
                error = 'Book not found in IndexedDB.';
                return;
            }

            zipArchive = await loadZip(book);
            hasCover = await shouldShowVirtualCover(book, zipArchive);
            const initialIndex = hasCover ? 0 : findInitialSpineIndex(book);
            await loadChapter(initialIndex);
        } catch (err) {
            console.error(err);
            error = 'Failed to initialize reader.';
        } finally {
            loading = false;
        }
    }

    async function loadChapter(index: number) {
        if (!book || !zipArchive) return;

        // Virtual cover page at reader index 0 when cover exists and isn't duplicated by spine[0].
        if (hasCover && index === 0) {
            loading = true;
            error = null;
            revokeChapterResourceUrls();

            if (!book.coverBlob) {
                error = 'Cover image is missing.';
                loading = false;
                return;
            }

            coverPageUrl = URL.createObjectURL(book.coverBlob);
            chapterResourceUrls.push(coverPageUrl);
            showCoverPage = true;
            chapterHtml = '';
            currentIndex = 0;
            chapterRenderId += 1;
            loading = false;
            return;
        }

        const spineIndex = hasCover ? index - 1 : index;

        const chapterPath = getChapterPath(book, spineIndex);
        if (!chapterPath) {
            error = 'Chapter metadata is missing.';
            return;
        }

        loading = true;
        error = null;

        try {
            const chapterFile = zipArchive.file(chapterPath);
            if (!chapterFile) {
                error = 'Chapter file not found in EPUB archive.';
                return;
            }

            revokeChapterResourceUrls();

            chapterHtml = await chapterFile.async('string');
            chapterBasePath = chapterPath.substring(0, chapterPath.lastIndexOf('/') + 1);

            coverPageUrl = null;
            showCoverPage = false;

            currentIndex = index;
            chapterRenderId += 1;
        } catch (err) {
            console.error(err);
            error = 'Failed to load chapter content.';
        } finally {
            loading = false;
        }
    }

    function findInitialSpineIndex(targetBook: StoredBook): number {
        if (!targetBook.toc || targetBook.toc.length === 0) {
            return 0;
        }

        return getSpineIndexByHref(targetBook, targetBook.toc[0].href);
    }

    function getSpineIndexByHref(targetBook: StoredBook, tocHref: string): number {
        const hrefWithoutHash = tocHref.split('#')[0];
        const manifestItem = targetBook.manifest.find((item) => item.href === hrefWithoutHash);
        if (!manifestItem) return 0;

        const spineIndex = targetBook.spine.findIndex((item) => item.idref === manifestItem.id);
        return spineIndex >= 0 ? spineIndex : 0;
    }

    function onSelectToc(tocHref: string) {
        if (!book) return;

        const spineIndex = getSpineIndexByHref(book, tocHref);
        const readerIndex = hasCover ? spineIndex + 1 : spineIndex;
        void loadChapter(readerIndex);
    }

    function getCurrentActiveHref(targetBook: StoredBook): string {
        const spineIndex = hasCover ? currentIndex - 1 : currentIndex;
        const spineItem = targetBook.spine[spineIndex];
        if (!spineItem) return '';

        const manifestItem = targetBook.manifest.find((item) => item.id === spineItem.idref);
        return manifestItem?.href ?? '';
    }

    function prevChapter() {
        if (currentIndex <= 0) return;
        void loadChapter(currentIndex - 1);
    }

    function nextChapter() {
        if (!book || currentIndex >= getLastReaderIndex(book)) return;
        void loadChapter(currentIndex + 1);
    }

    function getLastReaderIndex(targetBook: StoredBook): number {
        return targetBook.spine.length - 1 + (hasCover ? 1 : 0);
    }

    function getChapterPath(targetBook: StoredBook, chapterIndex: number): string | null {
        const spineItem = targetBook.spine?.[chapterIndex];
        if (!spineItem) return null;

        const manifestItem = targetBook.manifest?.find((item) => item.id === spineItem.idref);
        if (!manifestItem) return null;

        const basePath = getBasePath(targetBook.opfPath);
        return resolvePath(basePath, manifestItem.href);
    }

    async function loadZip(targetBook: StoredBook): Promise<JSZip> {
        const buffer = await targetBook.epubBlob.arrayBuffer();
        return await JSZip.loadAsync(buffer);
    }

    function getBasePath(opfPath: string): string {
        return opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
    }

    function resolvePath(basePath: string, href: string): string {
        const combined = `${basePath}${href}`;
        const rawParts = combined.split('/');
        const normalized: string[] = [];

        for (const part of rawParts) {
            if (!part || part === '.') continue;
            if (part === '..') {
                normalized.pop();
                continue;
            }
            normalized.push(part);
        }

        return normalized.join('/');
    }

    async function resolveChapterAssetUrl(relativePath: string): Promise<string | null> {
        if (!zipArchive || !chapterBasePath) {
            return null;
        }

        const assetPath = resolvePath(chapterBasePath, relativePath);
        const assetFile = zipArchive.file(assetPath);
        if (!assetFile) {
            return null;
        }

        const assetBlob = await assetFile.async('blob');
        const assetUrl = URL.createObjectURL(assetBlob);
        chapterResourceUrls.push(assetUrl);
        return assetUrl;
    }

    function revokeChapterResourceUrls() {
        for (const url of chapterResourceUrls) {
            URL.revokeObjectURL(url);
        }
        chapterResourceUrls = [];
    }

    async function shouldShowVirtualCover(targetBook: StoredBook, zip: JSZip): Promise<boolean> {
        if (!targetBook.coverBlob) return false;

        const firstSpinePath = getChapterPath(targetBook, 0);
        if (!firstSpinePath) return true;

        const firstSpineFile = zip.file(firstSpinePath);
        if (!firstSpineFile) return true;

        const html = await firstSpineFile.async('string');
        return !isSingleImagePage(html);
    }

    function isSingleImagePage(html: string): boolean {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const body = doc.body;
        if (!body) return false;

        const text = body.textContent?.replace(/\s+/g, '') || '';
        const images = body.querySelectorAll('img');
        const nonImageElements = body.querySelectorAll('*:not(img):not(style):not(script)');

        return images.length === 1 && text.length === 0 && nonImageElements.length <= 1;
    }

</script>

<div class="reader-page">
    <div class="reader-header">
        <button on:click={() => dispatch('back')}>← Back</button>
        <h2>{book?.title || 'Reader'}</h2>
    </div>

    <div class="reader-layout">
        {#if book?.toc && book.toc.length > 0}
            <TocPanel
                items={book.toc}
                collapsed={tocCollapsed}
                activeHref={getCurrentActiveHref(book)}
                onToggle={() => (tocCollapsed = !tocCollapsed)}
                onSelect={onSelectToc}
            />
        {/if}

        <div class="reader-main">
            <ReaderContent
                {loading}
                {error}
                chapterHtml={chapterHtml}
                chapterRenderId={chapterRenderId}
                showCoverPage={showCoverPage}
                coverPageUrl={coverPageUrl}
                resolveAssetUrl={resolveChapterAssetUrl}
            />
        </div>
    </div>

    <ChapterNav
        canPrev={currentIndex > 0}
        canNext={Boolean(book && currentIndex < getLastReaderIndex(book))}
        onPrev={prevChapter}
        onNext={nextChapter}
    />
</div>

<style>
    .reader-page {
        position: fixed;
        inset: 0;
        display: flex;
        flex-direction: column;
        background: #fff;
    }

    .reader-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid #ddd;
        flex-shrink: 0;
    }

    .reader-header h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
    }

    .reader-layout {
        display: flex;
        flex: 1;
        min-height: 0;
        overflow: hidden;
        padding-bottom: 60px;
    }

    .reader-main {
        flex: 1;
        min-width: 0;
        min-height: 0;
    }
</style>
