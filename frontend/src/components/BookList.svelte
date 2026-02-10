<script lang="ts">
    export let books: { id: string; title: string }[];
</script>

<ul>
    {#each books as book}
        <li>
            <button on:click={() => dispatchEvent(new CustomEvent('open', { detail: book }))}>
                {book.title}
            </button>
        </li>
    {/each}
</ul>