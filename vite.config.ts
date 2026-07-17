import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    // SPA mode: app 100% client-side (auth e dados via Supabase no
    // navegador), publicável em hospedagem estática.
    tanstackStart({ spa: { enabled: true } }),
    viteReact(),
  ],
})
