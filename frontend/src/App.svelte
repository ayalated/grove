<script lang="ts">
    import { onMount } from 'svelte';
    import Bookshelf from './pages/Bookshelf.svelte';
    import Reader from './pages/Reader.svelte';

    let currentPage: 'shelf' | 'reader' = 'shelf';
    let currentBookId: string | null = null;

    onMount(() => {
        const bookId = getBookIdFromUrl();
        if (!bookId) return;

        currentBookId = bookId;
        currentPage = 'reader';
    });

    function openBook(bookId: string) {
        const targetUrl = new URL(window.location.href);
        targetUrl.searchParams.set('bookId', bookId);

        window.open(targetUrl.toString(), '_blank', 'noopener');
    }

    function backToShelf() {
        currentPage = 'shelf';
        currentBookId = null;

        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.delete('bookId');
        history.replaceState(null, '', currentUrl.toString());
    }

    function getBookIdFromUrl(): string | null {
        const params = new URLSearchParams(window.location.search);
        return params.get('bookId');
    }
</script>

{#if currentPage === 'shelf'}
    <Bookshelf on:openBook={(e) => openBook(e.detail)} />
{:else}
    {#if currentBookId}
        <Reader {currentBookId} on:back={backToShelf} />
    {/if}
{/if}
