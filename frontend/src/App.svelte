<script lang="ts">
    import Bookshelf from './pages/Bookshelf.svelte';
    import Reader from './pages/Reader.svelte';

    let currentPage: 'shelf' | 'reader' = 'shelf';
    let currentBookId: string | null = null;

    function openBook(bookId: string) {
        currentBookId = bookId;
        currentPage = 'reader';
    }

    function backToShelf() {
        currentPage = 'shelf';
        currentBookId = null;
    }
</script>

{#if currentPage === 'shelf'}
    <Bookshelf on:openBook={(e) => openBook(e.detail)} />
{:else}
    {#if currentBookId}
        <Reader {currentBookId} on:back={backToShelf} />
    {/if}
{/if}
