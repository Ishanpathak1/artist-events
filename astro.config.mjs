// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import tailwind from '@astrojs/tailwind';
import { loadEnv } from 'vite';

// Load environment variables
const env = loadEnv('', process.cwd(), '');

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel({
    webAnalytics: {
      enabled: true
    }
  }),
  integrations: [tailwind()],
  vite: {
    define: {
      'process.env.NEON_DATABASE_URL': JSON.stringify(env.NEON_DATABASE_URL),
      'process.env.DATABASE_URL': JSON.stringify(env.DATABASE_URL),
      'process.env.RESEND_API_KEY': JSON.stringify(env.RESEND_API_KEY),
      'process.env.JWT_SECRET': JSON.stringify(env.JWT_SECRET)
    }
  }
});
