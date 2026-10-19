import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const api = process.env.VITE_API_TARGET || 'http://localhost:5001';
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': api, '/uploads': api, '/socket.io': { target: api, ws: true } } }
});
