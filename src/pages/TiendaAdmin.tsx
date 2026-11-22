import React, { useState, useEffect } from "react";
import API from "../api/api";
import { formatCOP } from "../utils/format";
import { socket } from "../utils/socket";
import { hasAccess } from "../utils/auth";

interface Tienda {
  id: number;
  empresa_id: number;
  slug: string;
  nombre: string;
  descripcion: string | null;
  logo_url: string | null;
  correo_contacto: string | null;
  telefono_contacto: string | null;
  color_primario?: string | null;
  direccion_recogida?: string | null;
  horario_atencion?: string | null;
  estado: "borrador" | "publicada" | "pausada";
  productos_publicados: number;
}

interface Contrato {
  id: number;
  desde: string;
  vence_en: string;
  estado: string;
  origen: string;
  dias_restantes: number;
}

interface Producto {
  id: number;
  referencia: string;
  nombre: string;
  categoria: string;
  precio_venta: number;
  cantidad: number;
  publicacion_id: number | null;
  publicado: number | boolean | null;
  titulo_publico: string | null;
  descripcion_publica: string | null;
  orden: number | null;
}

interface PedidoItem {
  id: number;
  pedido_id: number;
  producto_id: number;
  titulo_historico: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
}

interface PedidoWeb {
  id: number;
  empresa_id: number;
  tienda_id: number;
  codigo_orden: string;
  token_seguimiento: string;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_email: string | null;
  metodo_entrega: string;
  metodo_pago: string;
  estado: "pendiente" | "comprobante_enviado" | "confirmado" | "preparando" | "listo_recogida" | "entregado" | "cancelado";
  subtotal: number;
  total: number;
  notas_cliente: string | null;
  comprobante_url: string | null;
  fecha_limite_pago: string | null;
  creado_en: string;
  items?: PedidoItem[];
}

export default function TiendaAdmin() {
  // Solo oculta opciones; el backend es quien autoriza cada operación.
  const puedeAdministrar = hasAccess("tienda_admin");
  const [activeTab, setActiveTab] = useState<"config" | "productos" | "pagos" | "pedidos" | "preview">(puedeAdministrar ? "config" : "pedidos");
  const [tienda, setTienda] = useState<Tienda | null>(null);
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [vigente, setVigente] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);

  // Wompi Pasarela state
  const [wompiActivo, setWompiActivo] = useState(false);
  const [wompiAmbiente, setWompiAmbiente] = useState<"sandbox" | "produccion">("sandbox");
  const [wompiPublicKey, setWompiPublicKey] = useState("");
  const [wompiIntegritySecret, setWompiIntegritySecret] = useState("");
  const [wompiEventSecret, setWompiEventSecret] = useState("");
  const [wompiIntegrityEnmascarado, setWompiIntegrityEnmascarado] = useState("");
  const [wompiEventEnmascarado, setWompiEventEnmascarado] = useState("");
  const [tieneIntegritySecret, setTieneIntegritySecret] = useState(false);
  const [tieneEventSecret, setTieneEventSecret] = useState(false);
  const [wompiWebhookUrl, setWompiWebhookUrl] = useState("");
  const [savingWompi, setSavingWompi] = useState(false);
  const [copiadoWebhook, setCopiadoWebhook] = useState(false);

  // Form states - Identidad y Configuración
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
  const [colorPrimario, setColorPrimario] = useState("#4f46e5");
  const [direccionRecogida, setDireccionRecogida] = useState("");
  const [horarioAtencion, setHorarioAtencion] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [tagline, setTagline] = useState("");

  // Products state
  const [productos, setProductos] = useState<Producto[]>([]);
  const [searchProd, setSearchProd] = useState("");
  const [soloPublicados, setSoloPublicados] = useState(false);
  const [loadingProds, setLoadingProds] = useState(false);

  // Modal editing public product info
  const [editingProd, setEditingProd] = useState<Producto | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Orders state (Bandeja de Pedidos)
  const [pedidos, setPedidos] = useState<PedidoWeb[]>([]);
  const [contadoresPedidos, setContadoresPedidos] = useState<Record<string, number>>({});
  const [filtroEstadoPedido, setFiltroEstadoPedido] = useState<string>("");
  const [busquedaPedido, setBusquedaPedido] = useState<string>("");
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [pedidoDetalle, setPedidoDetalle] = useState<PedidoWeb | null>(null);

  const cargarPagosConfig = async () => {
    if (!puedeAdministrar) return;
    try {
      const { data } = await API.get("/tienda-admin/mi-tienda/pagos-config");
      setWompiActivo(Boolean(data.activo));
      setWompiAmbiente(data.ambiente || "sandbox");
      setWompiPublicKey(data.public_key || "");
      setWompiIntegrityEnmascarado(data.integrity_secret_enmascarado || "");
      setWompiEventEnmascarado(data.event_secret_enmascarado || "");
      setTieneIntegritySecret(Boolean(data.tiene_integrity_secret));
      setTieneEventSecret(Boolean(data.tiene_event_secret));
      setWompiWebhookUrl(data.webhook_url || "");
    } catch (e) {
      console.error("Error cargando configuración de pagos:", e);
    }
  };

  const cargarTienda = async () => {
    try {
      setLoading(true);
      const { data } = await API.get("/tienda-admin/mi-tienda");
      if (data.tienda) {
        setTienda(data.tienda);
        setNombre(data.tienda.nombre || "");
        setSlug(data.tienda.slug || "");
        setDescripcion(data.tienda.descripcion || "");
        setLogoUrl(data.tienda.logo_url || "");
        setCorreo(data.tienda.correo_contacto || "");
        setTelefono(data.tienda.telefono_contacto || "");
        setColorPrimario(data.tienda.color_primario || "#4f46e5");
        setDireccionRecogida(data.tienda.direccion_recogida || "");
        setHorarioAtencion(data.tienda.horario_atencion || "");
        setBannerUrl(data.tienda.banner_url || "");
        setTagline(data.tienda.tagline || "");
      }
      setContrato(data.contrato);
      setVigente(Boolean(data.vigente));
      await cargarPagosConfig();
    } catch (err: any) {
      setMsg({ tipo: "error", texto: err.response?.data?.error || "Error al cargar la tienda." });
    } finally {
      setLoading(false);
    }
  };

  const cargarProductos = async () => {
    try {
      setLoadingProds(true);
      const params: any = {};
      if (searchProd) params.q = searchProd;
      if (soloPublicados) params.publicados = "1";
      const { data } = await API.get("/tienda-admin/productos", { params });
      setProductos(data.productos || []);
    } catch (err: any) {
      console.error("Error cargando productos:", err);
    } finally {
      setLoadingProds(false);
    }
  };

  const cargarPedidos = async () => {
    try {
      setLoadingPedidos(true);
      const params: any = {};
      if (filtroEstadoPedido) params.estado = filtroEstadoPedido;
      if (busquedaPedido) params.q = busquedaPedido;
      const { data } = await API.get("/tienda-admin/pedidos", { params });
      if (data.ok) {
        setPedidos(data.pedidos || []);
        setContadoresPedidos(data.contadores || {});
      }
    } catch (err) {
      console.error("Error consultando pedidos:", err);
    } finally {
      setLoadingPedidos(false);
    }
  };

  useEffect(() => {
    cargarTienda();
  }, []);

  useEffect(() => {
    if (activeTab === "productos" || activeTab === "preview") {
      cargarProductos();
    }
    if (activeTab === "pedidos") {
      cargarPedidos();
    }
  }, [activeTab, searchProd, soloPublicados, filtroEstadoPedido, busquedaPedido]);

  // Suscripción a eventos en tiempo real vía Socket.IO
  useEffect(() => {
    const handleNuevoPedido = (data: any) => {
      cargarPedidos();
      // Alerta de nuevo pedido
      try {
        const audio = new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3");
        audio.play().catch(() => {});
      } catch (e) {}
      alert(`🔔 ¡NUEVO PEDIDO WEB RECIBIDO!\n\nCódigo: ${data.codigo_orden}\nCliente: ${data.cliente_nombre}\nTotal: ${formatCOP(data.total)}`);
    };

    const handleActualizacion = () => {
      cargarPedidos();
    };

    socket.on("nuevo_pedido_tienda", handleNuevoPedido);
    socket.on("comprobante_pedido_tienda", handleActualizacion);
    socket.on("pedido_estado_actualizado", handleActualizacion);

    return () => {
      socket.off("nuevo_pedido_tienda", handleNuevoPedido);
      socket.off("comprobante_pedido_tienda", handleActualizacion);
      socket.off("pedido_estado_actualizado", handleActualizacion);
    };
  }, []);

  const handleGuardarConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const { data } = await API.put("/tienda-admin/mi-tienda", {
        nombre,
        slug,
        descripcion,
        logo_url: logoUrl,
        correo_contacto: correo,
        telefono_contacto: telefono,
        color_primario: colorPrimario,
        direccion_recogida: direccionRecogida,
        horario_atencion: horarioAtencion,
        banner_url: bannerUrl,
        tagline: tagline,
      });
      setMsg({ tipo: "success", texto: data.message });
      setSlug(data.slug);
      await cargarTienda();
    } catch (err: any) {
      setMsg({ tipo: "error", texto: err.response?.data?.error || "Error al guardar configuración." });
    } finally {
      setSaving(false);
    }
  };

  const handleGuardarWompi = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingWompi(true);
    setMsg(null);
    try {
      const payload = {
        activo: wompiActivo,
        ambiente: wompiAmbiente,
        public_key: wompiPublicKey.trim(),
        integrity_secret: wompiIntegritySecret.trim() || undefined,
        event_secret: wompiEventSecret.trim() || undefined
      };
      const { data } = await API.put("/tienda-admin/mi-tienda/pagos-config", payload);
      setMsg({ tipo: "success", texto: data.message || "Configuración de Wompi guardada con éxito." });
      setWompiIntegritySecret("");
      setWompiEventSecret("");
      await cargarPagosConfig();
    } catch (err: any) {
      setMsg({ tipo: "error", texto: err.response?.data?.error || "Error al guardar la configuración de Wompi." });
    } finally {
      setSavingWompi(false);
    }
  };

  const copiarWebhook = () => {
    if (!wompiWebhookUrl) return;
    navigator.clipboard.writeText(wompiWebhookUrl);
    setCopiadoWebhook(true);
    setTimeout(() => setCopiadoWebhook(false), 2500);
  };

  const handleCambiarEstado = async (nuevoEstado: "publicada" | "pausada" | "borrador") => {
    setMsg(null);
    try {
      const { data } = await API.post("/tienda-admin/mi-tienda/estado", { nuevo_estado: nuevoEstado });
      setMsg({ tipo: "success", texto: data.message });
      await cargarTienda();
    } catch (err: any) {
      setMsg({ tipo: "error", texto: err.response?.data?.error || "Error al cambiar estado." });
    }
  };

  const handleActivarPrueba = async () => {
    if (!window.confirm("¿Deseas activar los 14 días de prueba gratuita para tu Tienda en Línea?")) return;
    try {
      const { data } = await API.post("/tienda-admin/mi-tienda/activar-prueba");
      setMsg({ tipo: "success", texto: data.message });
      await cargarTienda();
    } catch (err: any) {
      setMsg({ tipo: "error", texto: err.response?.data?.error || "No se pudo activar la prueba." });
    }
  };

  const handleToggleProducto = async (productoId: number, publicar: boolean) => {
    try {
      await API.post("/tienda-admin/publicaciones/toggle", { producto_id: productoId, publicar });
      setProductos((prev) =>
        prev.map((p) => (p.id === productoId ? { ...p, publicado: publicar ? 1 : 0 } : p))
      );
      if (tienda) {
        setTienda({
          ...tienda,
          productos_publicados: tienda.productos_publicados + (publicar ? 1 : -1),
        });
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Error al actualizar producto.");
    }
  };

  const handleGuardarEdicionProd = async () => {
    if (!editingProd) return;
    try {
      await API.put(`/tienda-admin/publicaciones/${editingProd.id}`, {
        titulo: editTitulo,
        descripcion_publica: editDesc,
      });
      setProductos((prev) =>
        prev.map((p) =>
          p.id === editingProd.id
            ? { ...p, titulo_publico: editTitulo, descripcion_publica: editDesc }
            : p
        )
      );
      setEditingProd(null);
    } catch (err: any) {
      alert(err.response?.data?.error || "Error al guardar detalles.");
    }
  };

  const cambiarEstadoPedido = async (pedidoId: number, nuevoEstado: string) => {
    if (
      nuevoEstado === "cancelado" &&
      !window.confirm(
        "¿Seguro que deseas cancelar este pedido? Las unidades reservadas regresarán automáticamente a tu inventario de productos."
      )
    ) {
      return;
    }

    try {
      const res = await API.put(`/tienda-admin/pedidos/${pedidoId}/estado`, { nuevo_estado: nuevoEstado });
      if (res.data.success) {
        cargarPedidos();
        if (pedidoDetalle && pedidoDetalle.id === pedidoId) {
          setPedidoDetalle({ ...pedidoDetalle, estado: nuevoEstado as any });
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.error || "Error al actualizar estado del pedido.");
    }
  };

  const copiarEnlace = () => {
    if (!tienda?.slug) return;
    const url = `${window.location.origin}/tienda/${tienda.slug}`;
    navigator.clipboard.writeText(url);
    alert(`Enlace copiado al portapapeles:\n${url}`);
  };

  const pedidosNuevosOpendientes =
    (contadoresPedidos.pendientes || 0) + (contadoresPedidos.comprobante_enviado || 0);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-500 font-bold">
        <div className="animate-spin mr-3 text-2xl">⏳</div> Cargando administración de tienda...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-16 font-sans">
      {/* Header */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🌐</span>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Impulsa Tienda Online</h1>
            <span
              className={`px-3 py-1 text-xs font-black uppercase rounded-full tracking-wider ${
                tienda?.estado === "publicada"
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-300"
                  : tienda?.estado === "pausada"
                  ? "bg-amber-100 text-amber-700 border border-amber-300"
                  : "bg-slate-100 text-slate-600 border border-slate-300"
              }`}
            >
              ● {tienda?.estado || "Borrador"}
            </span>
          </div>
          <p className="text-slate-500 text-sm max-w-2xl">
            Gestiona tu catálogo digital en línea, recibe pedidos web en tiempo real y comparte tu enlace público oficial con tus clientes.
          </p>
        </div>

        {/* Acciones principales del Header */}
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {tienda?.slug && (
            <button
              onClick={copiarEnlace}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-300 transition-all"
              title="Copiar enlace público"
            >
              📋 Copiar Enlace
            </button>
          )}

          {puedeAdministrar && (tienda?.estado === "publicada" ? (
            <button
              onClick={() => handleCambiarEstado("pausada")}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-all shadow-md"
            >
              ⏸️ Pausar Tienda
            </button>
          ) : (
            <button
              onClick={() => handleCambiarEstado("publicada")}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl uppercase tracking-wider transition-all shadow-md flex items-center gap-2"
            >
              🚀 Publicar Tienda
            </button>
          ))}
        </div>
      </div>

      {/* Banner de Estado del Complemento (Prueba o Contrato) */}
      {!vigente ? (
        <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-indigo-950 p-6 sm:p-8 rounded-3xl shadow-xl border border-indigo-700/50 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest bg-amber-400 text-indigo-950 px-2.5 py-0.5 rounded-full">
              Complemento E-Commerce
            </span>
            <h3 className="text-xl font-black tracking-tight">Activa tu catálogo online para recibir pedidos</h3>
            <p className="text-indigo-200 text-sm max-w-xl">
              Disfruta de 14 días completamente gratis para probar tu tienda en línea integrada con tu inventario sin costo adicional.
            </p>
          </div>
          {puedeAdministrar && (
            <button
              onClick={handleActivarPrueba}
              className="px-6 py-3 bg-amber-400 hover:bg-amber-300 text-indigo-950 font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg transition-transform hover:scale-105"
            >
              🎁 Activar 14 Días Gratis
            </button>
          )}
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <span className="text-lg">✅</span>
            <span>
              <strong>Complemento Activo</strong> ({contrato?.origen === "prueba" ? "Prueba Gratuita" : "Suscripción"}). Vence en:{" "}
              <strong>{contrato?.vence_en}</strong> ({contrato?.dias_restantes} días restantes).
            </span>
          </div>
          <span className="font-bold text-emerald-700">1 Tienda Habilitada</span>
        </div>
      )}

      {/* Mensajes de Alerta */}
      {msg && (
        <div
          className={`p-4 rounded-2xl text-sm font-bold flex items-center justify-between ${
            msg.tipo === "success"
              ? "bg-emerald-50 border border-emerald-300 text-emerald-800"
              : "bg-red-50 border border-red-300 text-red-800"
          }`}
        >
          <span>{msg.texto}</span>
          <button onClick={() => setMsg(null)} className="text-lg font-black leading-none">
            &times;
          </button>
        </div>
      )}

      {/* Navegación por Pestañas */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto scrollbar-none">
        {puedeAdministrar && (
          <button
            onClick={() => setActiveTab("config")}
            className={`px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "config"
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            ⚙️ 1. Identidad & Enlace
          </button>
        )}
        {puedeAdministrar && (
          <button
            onClick={() => setActiveTab("productos")}
            className={`px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "productos"
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            📦 2. Catálogo Publicable ({tienda?.productos_publicados || 0})
          </button>
        )}
        {puedeAdministrar && (
          <button
            onClick={() => setActiveTab("pagos")}
            className={`px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "pagos"
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <span>💳 3. Pasarela Wompi</span>
            {wompiActivo ? (
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full text-[10px] font-black">
                ACTIVO
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-[10px] font-bold">
                Inactivo
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab("pedidos")}
          className={`px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
            activeTab === "pedidos"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span>📑 4. Pedidos Web</span>
          {pedidosNuevosOpendientes > 0 && (
            <span className="px-2 py-0.5 bg-rose-600 text-white rounded-full text-[10px] font-black animate-pulse">
              {pedidosNuevosOpendientes}
            </span>
          )}
        </button>
        {puedeAdministrar && (
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-5 py-3 text-xs sm:text-sm font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              activeTab === "preview"
                ? "border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            👁️ 5. Vista Previa Tienda
          </button>
        )}
      </div>

      {/* TAB 1: Configuración de Identidad y Logística */}
      {activeTab === "config" && (
        <form onSubmit={handleGuardarConfig} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">Nombre Público del Comercio</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Calzado Don Carlos"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Enlace Único Oficial (Slug)
              </label>
              <div className="flex items-center">
                <span className="px-3 py-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-xl text-slate-500 text-xs font-bold">
                  /tienda/
                </span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="calzado-don-carlos"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-r-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Descripción / Slogan de la Tienda
              </label>
              <textarea
                rows={3}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Describe los productos que ofreces, envíos locales, promociones o trayectoria..."
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Teléfono / WhatsApp de Contacto
              </label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="Ej: 3101234567"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Correo Electrónico Público
              </label>
              <input
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                placeholder="contacto@mitienda.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Dirección para Recogida en Tienda
              </label>
              <input
                type="text"
                value={direccionRecogida}
                onChange={(e) => setDireccionRecogida(e.target.value)}
                placeholder="Ej: Carrera 5 # 10-20, Centro"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Color de Marca de tu Tienda
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={colorPrimario}
                  onChange={(e) => setColorPrimario(e.target.value)}
                  className="w-12 h-11 p-1 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer"
                />
                <input
                  type="text"
                  value={colorPrimario}
                  onChange={(e) => setColorPrimario(e.target.value)}
                  className="w-32 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm font-mono"
                />
              </div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                🖼️ Imagen de Banner Promocional (Hero Banner)
              </label>
              <input
                type="url"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://ejemplo.com/banner-tienda.jpg (Recomendado: 1200x400 px)"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                Esta imagen se mostrará en la cabecera principal de tu tienda en línea. Si la dejas vacía, se usará un degradado elegante con tu color de marca.
              </p>
              {bannerUrl && (
                <div className="mt-2 w-full h-32 rounded-2xl overflow-hidden border border-slate-200 relative">
                  <img
                    src={bannerUrl}
                    alt="Vista previa del banner"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&q=80";
                    }}
                  />
                  <span className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
                    Vista Previa del Banner
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                Frase Promocional o Anuncio del Banner (Tagline)
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Ej: 🔥 ¡Envíos gratis por compras superiores a $50.000! • Atención inmediata"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg disabled:opacity-50"
            >
              {saving ? "Guardando..." : "💾 Guardar Información"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: Catálogo de Productos */}
      {activeTab === "productos" && (
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative w-full sm:w-96">
              <input
                type="text"
                placeholder="Buscar por nombre o referencia..."
                value={searchProd}
                onChange={(e) => setSearchProd(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute left-3.5 top-3 text-slate-400 text-xs">🔍</span>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={soloPublicados}
                onChange={(e) => setSoloPublicados(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
              />
              Mostrar únicamente productos publicados
            </label>
          </div>

          {loadingProds ? (
            <div className="text-center py-12 text-slate-400 font-bold text-xs">Cargando inventario...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Producto</th>
                    <th className="py-3 px-4">Categoría</th>
                    <th className="py-3 px-4">Precio Venta</th>
                    <th className="py-3 px-4 text-center">Stock POS</th>
                    <th className="py-3 px-4 text-center">En Tienda Web</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {productos.map((p) => {
                    const isPub = Boolean(p.publicado);
                    return (
                      <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          <div>{p.nombre}</div>
                          {p.titulo_publico && (
                            <span className="text-[10px] text-indigo-600 font-normal">
                              Web: {p.titulo_publico}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{p.categoria || "Sin categoría"}</td>
                        <td className="py-3 px-4 font-black text-slate-900">{formatCOP(p.precio_venta)}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              p.cantidad > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                            }`}
                          >
                            {p.cantidad} unid.
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleToggleProducto(p.id, !isPub)}
                            className={`px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider transition-all ${
                              isPub
                                ? "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                            }`}
                          >
                            {isPub ? "Visible" : "Oculto"}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setEditingProd(p);
                              setEditTitulo(p.titulo_publico || p.nombre);
                              setEditDesc(p.descripcion_publica || "");
                            }}
                            className="text-indigo-600 hover:text-indigo-800 font-bold text-xs"
                          >
                            ✏️ Editar Ficha
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PASARELA DE PAGOS WOMPI */}
      {activeTab === "pagos" && (
        <form onSubmit={handleGuardarWompi} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 space-y-8">
          {/* Header informativo */}
          <div className="border-b border-slate-100 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">💳</span>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Pasarela de Pagos Wompi</h3>
                <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-full tracking-wider bg-violet-100 text-violet-700 border border-violet-200">
                  PSE • Tarjetas • Nequi • Bancolombia
                </span>
              </div>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 max-w-2xl">
                Conecta tu propia cuenta de Wompi para que el dinero de las ventas de tu tienda en línea ingrese <strong>directamente a tu cuenta bancaria</strong>.
              </p>
            </div>
            <a
              href="https://comercios.wompi.co"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-2 border border-slate-300 transition-all"
            >
              🔗 Ir a mi Panel Wompi
            </a>
          </div>

          {/* Toggle Activar e Indicador */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-black text-slate-900 block">
                  Habilitar pagos en línea con Wompi
                </label>
                <span className="text-xs text-slate-500">
                  Permite a tus clientes pagar directamente desde el checkout web.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setWompiActivo(!wompiActivo)}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  wompiActivo ? "bg-emerald-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    wompiActivo ? "translate-x-7" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                Ambiente de la Pasarela
              </label>
              <select
                value={wompiAmbiente}
                onChange={(e) => setWompiAmbiente(e.target.value as "sandbox" | "produccion")}
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="sandbox">🧪 Modo Pruebas (Sandbox)</option>
                <option value="produccion">🚀 Modo Producción (Cobros Reales)</option>
              </select>
            </div>
          </div>

          {/* Credenciales Wompi */}
          <div className="space-y-6">
            <div className="border-l-4 border-indigo-600 pl-4 py-1">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Llaves API de tu comercio en Wompi
              </h4>
              <p className="text-xs text-slate-500">
                Encuéntralas en <strong>comercios.wompi.co</strong> &gt; <strong>Desarrolladores</strong> &gt; <strong>Llaves de API</strong>.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Llave Pública */}
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex justify-between items-center">
                  <span>Llave Pública (Public Key)</span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {wompiAmbiente === "sandbox" ? "Inicia con: pub_test_..." : "Inicia con: pub_prod_..."}
                  </span>
                </label>
                <input
                  type="text"
                  value={wompiPublicKey}
                  onChange={(e) => setWompiPublicKey(e.target.value)}
                  placeholder={wompiAmbiente === "sandbox" ? "pub_test_Q5yDA9..." : "pub_prod_K4mJ2..."}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                />
              </div>

              {/* Secreto de Integridad */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex justify-between items-center">
                  <span>Secreto de Integridad (Integrity Secret)</span>
                  {tieneIntegritySecret && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      ✓ Configurado ({wompiIntegrityEnmascarado})
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={wompiIntegritySecret}
                  onChange={(e) => setWompiIntegritySecret(e.target.value)}
                  placeholder={tieneIntegritySecret ? "Dejar vacío para no cambiar" : (wompiAmbiente === "sandbox" ? "test_integrity_..." : "prod_integrity_...")}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block">
                  Blindaje obligatorio: se usa en backend para garantizar que nadie altere precios.
                </span>
              </div>

              {/* Secreto de Eventos */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex justify-between items-center">
                  <span>Secreto de Eventos (Event Secret)</span>
                  {tieneEventSecret && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      ✓ Configurado ({wompiEventEnmascarado})
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={wompiEventSecret}
                  onChange={(e) => setWompiEventSecret(e.target.value)}
                  placeholder={tieneEventSecret ? "Dejar vacío para no cambiar" : (wompiAmbiente === "sandbox" ? "test_events_..." : "prod_events_...")}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span className="text-[10px] text-slate-400 block">
                  Se usa para validar que las notificaciones de pago aprobado vengan auténticamente de Wompi.
                </span>
              </div>
            </div>
          </div>

          {/* Caja para copiar URL de Webhook */}
          <div className="bg-indigo-50/60 p-6 rounded-2xl border border-indigo-100 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950">
                Paso Importante: Registra tu URL de Eventos (Webhook) en Wompi
              </h4>
            </div>
            <p className="text-xs text-indigo-800">
              Para que el sistema sepa en automático cuando un cliente pagó con éxito y confirme el pedido, copia este enlace y pégalo en tu panel de Wompi (<strong>Desarrolladores &gt; Eventos &gt; URL de Eventos</strong>):
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={wompiWebhookUrl}
                className="w-full px-4 py-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-mono font-bold text-indigo-900 select-all"
              />
              <button
                type="button"
                onClick={copiarWebhook}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all whitespace-nowrap shadow-sm"
              >
                {copiadoWebhook ? "✓ ¡Copiado!" : "📋 Copiar URL"}
              </button>
            </div>
          </div>

          {/* Botón de Guardado */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={savingWompi}
              className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg disabled:opacity-50"
            >
              {savingWompi ? "Guardando Pasarela..." : "💾 Guardar Configuración Wompi"}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: BANDEJA DE PEDIDOS EN LÍNEA */}
      {activeTab === "pedidos" && (
        <div className="space-y-6">
          {/* Métricas / Badges de Estados */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
            <button
              onClick={() => setFiltroEstadoPedido("")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                filtroEstadoPedido === ""
                  ? "bg-slate-900 text-white border-slate-900 shadow-md"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Todos</span>
              <span className="text-xl font-black">{pedidos.length}</span>
            </button>

            <button
              onClick={() => setFiltroEstadoPedido("pendiente")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                filtroEstadoPedido === "pendiente"
                  ? "bg-amber-500 text-white border-amber-500 shadow-md"
                  : "bg-white text-amber-700 border-amber-200 hover:bg-amber-50"
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Pendientes</span>
              <span className="text-xl font-black">{contadoresPedidos.pendientes || 0}</span>
            </button>

            <button
              onClick={() => setFiltroEstadoPedido("comprobante_enviado")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                filtroEstadoPedido === "comprobante_enviado"
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                  : "bg-white text-indigo-700 border-indigo-200 hover:bg-indigo-50"
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Por Verificar</span>
              <span className="text-xl font-black">{contadoresPedidos.comprobante_enviado || 0}</span>
            </button>

            <button
              onClick={() => setFiltroEstadoPedido("confirmado")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                filtroEstadoPedido === "confirmado"
                  ? "bg-sky-600 text-white border-sky-600 shadow-md"
                  : "bg-white text-sky-700 border-sky-200 hover:bg-sky-50"
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Confirmados</span>
              <span className="text-xl font-black">{contadoresPedidos.confirmados || 0}</span>
            </button>

            <button
              onClick={() => setFiltroEstadoPedido("listo_recogida")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                filtroEstadoPedido === "listo_recogida"
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
                  : "bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50"
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Listos Entrega</span>
              <span className="text-xl font-black">{contadoresPedidos.listo_recogida || 0}</span>
            </button>

            <button
              onClick={() => setFiltroEstadoPedido("entregado")}
              className={`p-4 rounded-2xl border text-left transition-all ${
                filtroEstadoPedido === "entregado"
                  ? "bg-slate-700 text-white border-slate-700 shadow-md"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Entregados</span>
              <span className="text-xl font-black">{contadoresPedidos.entregados || 0}</span>
            </button>
          </div>

          {/* Buscador de pedidos */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Buscar por código, cliente o teléfono..."
                value={busquedaPedido}
                onChange={(e) => setBusquedaPedido(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="absolute left-3 top-2.5 text-xs text-slate-400">🔍</span>
            </div>
            <button
              onClick={cargarPedidos}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              🔄 Actualizar
            </button>
          </div>

          {/* Lista de Pedidos */}
          {loadingPedidos ? (
            <div className="text-center py-12 text-slate-400 font-bold text-xs bg-white rounded-3xl border border-slate-200">
              Cargando pedidos...
            </div>
          ) : pedidos.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200">
              <span className="text-4xl block mb-2">📥</span>
              <h3 className="text-base font-black text-slate-800 mb-1">No hay pedidos registrados</h3>
              <p className="text-xs text-slate-400">
                Cuando los compradores realicen órdenes desde tu tienda web, aparecerán aquí automáticamente.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {pedidos.map((ped) => {
                const telLimpio = ped.cliente_telefono.replace(/[^0-9]/g, "");
                const prefijo = telLimpio.startsWith("57") ? telLimpio : `57${telLimpio}`;
                const waUrl = `https://wa.me/${prefijo}?text=${encodeURIComponent(
                  `Hola ${ped.cliente_nombre}, te escribimos de ${tienda?.nombre} respecto a tu pedido ${ped.codigo_orden}.`
                )}`;

                return (
                  <div
                    key={ped.id}
                    className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-base">{ped.codigo_orden}</span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              ped.estado === "pendiente"
                                ? "bg-amber-100 text-amber-800"
                                : ped.estado === "comprobante_enviado"
                                ? "bg-indigo-100 text-indigo-800 animate-pulse"
                                : ped.estado === "confirmado"
                                ? "bg-sky-100 text-sky-800"
                                : ped.estado === "preparando"
                                ? "bg-purple-100 text-purple-800"
                                : ped.estado === "listo_recogida"
                                ? "bg-emerald-100 text-emerald-800 ring-2 ring-emerald-500"
                                : ped.estado === "entregado"
                                ? "bg-slate-100 text-slate-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            ● {ped.estado.replace("_", " ")}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {new Date(ped.creado_en).toLocaleString("es-CO")}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
                            Total
                          </span>
                          <span className="text-lg font-black text-indigo-600">{formatCOP(ped.total)}</span>
                        </div>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1 border border-emerald-200"
                        >
                          <span>💬</span> WhatsApp
                        </a>
                      </div>
                    </div>

                    {/* Cliente e Información de Pago */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Cliente</span>
                        <span className="font-bold text-slate-800">{ped.cliente_nombre}</span>
                        <p className="text-slate-500">{ped.cliente_telefono}</p>
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Método Pago</span>
                        <span className="font-bold text-slate-800">
                          {ped.metodo_pago === "transferencia_manual" ? "💳 Transferencia" : "💵 Efectivo Recogida"}
                        </span>
                        {ped.comprobante_url && (
                          <p className="text-[11px] text-indigo-600 font-bold truncate">
                            Ref: {ped.comprobante_url}
                          </p>
                        )}
                      </div>

                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Entrega</span>
                        <span className="font-bold text-slate-800">Recogida en Tienda</span>
                        {ped.notas_cliente && (
                          <p className="text-[11px] text-slate-500 italic truncate">
                            Nota: &quot;{ped.notas_cliente}&quot;
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Resumen de Artículos */}
                    {ped.items && ped.items.length > 0 && (
                      <div className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Productos solicitados ({ped.items.length})
                        </span>
                        <div className="divide-y divide-slate-100">
                          {ped.items.map((it) => (
                            <div key={it.id} className="py-1 flex justify-between text-slate-700">
                              <span>
                                {it.cantidad}x <strong>{it.titulo_historico}</strong>
                              </span>
                              <span className="font-bold">{formatCOP(it.subtotal)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Barra de Acciones de Estado */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Cambiar Estado del Pedido:
                      </span>

                      <div className="flex flex-wrap gap-2">
                        {puedeAdministrar && ped.estado === "pendiente" && (
                          <button
                            onClick={() => cambiarEstadoPedido(ped.id, "confirmado")}
                            className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black transition-all"
                          >
                            ✓ Confirmar Pago
                          </button>
                        )}

                        {puedeAdministrar && ped.estado === "comprobante_enviado" && (
                          <button
                            onClick={() => cambiarEstadoPedido(ped.id, "confirmado")}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow"
                          >
                            ✓ Validar Comprobante
                          </button>
                        )}

                        {["confirmado", "preparando"].includes(ped.estado) && (
                          <button
                            onClick={() => cambiarEstadoPedido(ped.id, "listo_recogida")}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow"
                          >
                            🎉 Marcar Listo para Recoger
                          </button>
                        )}

                        {ped.estado === "listo_recogida" && (
                          <button
                            onClick={() => cambiarEstadoPedido(ped.id, "entregado")}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow"
                          >
                            🤝 Marcar Entregado
                          </button>
                        )}

                        {puedeAdministrar && ped.estado !== "cancelado" && ped.estado !== "entregado" && (
                          <button
                            onClick={() => cambiarEstadoPedido(ped.id, "cancelado")}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-xl text-xs font-black transition-all border border-rose-200"
                          >
                            ✕ Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Vista Previa en Vivo */}
      {activeTab === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900 text-white p-4 rounded-2xl">
            <span className="text-xs font-bold text-slate-300">
              Vista previa interactiva — Los compradores verán tu tienda así:
            </span>
            <button
              onClick={() => window.open(`/tienda/${tienda?.slug}`, "_blank")}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs rounded-xl"
            >
              Abrir en nueva pestaña ↗
            </button>
          </div>

          <div className="bg-slate-200 p-4 sm:p-8 rounded-3xl flex justify-center">
            <div className="w-full max-w-sm sm:max-w-md bg-white rounded-3xl shadow-2xl border border-slate-300 overflow-hidden flex flex-col h-[650px]">
              {/* Header mockup */}
              <div
                style={{ backgroundColor: colorPrimario || "#4f46e5" }}
                className="p-5 text-white flex items-center justify-between"
              >
                <div>
                  <h4 className="font-black text-base">{nombre || "Mi Tienda"}</h4>
                  <p className="text-[10px] text-white/80">{telefono || "WhatsApp Disponible"}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-sm font-black">
                  🛒
                </div>
              </div>

              {/* Contenido mockup */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
                  <p className="text-xs text-slate-600 font-medium">
                    {descripcion || "Bienvenido a nuestro catálogo digital. Pide online y recoge en tienda."}
                  </p>
                </div>

                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Catálogo Publicado
                  </span>
                  {productos
                    .filter((p) => p.publicado)
                    .slice(0, 5)
                    .map((p) => (
                      <div
                        key={p.id}
                        className="p-3 bg-white border border-slate-100 rounded-2xl shadow-sm flex items-center justify-between"
                      >
                        <div>
                          <p className="font-bold text-xs text-slate-900">{p.titulo_publico || p.nombre}</p>
                          <span className="text-[10px] text-indigo-600 font-black">
                            {formatCOP(p.precio_venta)}
                          </span>
                        </div>
                        <button
                          style={{ backgroundColor: colorPrimario || "#4f46e5" }}
                          className="px-2.5 py-1 text-white text-[10px] font-black rounded-lg shadow-sm"
                        >
                          + Agregar
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Editar Descripción Pública de Producto */}
      {editingProd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
            <h3 className="text-lg font-black text-slate-900">Personalizar Producto para la Tienda Web</h3>
            <p className="text-xs text-slate-500">
              Puedes ajustar el nombre visible o añadir una descripción comercial atractiva para los compradores en línea.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-black uppercase text-slate-700">Título Público</label>
                <input
                  type="text"
                  value={editTitulo}
                  onChange={(e) => setEditTitulo(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-700">Descripción Comercial</label>
                <textarea
                  rows={3}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  placeholder="Detalles sobre materiales, uso, garantía, etc..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={() => setEditingProd(null)}
                className="px-5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarEdicionProd}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl uppercase tracking-wider"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
