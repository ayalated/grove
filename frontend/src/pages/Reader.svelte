<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import TocPanel from '../components/TocPanel.svelte';
    import ReaderToolbar from '../components/ReaderToolbar.svelte';
    import ReaderContent from '../components/ReaderContent.svelte';

    export let currentBookId: string;

    const dispatch = createEventDispatcher<{ back: void }>();

    function back() {
        dispatch('back');
    }
</script>

<button on:click={back}>← Back</button>

<div class="reader-layout">
    <TocPanel/>
    <div class="reader-main">
        <ReaderToolbar/>
        <ReaderContent {currentBookId}/>
    </div>
</div>
