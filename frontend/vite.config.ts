import {defineConfig} from 'vite'
import {svelte} from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
    appType: 'spa',
    plugins: [svelte()],
    server: {
        port: 3000
    },
    preview: {
        port: 3000
    }
})
