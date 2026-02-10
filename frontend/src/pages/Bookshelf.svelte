<script lang="ts">
    import { onMount, createEventDispatcher } from 'svelte';
    import { getAllBooks, saveBook } from '../db/books';
    import { parseEpub } from '../epub/parseEpub';

    type Book = {
        id: string;
        title: string;
        isVertical: boolean;
        createdAt: number;
    };

    const dispatch = createEventDispatcher();

    let books: Book[] = [];
    let loading = false;
    let error: string | null = null;

    // 页面加载时，从 IndexedDB 读取书架
    onMount(async () => {
        books = await getAllBooks();
    });

    async function onFileChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        loading = true;
        error = null;

        try {
            const book = await parseEpub(file);
            await saveBook(book);

            // 更新书架（新书放在最前面）
            books = [book, ...books];
        } catch (err) {
            error = 'Failed to load EPUB file.';
            console.error(err);
        } finally {
            loading = false;
            input.value = ''; // 允许重复上传同一文件
        }
    }

    function openBook(book: Book) {
        dispatch('openBook', book.id);
    }
</script>

<style>
    .book img {
        width: 100%;
        aspect-ratio: 3 / 4;
        object-fit: cover;
    }
    .bookshelf {
        max-width: 960px;
        margin: 0 auto;
        padding: 24px;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 24px;
    }

    .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 16px;
    }

    .book {
        /*border: 1px solid #ddd;*/
        padding: 12px;
        cursor: pointer;
        /*background: #fff;*/
    }

    .book:hover {
        background: #f5f5f5;
    }

    .title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 8px;
    }

    .tag {
        font-size: 12px;
        color: #666;
    }

    .upload-btn {
        position: relative;
        overflow: hidden;
    }

    .upload-btn input {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
    }

    .error {
        color: red;
        margin-top: 12px;
    }
</style>

<div class="bookshelf">
    <div class="header">
        <h1>My Bookshelf</h1>

        <label class="upload-btn">
            <button disabled={loading}>
                {loading ? 'Loading…' : 'Add EPUB'}
            </button>
            <input type="file" accept=".epub" on:change={onFileChange} />
        </label>
    </div>

    {#if books.length === 0 && !loading}
        <p>No books yet. Upload an EPUB to start reading.</p>
    {/if}

    <div class="grid">
        {#each books as book}
            <div class="book" on:click={() => openBook(book)}>
                {#if book.coverUrl}
                    <img src={book.coverUrl} alt="cover" />
                {:else}
                    <div class="placeholder">No Cover</div>
                {/if}

                <div class="title">{book.title}</div>

                {#if book.isVertical}
                    <div class="tag">Vertical</div>
                {/if}
            </div>
        {/each}
    </div>

    {#if error}
        <div class="error">{error}</div>
    {/if}
</div>