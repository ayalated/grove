<script lang="ts">
    import {readerSettings} from '../stores/readerStore';

    export let currentBookId: string;
</script>

<iframe
        src={`/api/books/${currentBookId}/chapters/1`}
        style="
    width:100%;
    height:100%;
    border:none;
  "
></iframe>