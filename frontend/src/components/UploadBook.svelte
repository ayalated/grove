<script lang="ts">
    import { parseEpub } from '../epub/parseEpub';
    import { saveBook } from '../db/books';

    async function onChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        const book = await parseEpub(file);
        await saveBook(book);

        dispatchEvent(new CustomEvent('uploaded', { detail: book }));
    }
</script>

<input type="file" accept=".epub" on:change={onChange} />