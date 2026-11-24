import { io } from "socket.io-client";
import { API_BASE_URL } from "../config/runtime";

let empresaRoomId: string | number | null = null;

export const socket = io(new URL(API_BASE_URL || "/", window.location.origin).origin, {
  autoConnect: false,
  reconnection: true,
  auth: (cb) => {
    const token = localStorage.getItem("adminToken") || "";
    cb({ token });
  }
});

const joinCurrentEmpresaRoom = () => {
  if (empresaRoomId && socket.connected) {
    socket.emit("join_empresa", empresaRoomId);
  }
};

socket.on("connect", () => {
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

// Solo se monta en el área privada del POS, nunca en login ni en la tienda pública.
export function iniciarSocketPOS() {
  let tokenActivo: string | null = null;
  const sincronizar = () => {
    const token = localStorage.getItem("adminToken");
    if (token !== tokenActivo) {
      if (tokenActivo) socket.disconnect();
      tokenActivo = token;
      if (token) socket.connect();
    }
  };
  sincronizar();
  window.addEventListener("storage", sincronizar);
  return () => {
    window.removeEventListener("storage", sincronizar);
    empresaRoomId = null;
    socket.disconnect();
  };
}
