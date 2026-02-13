<script lang="ts">
    export let canPrev = false;
    export let canNext = false;
    export let onPrev: () => void;
    export let onNext: () => void;
</script>

<nav class="chapter-nav">
    <button on:click={onPrev} disabled={!canPrev}>Previous Chapter</button>
    <button on:click={onNext} disabled={!canNext}>Next Chapter</button>
</nav>

<style>
    .chapter-nav {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        justify-content: center;
        gap: 12px;
        padding: 10px 16px;
        border-top: 1px solid #ddd;
        background: #fff;
    }
</style>