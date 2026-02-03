
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
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve('.'),
        }
      },
      build: {
        // Tăng giới hạn cảnh báo lên 2000kB (2MB) để không báo vàng nữa
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
          output: {
            // Chia nhỏ các thư viện lớn thành các file riêng để tải nhanh hơn
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                  return 'vendor-react';
                }
                if (id.includes('recharts')) {
                  return 'vendor-charts';
                }
                if (id.includes('lucide-react')) {
                  return 'vendor-icons';
                }
                if (id.includes('@supabase')) {
                  return 'vendor-supabase';
                }
                // Các thư viện còn lại gom vào vendor chung
                return 'vendor';
              }
            }
          }
        }
      }
    };
});
