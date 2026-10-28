import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

/*
 * Serving under the editor's own path prefix puts the page inside the Data Load Editor's address space.
 * A fixed port keeps the origin granted in the extension popup valid across restarts.
 */
export default defineConfig({
  base: '/dataloadeditor/app/',
  plugins: [tailwindcss()],
  server: {
    host: 'localhost',
    port: 5180,
    strictPort: true,
  },
});
