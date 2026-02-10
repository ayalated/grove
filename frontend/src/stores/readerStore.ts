import {writable} from 'svelte/store';

export const readerSettings = writable({
    fontSize: 18,
    fontFamily: 'serif',
    background: '#f7f4ed'
});