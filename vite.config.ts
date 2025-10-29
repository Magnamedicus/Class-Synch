import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Prefer explicit VITE_BASE if provided; otherwise use relative base for portability on GitLab Pages
  // Using "./" avoids absolute asset paths that can 404 under project subpaths.
  const base = env.VITE_BASE || "./";
  return {
    plugins: [react()],
    base,
  };
})
