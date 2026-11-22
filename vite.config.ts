import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    proxy: {
      '^/(tienda-admin|tienda-publica|auth|empresa|productos|cajeros|clientes|proveedores|ventas|borradores|reportes|backup|compras|dashboard|pagos|ai|separados|suscripciones|kardex|whatsapp|dian|facturacion-electronica|caja|cartera|documentos-soporte|puntos|sorteo)': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return '/index.html';
          }
        },
      },
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      src: '/src',
    },
  },
});
