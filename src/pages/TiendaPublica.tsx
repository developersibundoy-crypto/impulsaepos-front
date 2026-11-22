import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from "../config/runtime";

// Cliente axios limpio para tienda pública (sin interceptores administrativos)
const publicApi = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

interface PublicStore {
  slug: string;
  nombre: string;
  descripcion: string;
  logo_url: string;
  correo_contacto: string;
  telefono_contacto: string;
  color_primario: string;
  direccion_recogida: string;
  horario_atencion: string;
  banner_url?: string;
  tagline?: string;
}

interface PublicProduct {
  producto_id: number;
  titulo: string;
  descripcion: string;
  precio_venta: string | number;
  categoria: string;
  stock: number;
  disponible: boolean | number;
  imagen_url?: string;
}

interface CartItem {
  producto: PublicProduct;
  cantidad: number;
}

interface OrderDetail {
  codigo_orden: string;
  token_seguimiento: string;
  estado: string;
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_email?: string;
  metodo_entrega: string;
  metodo_pago: string;
  subtotal: number;
  total: number;
  notas_cliente?: string;
  comprobante_url?: string;
  fecha_limite_pago?: string;
  creado_en: string;
  items: Array<{
    id: number;
    titulo_historico: string;
    precio_unitario: number;
    cantidad: number;
    subtotal: number;
  }>;
  tienda?: Partial<PublicStore>;
}

export default function TiendaPublica() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Estados de datos
  const [tienda, setTienda] = useState<PublicStore | null>(null);
  const [productos, setProductos] = useState<PublicProduct[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState<string>("todas");
  const [busqueda, setBusqueda] = useState<string>("");
  const [orden, setOrden] = useState<"destacados" | "menor_precio" | "mayor_precio" | "nombre">("destacados");
  const [vistaGrid, setVistaGrid] = useState<boolean>(true);
  const [cargando, setCargando] = useState<boolean>(true);
  const [errorTienda, setErrorTienda] = useState<{ status: number; mensaje: string } | null>(null);

  // Modal de vista previa rápida de producto
  const [quickviewProd, setQuickviewProd] = useState<PublicProduct | null>(null);
  const [quickviewCant, setQuickviewCant] = useState<number>(1);

  // Carrito de compras
  const [carrito, setCarrito] = useState<CartItem[]>(() => {
    if (!slug) return [];
    try {
      const guardado = sessionStorage.getItem(`tienda_cart_${slug}`);
      return guardado ? JSON.parse(guardado) : [];
    } catch {
      return [];
    }
  });
  const [cartDrawerOpen, setCartDrawerOpen] = useState<boolean>(false);
  const [cartBounce, setCartBounce] = useState<boolean>(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState<boolean>(false);

  // Formulario de checkout
  const [formNombre, setFormNombre] = useState<string>("");
  const [formTelefono, setFormTelefono] = useState<string>("");
  const [formEmail, setFormEmail] = useState<string>("");
  const [formMetodoPago, setFormMetodoPago] = useState<string>("transferencia_manual");
  const [formMetodoEntrega, setFormMetodoEntrega] = useState<string>("recogida");
  const [formDireccion, setFormDireccion] = useState<string>("");
  const [formNotas, setFormNotas] = useState<string>("");
  const [enviandoPedido, setEnviandoPedido] = useState<boolean>(false);
  const [errorCheckout, setErrorCheckout] = useState<string | null>(null);

  // Cupón promocional interactivo
  const [cuponInput, setCuponInput] = useState<string>("");
  const [descuentoPorcentaje, setDescuentoPorcentaje] = useState<number>(0);
  const [cuponMensaje, setCuponMensaje] = useState<string | null>(null);

  // Seguimiento de pedido
  const [pedidoActivo, setPedidoActivo] = useState<OrderDetail | null>(null);
  const [cargandoPedido, setCargandoPedido] = useState<boolean>(false);
  const [referenciaComprobante, setReferenciaComprobante] = useState<string>("");
  const [enviandoComprobante, setEnviandoComprobante] = useState<boolean>(false);
  const [comprobanteExito, setComprobanteExito] = useState<boolean>(false);
  const [copiadoLink, setCopiadoLink] = useState<boolean>(false);

  // Detectar URL de seguimiento: /tienda/:slug/pedido/:token
  const tokenMatch = location.pathname.match(/\/pedido\/([a-zA-Z0-9_-]+)/);
  const trackingToken = tokenMatch ? tokenMatch[1] : null;

  // Persistir carrito
  useEffect(() => {
    if (slug) {
      try {
        sessionStorage.setItem(`tienda_cart_${slug}`, JSON.stringify(carrito));
      } catch (e) {
        console.error(e);
      }
    }
  }, [carrito, slug]);

  // Cargar datos de la tienda
  useEffect(() => {
    if (!slug) return;
    setCargando(true);
    setErrorTienda(null);

    publicApi
      .get(`/tienda-publica/${slug}`)
      .then((res) => {
        if (res.data.ok) {
          setTienda(res.data.tienda);
        }
      })
      .catch((err) => {
        const status = err.response?.status || 500;
        const mensaje =
          err.response?.data?.mensaje ||
          (status === 404
            ? "La tienda que buscas no existe o el enlace es incorrecto."
            : "Esta tienda online se encuentra en pausa temporal.");
        setErrorTienda({ status, mensaje });
      })
      .finally(() => {
        setCargando(false);
      });
  }, [slug]);

  // Cargar productos
  useEffect(() => {
    if (!slug || errorTienda) return;

    publicApi
      .get(`/tienda-publica/${slug}/productos`)
      .then((res) => {
        if (res.data.ok) {
          setProductos(res.data.productos || []);
          setCategorias(res.data.categorias || []);
        }
      })
      .catch((err) => {
        console.error("Error al cargar productos:", err);
      });
  }, [slug, errorTienda]);

  // Cargar seguimiento de pedido
  const cargarDetallePedido = (token: string) => {
    if (!slug) return;
    setCargandoPedido(true);
    publicApi
      .get(`/tienda-publica/${slug}/pedidos/${token}`)
      .then((res) => {
        if (res.data.ok) {
          setPedidoActivo(res.data.pedido);
        }
      })
      .catch((err) => {
        console.error("Error consultando pedido:", err);
      })
      .finally(() => {
        setCargandoPedido(false);
      });
  };

  useEffect(() => {
    if (trackingToken) {
      cargarDetallePedido(trackingToken);
    }
  }, [trackingToken, slug]);

  // Manejo del Carrito
  const agregarAlCarrito = (prod: PublicProduct, cant: number = 1) => {
    setCarrito((prev) => {
      const idx = prev.findIndex((i) => i.producto.producto_id === prod.producto_id);
      if (idx >= 0) {
        const nuevaCant = Math.min(prev[idx].cantidad + cant, prod.stock);
        const copia = [...prev];
        copia[idx] = { ...copia[idx], cantidad: nuevaCant };
        return copia;
      }
      return [...prev, { producto: prod, cantidad: Math.min(cant, prod.stock) }];
    });

    setCartBounce(true);
    setTimeout(() => setCartBounce(false), 500);
  };

  const modificarCantidad = (productoId: number, delta: number) => {
    setCarrito((prev) => {
      return prev
        .map((item) => {
          if (item.producto.producto_id === productoId) {
            const nueva = item.cantidad + delta;
            return { ...item, cantidad: Math.min(Math.max(0, nueva), item.producto.stock) };
          }
          return item;
        })
        .filter((item) => item.cantidad > 0);
    });
  };

  const eliminarItem = (productoId: number) => {
    setCarrito((prev) => prev.filter((i) => i.producto.producto_id !== productoId));
  };

  const subtotalCarrito = useMemo(() => {
    return carrito.reduce((acc, item) => {
      const precio = typeof item.producto.precio_venta === "string"
        ? parseFloat(item.producto.precio_venta)
        : Number(item.producto.precio_venta);
      return acc + (precio || 0) * item.cantidad;
    }, 0);
  }, [carrito]);

  const valorDescuento = useMemo(() => {
    return (subtotalCarrito * descuentoPorcentaje) / 100;
  }, [subtotalCarrito, descuentoPorcentaje]);

  const totalCarrito = useMemo(() => {
    return Math.max(0, subtotalCarrito - valorDescuento);
  }, [subtotalCarrito, valorDescuento]);

  const totalItemsCount = useMemo(() => {
    return carrito.reduce((acc, item) => acc + item.cantidad, 0);
  }, [carrito]);

  // Progreso de envío gratis (meta: $100.000 COP)
  const metaEnvioGratis = 100000;
  const progresoEnvio = Math.min(100, Math.round((subtotalCarrito / metaEnvioGratis) * 100));
  const faltaEnvioGratis = Math.max(0, metaEnvioGratis - subtotalCarrito);

  // Aplicar cupón promocional interactivo
  const aplicarCupon = (e: React.FormEvent) => {
    e.preventDefault();
    const codigo = cuponInput.trim().toUpperCase();
    if (codigo === "IMPULSA10" || codigo === "BIENVENIDO" || codigo === "PROMO10") {
      setDescuentoPorcentaje(10);
      setCuponMensaje("✨ ¡Cupón del 10% OFF aplicado!");
    } else if (codigo === "VIP20") {
      setDescuentoPorcentaje(20);
      setCuponMensaje("💎 ¡Cupón VIP del 20% OFF aplicado!");
    } else {
      setCuponMensaje("⚠️ Cupón no válido. Prueba con 'IMPULSA10'");
    }
  };

  // Filtrado y ordenamiento de productos
  const productosFiltrados = useMemo(() => {
    let res = productos.filter((p) => {
      const catOk = categoriaActiva === "todas" || p.categoria === categoriaActiva;
      const qOk =
        !busqueda ||
        p.titulo.toLowerCase().includes(busqueda.toLowerCase()) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(busqueda.toLowerCase()));
      return catOk && qOk;
    });

    if (orden === "menor_precio") {
      res = [...res].sort((a, b) => Number(a.precio_venta) - Number(b.precio_venta));
    } else if (orden === "mayor_precio") {
      res = [...res].sort((a, b) => Number(b.precio_venta) - Number(a.precio_venta));
    } else if (orden === "nombre") {
      res = [...res].sort((a, b) => a.titulo.localeCompare(b.titulo));
    }

    return res;
  }, [productos, categoriaActiva, busqueda, orden]);

  // Checkout submit
  const enviandoRef=useRef(false);
  const handleCrearPedido = async (e: React.FormEvent) => {
    e.preventDefault();
    if(enviandoRef.current)return;
    if (!formNombre.trim() || !formTelefono.trim()) {
      setErrorCheckout("Por favor completa tu nombre y número de WhatsApp.");
      return;
    }
    if (formMetodoEntrega === "domicilio" && !formDireccion.trim()) {
      setErrorCheckout("Por favor ingresa la dirección de entrega.");
      return;
    }
    if (carrito.length === 0) {
      setErrorCheckout("Tu carrito de compras está vacío.");
      return;
    }

    enviandoRef.current=true;
    setEnviandoPedido(true);
    setErrorCheckout(null);

    try {
      const payload = {
        cliente_nombre: formNombre.trim(),
        cliente_telefono: formTelefono.trim(),
        cliente_email: formEmail.trim() || undefined,
        metodo_entrega: formMetodoEntrega,
        metodo_pago: formMetodoPago,
        notas_cliente: [
          formDireccion ? `Dirección entrega: ${formDireccion.trim()}` : "",
          formNotas.trim() ? `Notas: ${formNotas.trim()}` : "",
        ]
          .filter(Boolean)
          .join(" | ") || undefined,
        items: carrito.map((i) => ({
          producto_id: i.producto.producto_id,
          cantidad: i.cantidad,
        })).sort((a,b)=>a.producto_id-b.producto_id),
      };
      const storageKey=`tienda_checkout_${slug}`;
      const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(payload)));
      const huella=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
      const anterior=JSON.parse(sessionStorage.getItem(storageKey)||"null");
      const clave=anterior?.huella===huella?anterior.clave:crypto.randomUUID();
      sessionStorage.setItem(storageKey,JSON.stringify({huella,clave}));
      const res = await publicApi.post(`/tienda-publica/${slug}/pedidos`, {...payload,clave_idempotencia:clave});
      if (res.data.ok && res.data.pedido) {
        setCarrito([]);
        sessionStorage.removeItem(`tienda_cart_${slug}`);
        sessionStorage.removeItem(storageKey);
        setCheckoutModalOpen(false);
        setCartDrawerOpen(false);

        const token = res.data.pedido.token_seguimiento;
        navigate(`/tienda/${slug}/pedido/${token}`);
        cargarDetallePedido(token);
      }
    } catch (err: any) {
      console.error("Error creando pedido:", err);
      const msg = err.response?.data?.mensaje || "No se pudo procesar tu orden. Por favor intenta de nuevo.";
      setErrorCheckout(msg);
    } finally {
      enviandoRef.current=false;
      setEnviandoPedido(false);
    }
  };

  // Enviar comprobante
  const handleEnviarComprobante = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenciaComprobante.trim() || !pedidoActivo) return;

    setEnviandoComprobante(true);
    try {
      const res = await publicApi.post(
        `/tienda-publica/${slug}/pedidos/${pedidoActivo.token_seguimiento}/comprobante`,
        { referencia: referenciaComprobante.trim() }
      );
      if (res.data.ok) {
        setComprobanteExito(true);
        cargarDetallePedido(pedidoActivo.token_seguimiento);
      }
    } catch (err) {
      console.error("Error enviando comprobante:", err);
    } finally {
      setEnviandoComprobante(false);
    }
  };

  const formatearDinero = (monto: number | string) => {
    const num = typeof monto === "string" ? parseFloat(monto) : Number(monto);
    return new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(num || 0);
  };

  const copiarEnlaceSeguimiento = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(window.location.href);
    setCopiadoLink(true);
    setTimeout(() => setCopiadoLink(false), 2500);
  };

  // 1. Pantalla de carga tipo Studio Minimalista
  if (cargando) {
    return (
      <div className="min-h-screen bg-[#07090e] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden select-none">
        {/* Ambient Glow Orbs */}
        <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center space-y-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-indigo-500/20 via-white/5 to-white/10 border border-white/10 backdrop-blur-2xl flex items-center justify-center shadow-2xl">
              <svg className="w-9 h-9 text-indigo-400 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-[#07090e] animate-ping" />
          </div>

          <div>
            <h2 className="text-xl font-bold tracking-tight text-white/95">Conectando catálogo</h2>
            <p className="text-xs text-zinc-400 mt-1 font-mono tracking-wide">Sincronizando inventario en tiempo real...</p>
          </div>

          <div className="w-56 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="w-full h-full bg-gradient-to-r from-indigo-500 to-violet-400 origin-left animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // 2. Pantalla de tienda no disponible
  if (errorTienda || !tienda) {
    return (
      <div className="min-h-screen bg-[#07090e] text-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-zinc-900/90 backdrop-blur-2xl rounded-3xl p-8 border border-zinc-800 text-center shadow-2xl space-y-5">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center text-3xl mx-auto">
            🏬
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Comercio Fuera de Servicio</h1>
            <p className="text-zinc-400 text-xs mt-2 leading-relaxed">
              {errorTienda?.mensaje || "El comercio no se encuentra disponible al público en este momento."}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-xs tracking-wide rounded-2xl transition-all shadow-lg shadow-indigo-600/25 active:scale-95"
          >
            Reintentar Conexión
          </button>
        </div>
      </div>
    );
  }

  const primaryColor = tienda.color_primario || "#4f46e5";

  // 3. VISTA DE SEGUIMIENTO DE PEDIDO (TIPO APPLE WALLET / DIGITAL PASS)
  if (trackingToken) {
    return (
      <div className="min-h-screen bg-[#f4f5f8] text-zinc-900 font-sans selection:bg-indigo-600 selection:text-white">
        {/* Header Superior Frosted */}
        <header className="bg-white/80 backdrop-blur-xl border-b border-zinc-200/80 sticky top-0 z-40 transition-all">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <button
              onClick={() => navigate(`/tienda/${slug}`)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-colors py-2 px-3 rounded-xl hover:bg-zinc-100/80"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Volver a la tienda</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-zinc-900">{tienda.nombre}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-4 sm:p-8 space-y-6">
          {cargandoPedido ? (
            <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-zinc-200/80 space-y-3">
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
              <p className="text-xs font-semibold text-zinc-500">Sincronizando estado en vivo...</p>
            </div>
          ) : !pedidoActivo ? (
            <div className="bg-white rounded-3xl p-10 text-center shadow-sm border border-zinc-200/80 space-y-4">
              <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-2xl mx-auto">
                🔍
              </div>
              <div>
                <h2 className="text-base font-bold text-zinc-900">Pedido no localizado</h2>
                <p className="text-xs text-zinc-500 mt-1">El enlace o token de seguimiento es incorrecto o ha expirado.</p>
              </div>
              <button
                onClick={() => navigate(`/tienda/${slug}`)}
                className="px-6 py-2.5 bg-zinc-900 text-white text-xs font-semibold rounded-2xl shadow-sm hover:bg-zinc-800 transition-all"
              >
                Ir al Catálogo
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-xl shadow-zinc-200/60 border border-zinc-200/80 overflow-hidden">
              {/* Encabezado del Digital Ticket */}
              <div
                style={{ backgroundColor: primaryColor }}
                className="p-6 sm:p-8 text-white relative overflow-hidden"
              >
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-wider text-white mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Pedido Registrado</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{pedidoActivo.codigo_orden}</h1>
                    <p className="text-xs text-white/80 mt-1 font-medium">
                      Emitido: {new Date(pedidoActivo.creado_en).toLocaleString("es-CO")}
                    </p>
                  </div>
                  <div className="sm:text-right bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 block">
                      Total de la Orden
                    </span>
                    <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                      {formatearDinero(pedidoActivo.total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Cuerpo del Digital Ticket */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Stepper de 4 Fases con Animación de Pulso */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                      Línea de Tiempo del Pedido
                    </h3>
                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                      Actualizado en vivo
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div
                      className={`p-3 rounded-2xl border transition-all ${
                        ["pendiente", "comprobante_enviado", "confirmado", "preparando", "listo_recogida", "entregado"].includes(pedidoActivo.estado)
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-bold"
                          : "bg-zinc-50 border-zinc-100 text-zinc-400"
                      }`}
                    >
                      <span className="text-lg block mb-1">📝</span>
                      <span className="block font-bold text-[11px]">1. Recibido</span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border transition-all ${
                        ["confirmado", "preparando", "listo_recogida", "entregado"].includes(pedidoActivo.estado)
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-bold"
                          : pedidoActivo.estado === "comprobante_enviado"
                          ? "bg-amber-50 border-amber-300 text-amber-900 animate-pulse font-bold"
                          : "bg-zinc-50 border-zinc-100 text-zinc-400"
                      }`}
                    >
                      <span className="text-lg block mb-1">💳</span>
                      <span className="block font-bold text-[11px]">2. Pago</span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border transition-all ${
                        ["preparando", "listo_recogida", "entregado"].includes(pedidoActivo.estado)
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-bold"
                          : "bg-zinc-50 border-zinc-100 text-zinc-400"
                      }`}
                    >
                      <span className="text-lg block mb-1">📦</span>
                      <span className="block font-bold text-[11px]">3. Preparación</span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl border transition-all ${
                        pedidoActivo.estado === "listo_recogida"
                          ? "bg-indigo-50 border-indigo-400 text-indigo-900 ring-2 ring-indigo-500/20 font-bold shadow-sm"
                          : pedidoActivo.estado === "entregado"
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900 font-bold"
                          : "bg-zinc-50 border-zinc-100 text-zinc-400"
                      }`}
                    >
                      <span className="text-lg block mb-1">🎉</span>
                      <span className="block font-bold text-[11px]">4. Entrega</span>
                    </div>
                  </div>
                </div>

                {/* Instrucciones de Pago Manual */}
                {pedidoActivo.estado === "pendiente" && pedidoActivo.metodo_pago === "transferencia_manual" && (
                  <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 space-y-3">
                    <div className="flex items-center gap-2 text-amber-950 font-bold text-xs uppercase tracking-wide">
                      <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Instrucciones de Transferencia
                    </div>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Transfiere <strong>{formatearDinero(pedidoActivo.total)}</strong> a la cuenta oficial de la tienda vía Nequi, Daviplata o Bancolombia al número:
                      <br />
                      <strong className="text-sm font-black text-amber-950">{tienda.telefono_contacto || "Consultar por WhatsApp"}</strong>
                    </p>

                    {comprobanteExito ? (
                      <div className="p-3 bg-emerald-100/80 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2">
                        <span>✅</span> ¡Comprobante registrado! La tienda verificará tu pago en breve.
                      </div>
                    ) : (
                      <form onSubmit={handleEnviarComprobante} className="space-y-2 pt-1">
                        <label className="text-[11px] font-bold text-amber-950 block">
                          Ingresa la referencia o ID de transferencia:
                        </label>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <input
                            type="text"
                            required
                            placeholder="Ej: Nequi M789123"
                            value={referenciaComprobante}
                            onChange={(e) => setReferenciaComprobante(e.target.value)}
                            className="flex-1 px-4 py-2.5 text-xs bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
                          />
                          <button
                            type="submit"
                            disabled={enviandoComprobante}
                            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
                          >
                            {enviandoComprobante ? "Registrando..." : "Registrar Pago"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Acciones Rápidas: WhatsApp y Copiar Enlace */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {tienda.telefono_contacto && (
                    <button
                      onClick={() => {
                        const msj = `Hola ${tienda.nombre}, acabo de realizar la orden *${pedidoActivo.codigo_orden}* por valor de *${formatearDinero(pedidoActivo.total)}*. Mi nombre es ${pedidoActivo.cliente_nombre}.`;
                        const tel = tienda.telefono_contacto.replace(/[^0-9]/g, "");
                        const prefijo = tel.startsWith("57") ? tel : `57${tel}`;
                        window.open(`https://wa.me/${prefijo}?text=${encodeURIComponent(msj)}`, "_blank");
                      }}
                      className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.287.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.179.182-.077.357.101.174.45 1.026 1.348 1.487.625.32 1.152.42 1.314.507.162.087.256.072.352-.038.096-.11.411-.478.521-.643.11-.165.22-.138.369-.083.149.055.945.445 1.107.526.162.08.27.12.31.188.04.068.04.4-.104.805z" />
                      </svg>
                      <span>Avisar a la tienda por WhatsApp</span>
                    </button>
                  )}

                  <button
                    onClick={copiarEnlaceSeguimiento}
                    className="w-full py-3 px-4 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-bold text-xs rounded-2xl flex items-center justify-center gap-2 transition-all"
                  >
                    <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>{copiadoLink ? "✓ Enlace Copiado" : "Copiar Enlace de Rastreo"}</span>
                  </button>
                </div>

                {/* Resumen de Productos */}
                <div className="border-t border-zinc-100 pt-5 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Productos en la Orden ({pedidoActivo.items.length})
                  </h4>
                  <div className="divide-y divide-zinc-100">
                    {pedidoActivo.items.map((it) => (
                      <div key={it.id} className="py-2.5 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-zinc-900">{it.titulo_historico}</p>
                          <span className="text-zinc-400 font-medium">
                            {it.cantidad}x {formatearDinero(it.precio_unitario)}
                          </span>
                        </div>
                        <span className="font-bold text-zinc-900">{formatearDinero(it.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Datos del Cliente y Entrega */}
                <div className="border-t border-zinc-100 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-600">
                  <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold">Cliente</span>
                    <strong className="text-zinc-800 font-bold">{pedidoActivo.cliente_nombre}</strong>
                    <div className="text-zinc-500">{pedidoActivo.cliente_telefono}</div>
                  </div>
                  <div className="bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                    <span className="text-zinc-400 block text-[10px] uppercase font-bold">Modalidad Entrega</span>
                    <strong className="text-zinc-800 font-bold capitalize">
                      {pedidoActivo.metodo_entrega === "domicilio" ? "🛵 Envío a Domicilio" : "🏪 Recogida en Local"}
                    </strong>
                    <div className="text-zinc-500 truncate">
                      {tienda.direccion_recogida || "Local principal de la tienda"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
  }

  // 4. VISTA PRINCIPAL: TIENDA ONLINE DE ALTA GAMA (INSPIRACIÓN MODERNA 2026)
  return (
    <div className="min-h-screen bg-[#fafbfc] text-zinc-900 font-sans selection:bg-indigo-600 selection:text-white relative">
      
      {/* 4.1 TOPBAR FLOTANTE ULTRA CLEAN (GLASSMORPHISM DOCK) */}
      <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-2xl border-b border-zinc-200/60 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          
          {/* Brand Identity & Live Status */}
          <div className="flex items-center gap-3.5 min-w-0">
            {tienda.logo_url ? (
              <img
                src={tienda.logo_url}
                alt={tienda.nombre}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl object-cover border border-zinc-200/80 shadow-sm ring-2 ring-zinc-100"
              />
            ) : (
              <div
                style={{ backgroundColor: primaryColor }}
                className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-white font-extrabold text-sm sm:text-base shadow-md shrink-0"
              >
                {tienda.nombre.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-zinc-900 text-sm sm:text-base tracking-tight truncate">
                  {tienda.nombre}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  En vivo
                </span>
              </div>
              {tienda.direccion_recogida && (
                <p className="text-[11px] text-zinc-400 truncate flex items-center gap-1 font-medium">
                  <svg className="w-3 h-3 text-zinc-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{tienda.direccion_recogida}</span>
                </p>
              )}
            </div>
          </div>

          {/* Actions: Direct WhatsApp + Bag Launcher */}
          <div className="flex items-center gap-2 sm:gap-3">
            {tienda.telefono_contacto && (
              <button
                onClick={() => {
                  const tel = tienda.telefono_contacto.replace(/[^0-9]/g, "");
                  const prefijo = tel.startsWith("57") ? tel : `57${tel}`;
                  window.open(
                    `https://wa.me/${prefijo}?text=${encodeURIComponent(`Hola ${tienda.nombre}, tengo una pregunta sobre los productos de su tienda en línea.`)}`,
                    "_blank"
                  );
                }}
                className="hidden md:inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white rounded-2xl border border-emerald-200/80 text-xs font-bold transition-all shadow-sm active:scale-95"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.287.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.179.182-.077.357.101.174.45 1.026 1.348 1.487.625.32 1.152.42 1.314.507.162.087.256.072.352-.038.096-.11.411-.478.521-.643.11-.165.22-.138.369-.083.149.055.945.445 1.107.526.162.08.27.12.31.188.04.068.04.4-.104.805z" />
                </svg>
                <span>WhatsApp</span>
              </button>
            )}

            {/* Shopping Cart Button with Spring Feedback */}
            <button
              onClick={() => setCartDrawerOpen(true)}
              style={{ backgroundColor: primaryColor }}
              className={`px-4 sm:px-5 py-2.5 sm:py-3 text-white rounded-2xl font-bold text-xs flex items-center gap-2.5 shadow-lg shadow-indigo-600/20 hover:brightness-110 active:scale-95 transition-all duration-200 ${
                cartBounce ? "scale-105 ring-4 ring-indigo-500/20" : ""
              }`}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span className="hidden sm:inline font-bold">Carrito</span>
              <span className="bg-white text-zinc-950 text-[11px] font-black min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center shadow-sm">
                {totalItemsCount}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* 4.2 HERO SHOWCASE EDITORIAL - FULL WIDTH (100% ANCHO DE PANTALLA) */}
      <section
        className="relative w-full overflow-hidden shadow-2xl min-h-[340px] sm:min-h-[460px] flex flex-col justify-end text-white border-b border-zinc-200/60"
        style={{
          backgroundImage: tienda.banner_url ? `url(${tienda.banner_url})` : undefined,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundColor: !tienda.banner_url ? "#090d16" : undefined,
        }}
      >
        {/* Vignette Overlay & Ambient Light Mesh */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/75 to-zinc-900/40" />

        {!tienda.banner_url && (
          <div
            style={{
              backgroundImage: `radial-gradient(circle at 85% 20%, ${primaryColor}70 0%, transparent 60%)`,
            }}
            className="absolute inset-0 pointer-events-none"
          />
        )}

        {/* Contenido alineado con el contenedor maestro de la tienda */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-4">
          {/* Tagline / Curated Collection Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 backdrop-blur-xl rounded-full text-[11px] font-bold uppercase tracking-wider text-amber-300 border border-white/15 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>{tienda.tagline || "Catálogo Digital Exclusivo • Entrega Rápida"}</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight text-white drop-shadow-md max-w-3xl">
            {tienda.nombre}
          </h2>

          <p className="text-zinc-200 text-xs sm:text-base leading-relaxed max-w-2xl font-medium drop-shadow">
            {tienda.descripcion || "Productos seleccionados con disponibilidad inmediata en inventario y recogida directa o despacho a tu ubicación."}
          </p>

          {/* Value Proposition Micro-Chips */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 text-[11px] font-bold text-zinc-200">
            <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10">
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>Stock Garantizado</span>
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10">
              <svg className="w-3.5 h-3.5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Despacho Inmediato</span>
            </span>
            <span className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10">
              <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span>Nequi / Bancolombia / Efectivo</span>
            </span>
          </div>
        </div>
      </section>

      {/* 4.3 FLOATING CONTROL CENTER (CATEGORÍAS + BUSCADOR + VISTA) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 sticky top-16 sm:top-20 z-30">
        <div className="bg-white/90 backdrop-blur-2xl border border-zinc-200/80 rounded-3xl p-2.5 sm:p-3 shadow-lg shadow-zinc-200/40 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          
          {/* Segmented Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 sm:pb-0 px-1">
            <button
              onClick={() => setCategoriaActiva("todas")}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all duration-200 whitespace-nowrap active:scale-95 ${
                categoriaActiva === "todas"
                  ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/15"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80"
              }`}
            >
              Todos ({productos.length})
            </button>
            {categorias.map((cat) => {
              const cant = productos.filter((p) => p.categoria === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoriaActiva(cat)}
                  className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all duration-200 whitespace-nowrap active:scale-95 ${
                    categoriaActiva === cat
                      ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/15"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80"
                  }`}
                >
                  {cat} ({cant})
                </button>
              );
            })}
          </div>

          {/* Search Bar + Sort Dropdown + Grid Switcher */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-60">
              <input
                type="text"
                placeholder="Buscar productos..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-zinc-100 border border-zinc-200/80 rounded-2xl text-xs font-semibold text-zinc-900 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
              <svg className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {busqueda && (
                <button
                  onClick={() => setBusqueda("")}
                  className="absolute right-3 top-2 text-zinc-400 hover:text-zinc-600 font-bold text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Select */}
            <select
              value={orden}
              onChange={(e) => setOrden(e.target.value as any)}
              className="px-3 py-2 bg-zinc-100 border border-zinc-200/80 rounded-2xl text-xs font-bold text-zinc-700 outline-none cursor-pointer hover:bg-zinc-200/80"
            >
              <option value="destacados">Destacados</option>
              <option value="menor_precio">Menor Precio</option>
              <option value="mayor_precio">Mayor Precio</option>
              <option value="nombre">A-Z</option>
            </select>

            {/* Layout Toggle Button */}
            <button
              onClick={() => setVistaGrid(!vistaGrid)}
              className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-2xl text-xs font-bold text-zinc-600 transition-colors"
              title="Cambiar formato de vista"
            >
              {vistaGrid ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* 4.4 PRODUCT SHOWCASE (BENTO GRID 2026) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-28 sm:py-8">
        {productosFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-zinc-200/80 shadow-sm max-w-md mx-auto space-y-4">
            <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center text-2xl mx-auto">
              🔍
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">Sin coincidencias</h3>
              <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                No se encontraron artículos para &quot;{busqueda}&quot; en la categoría seleccionada.
              </p>
            </div>
            <button
              onClick={() => {
                setBusqueda("");
                setCategoriaActiva("todas");
              }}
              className="px-5 py-2.5 bg-zinc-900 text-white text-xs font-semibold rounded-2xl shadow-sm hover:bg-zinc-800 transition-all"
            >
              Explorar Catálogo Completo
            </button>
          </div>
        ) : (
          <div
            className={
              vistaGrid
                ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
                : "grid grid-cols-1 gap-3 max-w-4xl mx-auto"
            }
          >
            {productosFiltrados.map((prod) => {
              const precioNum = typeof prod.precio_venta === "string" ? parseFloat(prod.precio_venta) : Number(prod.precio_venta);
              const agotado = !prod.disponible || prod.stock <= 0;
              const enCarrito = carrito.find((i) => i.producto.producto_id === prod.producto_id);

              return (
                <div
                  key={prod.producto_id}
                  className={`bg-white rounded-3xl border border-zinc-200/80 p-3 sm:p-4 flex flex-col justify-between hover:shadow-xl hover:border-zinc-300 hover:-translate-y-1 transition-all duration-300 group ${
                    !vistaGrid ? "sm:flex-row sm:items-center gap-4" : ""
                  }`}
                >
                  <div className={!vistaGrid ? "flex items-center gap-4 min-w-0 flex-1" : ""}>
                    {/* Media Container with Frosted Overlays */}
                    <div
                      className={`aspect-square rounded-2xl bg-zinc-100 overflow-hidden relative flex items-center justify-center shrink-0 cursor-pointer ${
                        vistaGrid ? "w-full mb-3" : "w-20 h-20"
                      }`}
                      onClick={() => {
                        setQuickviewProd(prod);
                        setQuickviewCant(1);
                      }}
                    >
                      {prod.imagen_url ? (
                        <img
                          src={prod.imagen_url}
                          alt={prod.titulo}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                        />
                      ) : (
                        <div
                          style={{
                            background: `linear-gradient(135deg, ${primaryColor}12, ${primaryColor}24)`,
                          }}
                          className="w-full h-full flex flex-col items-center justify-center text-zinc-400 group-hover:scale-105 transition-transform duration-500"
                        >
                          <svg className="w-12 h-12 opacity-30 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                          </svg>
                        </div>
                      )}

                      {/* Stock Pill */}
                      {agotado ? (
                        <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 bg-rose-600 text-white font-bold text-[9px] rounded-lg uppercase tracking-wider shadow">
                          Agotado
                        </span>
                      ) : prod.stock <= 3 ? (
                        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-amber-500 text-white font-bold text-[9px] rounded-lg tracking-wider shadow flex items-center gap-1">
                          ⚡ {prod.stock} un.
                        </span>
                      ) : (
                        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-white/90 backdrop-blur-md text-emerald-800 border border-emerald-200 font-bold text-[9px] rounded-lg tracking-wider shadow-sm flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          {prod.stock} disp.
                        </span>
                      )}

                      {/* Floating QuickView Trigger */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setQuickviewProd(prod);
                          setQuickviewCant(1);
                        }}
                        className="absolute bottom-2.5 right-2.5 w-8 h-8 rounded-xl bg-white/90 backdrop-blur-md text-zinc-800 hover:bg-white flex items-center justify-center text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                        title="Ver detalle"
                      >
                        <svg className="w-4 h-4 text-zinc-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                    </div>

                    {/* Metadata */}
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block mb-0.5">
                        {prod.categoria || "Colección"}
                      </span>
                      <h3
                        onClick={() => {
                          setQuickviewProd(prod);
                          setQuickviewCant(1);
                        }}
                        className="font-bold text-zinc-900 text-xs sm:text-sm line-clamp-2 leading-snug cursor-pointer hover:text-indigo-600 transition-colors mb-1"
                      >
                        {prod.titulo}
                      </h3>
                      {prod.descripcion && (
                        <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed mb-2 font-medium">
                          {prod.descripcion}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Price & Micro-Stepper Action */}
                  <div
                    className={`pt-2.5 border-t border-zinc-100 flex items-center justify-between gap-2 ${
                      !vistaGrid ? "sm:border-t-0 sm:pt-0 sm:w-60" : ""
                    }`}
                  >
                    <div>
                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider block">Precio</span>
                      <span className="font-extrabold text-zinc-900 text-sm sm:text-base">
                        {formatearDinero(precioNum)}
                      </span>
                    </div>

                    {enCarrito ? (
                      <div className="flex items-center border border-zinc-200 rounded-xl bg-zinc-50 overflow-hidden shadow-sm">
                        <button
                          onClick={() => modificarCantidad(prod.producto_id, -1)}
                          className="px-2.5 py-1 text-zinc-700 hover:bg-zinc-200 font-bold text-xs active:scale-95 transition-all"
                        >
                          -
                        </button>
                        <span className="px-2 font-bold text-xs text-zinc-900">{enCarrito.cantidad}</span>
                        <button
                          onClick={() => modificarCantidad(prod.producto_id, 1)}
                          disabled={enCarrito.cantidad >= prod.stock}
                          className="px-2.5 py-1 text-zinc-700 hover:bg-zinc-200 font-bold text-xs active:scale-95 transition-all disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        disabled={agotado}
                        onClick={() => agregarAlCarrito(prod, 1)}
                        style={{ backgroundColor: agotado ? "#e4e4e7" : primaryColor }}
                        className="px-3.5 py-1.5 text-white font-bold text-xs rounded-xl shadow-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-1"
                      >
                        <span>+</span>
                        <span>Agregar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4.5 EDITORIAL QUICKVIEW STUDIO MODAL */}
      {quickviewProd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="max-w-2xl w-full bg-white rounded-3xl shadow-2xl border border-zinc-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="grid grid-cols-1 md:grid-cols-2">
              
              {/* Product Gallery Showcase */}
              <div className="bg-zinc-100 aspect-square md:aspect-auto flex items-center justify-center relative overflow-hidden">
                {quickviewProd.imagen_url ? (
                  <img
                    src={quickviewProd.imagen_url}
                    alt={quickviewProd.titulo}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <svg className="w-20 h-20 text-zinc-400 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                )}
                <span className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-bold uppercase text-indigo-700 border border-zinc-200">
                  {quickviewProd.categoria || "Original"}
                </span>
              </div>

              {/* Product Details & Actions */}
              <div className="p-6 sm:p-8 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-extrabold text-zinc-900 text-lg sm:text-xl leading-snug">
                      {quickviewProd.titulo}
                    </h3>
                    <button
                      onClick={() => setQuickviewProd(null)}
                      className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 font-bold text-xs flex items-center justify-center shrink-0"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-xs text-zinc-500 leading-relaxed max-h-36 overflow-y-auto mb-4 font-medium">
                    {quickviewProd.descripcion || "Artículo original verificado con garantía y respaldo directo de la tienda."}
                  </p>

                  <div className="flex items-center justify-between py-3 border-y border-zinc-100">
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Precio Unitario</span>
                      <span className="text-2xl font-extrabold text-zinc-900">
                        {formatearDinero(quickviewProd.precio_venta)}
                      </span>
                    </div>
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs rounded-full">
                      ✓ {quickviewProd.stock} disponibles
                    </span>
                  </div>
                </div>

                {/* Micro Actions */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-zinc-200 rounded-2xl bg-zinc-50 overflow-hidden">
                      <button
                        onClick={() => setQuickviewCant((c) => Math.max(1, c - 1))}
                        className="px-3.5 py-2 text-zinc-700 hover:bg-zinc-200 font-bold text-sm"
                      >
                        -
                      </button>
                      <span className="px-3.5 font-bold text-sm text-zinc-900">{quickviewCant}</span>
                      <button
                        onClick={() => setQuickviewCant((c) => Math.min(quickviewProd.stock, c + 1))}
                        className="px-3.5 py-2 text-zinc-700 hover:bg-zinc-200 font-bold text-sm"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() => {
                        agregarAlCarrito(quickviewProd, quickviewCant);
                        setQuickviewProd(null);
                      }}
                      style={{ backgroundColor: primaryColor }}
                      className="flex-1 py-3 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
                    >
                      Agregar al Carrito ({formatearDinero(Number(quickviewProd.precio_venta) * quickviewCant)})
                    </button>
                  </div>

                  {tienda.telefono_contacto && (
                    <button
                      onClick={() => {
                        const tel = tienda.telefono_contacto.replace(/[^0-9]/g, "");
                        const prefijo = tel.startsWith("57") ? tel : `57${tel}`;
                        window.open(
                          `https://wa.me/${prefijo}?text=${encodeURIComponent(`Hola, me interesa el producto "${quickviewProd.titulo}" que vi en su tienda online.`)}`,
                          "_blank"
                        );
                      }}
                      className="w-full py-2.5 text-center text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.299.144.347.491 1.2.534 1.287.043.087.072.188.014.303-.058.116-.087.188-.173.289l-.26.303c-.087.087-.179.182-.077.357.101.174.45 1.026 1.348 1.487.625.32 1.152.42 1.314.507.162.087.256.072.352-.038.096-.11.411-.478.521-.643.11-.165.22-.138.369-.083.149.055.945.445 1.107.526.162.08.27.12.31.188.04.068.04.4-.104.805z" />
                      </svg>
                      <span>Preguntar por WhatsApp</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4.6 SLIDE-OVER CART DRAWER CON MEDIDOR DE ENVÍO */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-300">
            
            {/* Header del Carrito */}
            <div className="p-5 sm:p-6 border-b border-zinc-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-zinc-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3 className="font-extrabold text-zinc-900 text-base">Carrito de Compras ({totalItemsCount})</h3>
              </div>
              <button
                onClick={() => setCartDrawerOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Barra de Progreso Envío Preferencial */}
            <div className="bg-zinc-50 px-5 sm:px-6 py-3 border-b border-zinc-100 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-700">
                  {faltaEnvioGratis === 0 ? "🎉 ¡Alcanzaste el Envío Gratis!" : `Faltan ${formatearDinero(faltaEnvioGratis)} para envío preferencial`}
                </span>
                <span className="text-[10px] font-extrabold text-indigo-600">{progresoEnvio}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progresoEnvio}%`, backgroundColor: primaryColor }}
                  className="h-full rounded-full transition-all duration-500"
                />
              </div>
            </div>

            {/* Lista de Items */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 divide-y divide-zinc-100">
              {carrito.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-400 space-y-3">
                  <div className="w-16 h-16 bg-zinc-100 rounded-3xl flex items-center justify-center text-3xl">
                    🛒
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-800 text-sm">Tu carrito está vacío</h4>
                    <p className="text-xs text-zinc-400 mt-1">Explora los productos para añadirlos a tu pedido.</p>
                  </div>
                </div>
              ) : (
                carrito.map((item) => {
                  const precio = typeof item.producto.precio_venta === "string"
                    ? parseFloat(item.producto.precio_venta)
                    : Number(item.producto.precio_venta);
                  const sub = precio * item.cantidad;

                  return (
                    <div key={item.producto.producto_id} className="py-4 flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-zinc-900 text-xs truncate">{item.producto.titulo}</h4>
                        <span className="text-[11px] text-zinc-400 font-medium">
                          {formatearDinero(precio)} c/u
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center border border-zinc-200 rounded-xl bg-zinc-50 overflow-hidden">
                          <button
                            onClick={() => modificarCantidad(item.producto.producto_id, -1)}
                            className="px-2.5 py-1 text-zinc-700 hover:bg-zinc-200 font-bold text-xs"
                          >
                            -
                          </button>
                          <span className="px-2 text-xs font-bold text-zinc-900">{item.cantidad}</span>
                          <button
                            onClick={() => modificarCantidad(item.producto.producto_id, 1)}
                            disabled={item.cantidad >= item.producto.stock}
                            className="px-2.5 py-1 text-zinc-700 hover:bg-zinc-200 font-bold text-xs disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>

                        <span className="font-bold text-zinc-900 text-xs w-20 text-right">
                          {formatearDinero(sub)}
                        </span>

                        <button
                          onClick={() => eliminarItem(item.producto.producto_id)}
                          className="text-zinc-300 hover:text-rose-600 text-xs p-1"
                          title="Quitar"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Subtotal, Cupón y Botón Checkout */}
            {carrito.length > 0 && (
              <div className="p-5 sm:p-6 border-t border-zinc-100 bg-zinc-50/70 space-y-3.5">
                {/* Promo Code Form */}
                <form onSubmit={aplicarCupon} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Cupón (ej. IMPULSA10)"
                    value={cuponInput}
                    onChange={(e) => setCuponInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white border border-zinc-200 rounded-xl outline-none font-bold uppercase"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-zinc-800"
                  >
                    Aplicar
                  </button>
                </form>
                {cuponMensaje && (
                  <p className="text-[11px] font-bold text-indigo-600">{cuponMensaje}</p>
                )}

                {/* Totals Breakdown */}
                <div className="space-y-1.5 text-xs text-zinc-600 pt-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-bold">{formatearDinero(subtotalCarrito)}</span>
                  </div>
                  {descuentoPorcentaje > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Descuento ({descuentoPorcentaje}%):</span>
                      <span>-{formatearDinero(valorDescuento)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center border-t border-zinc-200 pt-2.5 text-zinc-900 font-extrabold text-base">
                    <span>Total a Pagar:</span>
                    <span className="text-xl text-indigo-600">{formatearDinero(totalCarrito)}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setCartDrawerOpen(false);
                    setCheckoutModalOpen(true);
                  }}
                  style={{ backgroundColor: primaryColor }}
                  className="w-full py-3.5 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  <span>Continuar al Pago Seguro</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4.7 MODAL DE CHECKOUT EN 2 PASOS */}
      {checkoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-zinc-200 space-y-5 animate-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
            
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 block">
                  Paso Final
                </span>
                <h3 className="font-extrabold text-zinc-900 text-lg">Confirmar Tu Pedido</h3>
              </div>
              <button
                onClick={() => setCheckoutModalOpen(false)}
                className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 font-bold text-xs flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {errorCheckout && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-2xl font-bold flex items-center gap-2">
                <span>⚠️</span>
                <span>{errorCheckout}</span>
              </div>
            )}

            <form onSubmit={handleCrearPedido} className="space-y-4">
              {/* Sección 1: Tus Datos */}
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Martínez"
                  value={formNombre}
                  onChange={(e) => setFormNombre(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-zinc-700 block mb-1">WhatsApp / Celular *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ej: 310 987 6543"
                    value={formTelefono}
                    onChange={(e) => setFormTelefono(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-zinc-700 block mb-1">Correo (Opcional)</label>
                  <input
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Sección 2: Modalidad de Entrega */}
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">Modalidad de Entrega</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFormMetodoEntrega("recogida")}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      formMetodoEntrega === "recogida"
                        ? "bg-indigo-50 border-indigo-400 text-indigo-900 ring-2 ring-indigo-500/20 shadow-sm"
                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    <span className="block font-bold">🏪 En Tienda ($0)</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5 block truncate">
                      {tienda.direccion_recogida || "Recoges en local"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormMetodoEntrega("domicilio")}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      formMetodoEntrega === "domicilio"
                        ? "bg-indigo-50 border-indigo-400 text-indigo-900 ring-2 ring-indigo-500/20 shadow-sm"
                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    <span className="block font-bold">🛵 A Domicilio</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">A tu dirección</span>
                  </button>
                </div>
              </div>

              {formMetodoEntrega === "domicilio" && (
                <div>
                  <label className="text-xs font-bold text-zinc-700 block mb-1">Dirección de Entrega *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Carrera 15 # 45 - 28, Apto 302"
                    value={formDireccion}
                    onChange={(e) => setFormDireccion(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

              {/* Sección 3: Forma de Pago */}
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">Forma de Pago</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setFormMetodoPago("transferencia_manual")}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      formMetodoPago === "transferencia_manual"
                        ? "bg-indigo-50 border-indigo-400 text-indigo-900 ring-2 ring-indigo-500/20 shadow-sm"
                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    <span className="block font-bold">💳 Transferencia</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">Nequi / Bancolombia</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormMetodoPago("efectivo_recogida")}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      formMetodoPago === "efectivo_recogida"
                        ? "bg-indigo-50 border-indigo-400 text-indigo-900 ring-2 ring-indigo-500/20 shadow-sm"
                        : "bg-zinc-50 border-zinc-200 text-zinc-600 hover:bg-zinc-100"
                    }`}
                  >
                    <span className="block font-bold">💵 Contraentrega</span>
                    <span className="text-[10px] text-zinc-400 mt-0.5 block">Pagas al recibir</span>
                  </button>
                </div>
              </div>

              {/* Indicaciones / Notas */}
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">Notas para la Tienda</label>
                <textarea
                  rows={2}
                  placeholder="Ej: Timbre 302, retirar a las 4:00 PM..."
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  className="w-full px-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Resumen Total y Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={enviandoPedido}
                  style={{ backgroundColor: primaryColor }}
                  className="w-full py-3.5 text-white font-bold text-xs uppercase tracking-wider rounded-2xl shadow-lg hover:brightness-110 active:scale-98 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {enviandoPedido ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Procesando...</span>
                    </>
                  ) : (
                    <span>Confirmar Orden ({formatearDinero(totalCarrito)})</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4.8 BOTÓN FLOTANTE DEL CARRITO EN MÓVIL (RAPPI / SHOPIFY STYLE) */}
      {totalItemsCount > 0 && !cartDrawerOpen && !checkoutModalOpen && (
        <aside aria-label="Resumen flotante del carrito" className="fixed bottom-4 inset-x-4 z-40 sm:hidden animate-in slide-in-from-bottom-5 duration-300">
          <button
            onClick={() => setCartDrawerOpen(true)}
            style={{ backgroundColor: primaryColor }}
            className="w-full py-3.5 px-5 text-white rounded-2xl font-bold text-sm shadow-[0_12px_30px_rgba(0,0,0,0.35)] flex items-center justify-between active:scale-98 transition-all ring-2 ring-white/20"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-white text-zinc-950 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-sm">
                {totalItemsCount}
              </span>
              <span className="font-extrabold text-xs uppercase tracking-wide">Ver Carrito</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm">{formatearDinero(totalCarrito)}</span>
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        </aside>
      )}
    </div>
  );
}
