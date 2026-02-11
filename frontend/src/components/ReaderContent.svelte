<script lang="ts">
    import { onMount } from 'svelte';
    import { getBook, type StoredBook } from '../db/books';

    export let currentBookId: string;

    let loading = true;
    let error: string | null = null;
    let currentChapterHtml = '';

    onMount(() => {
        void loadBook();
    });

    async function loadBook() {
        loading = true;
        error = null;

        try {
            const book = await getBook(currentBookId);
            if (!book) {
                error = 'Book not found in IndexedDB.';
                return;
            }

            const firstChapter = getFirstChapter(book);
            if (!firstChapter) {
                error = 'No chapter content found for this book.';
                return;
            }

            currentChapterHtml = firstChapter.html;
        } catch (err) {
            console.error(err);
            error = 'Failed to load chapter from IndexedDB.';
        } finally {
            loading = false;
        }
    }

    function getFirstChapter(book: StoredBook) {
        return book.chapters?.[0] ?? null;
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
