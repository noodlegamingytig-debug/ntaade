import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
//
// viteSingleFile() inlines all JS and CSS straight into dist/index.html
// instead of splitting them into separate files under dist/assets/. That
// means the built index.html can be opened directly (double-click, or
// file://) to test locally, and the same single file is what gets
// deployed — no dev server or static file server needed to preview it.
// The app is small enough that this doesn't cost anything real in terms
// of caching/code-splitting.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
})
