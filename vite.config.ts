import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const base = env.VITE_BASE || env.PROJECT_BASE || (env.CI ? "/class-synch/" : "/");
  return {
    plugins: [react()],
    base,
  };
})
