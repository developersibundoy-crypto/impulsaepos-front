
import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  reconnection: true
});

// Helper para suscribirse a la empresa una vez logueado
export const joinEmpresaRoom = (empresaId: string | number) => {
  if (empresaId) {
    socket.emit("join_empresa", empresaId);
  }
};
