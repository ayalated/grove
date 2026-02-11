<script lang="ts">
    import JSZip from 'jszip';
    import { onMount } from 'svelte';
    import { getBook, type StoredBook } from '../db/books';

    export let currentBookId: string;

    let loading = true;
    let error: string | null = null;
    let currentChapterHtml = '';

    onMount(() => {
        void loadChapterByIndex(0);
    });

    async function loadChapterByIndex(chapterIndex: number) {
        loading = true;
        error = null;

        try {
            const book = await getBook(currentBookId);
            if (!book) {
                error = 'Book not found in IndexedDB.';
                return;
            }

            const chapterPath = getChapterPath(book, chapterIndex);
            if (!chapterPath) {
                error = 'No chapter metadata found for this book.';
                return;
            }

            const zip = await loadZip(book);
            const chapterFile = zip.file(chapterPath);
            if (!chapterFile) {
                error = 'Chapter file not found in EPUB archive.';
                return;
            }

            currentChapterHtml = await chapterFile.async('string');
        } catch (err) {
            console.error(err);
            error = 'Failed to load chapter from IndexedDB blob.';
        } finally {
            loading = false;
        }
    }

    function getChapterPath(book: StoredBook, chapterIndex: number): string | null {
        const spineItem = book.spine?.[chapterIndex];
        if (!spineItem) return null;

        const manifestItem = book.manifest?.find((item) => item.id === spineItem.idref);
        if (!manifestItem) return null;

        const basePath = getBasePath(book.opfPath);
        return resolvePath(basePath, manifestItem.href);
    }

    async function loadZip(book: StoredBook): Promise<JSZip> {
        const buffer = await book.epubBlob.arrayBuffer();
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
</script>

{#if loading}
    <p>Loading chapter...</p>
{:else if error}
    <p>{error}</p>
{:else}
    <iframe
        title="EPUB chapter"
        srcdoc={currentChapterHtml}
        style="
            width:100%;
            height:100%;
            border:none;
        "
    ></iframe>
{/if}
