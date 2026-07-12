
import { io } from "socket.io-client";
import { API_BASE_URL } from "../config/runtime";

let empresaRoomId: string | number | null = null;

export const socket = io(API_BASE_URL, {
  autoConnect: true,
  reconnection: true
});

const joinCurrentEmpresaRoom = () => {
  if (empresaRoomId && socket.connected) {
    socket.emit("join_empresa", empresaRoomId);
  }
};

socket.on("connect", () => {
  joinCurrentEmpresaRoom();
});

socket.on("reconnect", () => {
  joinCurrentEmpresaRoom();
});

socket.on("connect_error", (error) => {
  console.error("[SOCKET] Error de conexion:", error.message);
});

// Helper para suscribirse a la empresa una vez logueado
export const joinEmpresaRoom = (empresaId: string | number) => {
  if (empresaId) {
    empresaRoomId = empresaId;
    joinCurrentEmpresaRoom();
  }
};
