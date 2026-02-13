<script lang="ts">
    import { onMount } from 'svelte';
    import Bookshelf from './pages/Bookshelf.svelte';
    import Reader from './pages/Reader.svelte';

    let currentPage: 'shelf' | 'reader' = 'shelf';
    let currentBookId: string | null = null;

    onMount(() => {
        const bookId = getBookIdFromPath();
        if (!bookId) return;

        currentBookId = bookId;
        currentPage = 'reader';
    });

    function openBook(bookId: string) {
        const targetUrl = `${window.location.origin}/reader/${bookId}`;
        window.open(targetUrl, '_blank', 'noopener');
    }

    function backToShelf() {
        currentPage = 'shelf';
        currentBookId = null;
        history.replaceState(null, '', '/');
    }

    function getBookIdFromPath(): string | null {
        const match = window.location.pathname.match(/^\/reader\/([^/]+)$/);
        if (!match) return null;

        return decodeURIComponent(match[1]);
    }
</script>

{#if currentPage === 'shelf'}
    <Bookshelf on:openBook={(e) => openBook(e.detail)} />
{:else}
    {#if currentBookId}
        <Reader {currentBookId} on:back={backToShelf} />
    {/if}
{/if}