<script lang="ts">
    import { onMount } from 'svelte';
    import Bookshelf from './pages/Bookshelf.svelte';
    import Reader from './pages/Reader.svelte';

    let currentPage: 'shelf' | 'reader' = 'shelf';
    let currentBookId: string | null = null;

    initializeRoute();

    onMount(() => {
        const onPopState = () => initializeRoute();
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    });

    function openBook(bookId: string) {
        const targetUrl = `/reader/${encodeURIComponent(bookId)}`;
        window.open(targetUrl, '_blank', 'noopener');
    }

    function backToShelf() {
        currentPage = 'shelf';
        currentBookId = null;
        history.replaceState(null, '', '/');
    }

    function initializeRoute() {
        if (typeof window === 'undefined') return;

        const bookId = getBookIdFromPath(window.location.pathname);
        if (bookId) {
            currentBookId = bookId;
            currentPage = 'reader';
            return;
        }

        currentBookId = null;
        currentPage = 'shelf';
    }

    function getBookIdFromPath(pathname: string): string | null {
        const match = pathname.match(/^\/reader\/([^/?#]+)\/?$/);
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
