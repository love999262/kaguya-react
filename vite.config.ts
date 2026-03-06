import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: './',
    plugins: [react()],
    server: {
        host: 'localhost',
        port: 8089,
        open: true,
    },
    preview: {
        host: 'localhost',
        port: 4173,
    },
});
