import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'client-error-logger',
      configureServer(server) {
        server.middlewares.use('/api/log-error', (req, res) => {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            console.error('\n🔴 [BROWSER CLIENT ERROR]:', body);
            res.statusCode = 200;
            res.end('ok');
          });
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: [
      'tests/store.test.ts',
      'tests/adversarial_store.test.ts',
      'tests/adversarialPersistence.test.ts',
      'tests/requirements.test.ts',
      'tests/integration_canvas_lifecycle.test.ts',
    ],
  },
});
