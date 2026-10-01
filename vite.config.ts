import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      build: {
        rollupOptions: {
          output: {
            // Split vendor libraries into stable, cacheable chunks so the main
            // app chunk stays small (was ~551 kB) and vendors are cached across
            // releases. App code is the only thing left in the entry chunk.
            manualChunks(id: string) {
              if (!id.includes('node_modules')) return;
              if (id.includes('/@supabase/')) return 'supabase';
              if (id.includes('/framer-motion/') || id.includes('/motion/')) return 'motion';
              if (
                id.includes('/react/') ||
                id.includes('/react-dom/') ||
                id.includes('/scheduler/') ||
                id.includes('/react-is/') ||
                id.includes('/use-sync-external-store/')
              ) return 'react-vendor';
              if (id.includes('/zustand/')) return 'state';
              if (id.includes('/sonner/')) return 'ui';
              if (id.includes('/lucide-react/')) return 'icons';
              if (id.includes('/qrcode.react/')) return 'qrcode';
              return 'vendor';
            },
          },
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./test/setup.ts'],
      }
    };
});
