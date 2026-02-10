<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { parseEpub } from '../epub/parseEpub';
    import { saveBook } from '../db/books';

    const dispatch = createEventDispatcher<{ uploaded: { id: string } }>();

    async function onChange(e: Event) {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;

        const book = await parseEpub(file);
        await saveBook(book);

        dispatch('uploaded', { id: book.id });
    }
</script>

<input type="file" accept=".epub" on:change={onChange} />
