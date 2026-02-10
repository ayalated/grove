<script lang="ts">
    import TocPanel from '../components/TocPanel.svelte';
    import ReaderToolbar from '../components/ReaderToolbar.svelte';
    import ReaderContent from '../components/ReaderContent.svelte';

    export let currentBookId: string;

    function back() {
        dispatchEvent(new CustomEvent('back'));
    }
</script>

<button on:click={back}>← Back</button>

<div class="reader-layout">
    <TocPanel {currentBookId}/>
    <div class="reader-main">
        <ReaderToolbar/>
        <ReaderContent {currentBookId}/>
    </div>
</div>