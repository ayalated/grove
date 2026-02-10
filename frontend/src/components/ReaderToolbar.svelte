<script lang="ts">
    import {readerSettings} from '../stores/readerStore';
</script>

<div class="toolbar">
    <button on:click={() => readerSettings.update(s => ({ ...s, fontSize: s.fontSize + 1 }))}>A+</button>
    <button on:click={() => readerSettings.update(s => ({ ...s, fontSize: s.fontSize - 1 }))}>A-</button>
</div>