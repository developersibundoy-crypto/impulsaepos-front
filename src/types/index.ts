export interface Producto {
  id?: number;
  referencia: string;
  nombre: string;
  categoria: string;
  cantidad: number;
  precio_compra: number;
  porcentaje_ganancia: number;
  precio_venta: number;
  es_servicio?: boolean;
  permitir_venta_negativa?: boolean;
  iva_porcentaje?: string | number;
  fecha_vencimiento?: string;
  descripcion?: string;
}

export interface Cajero {
  id: number;
  nombre: string;
  identificacion: string;
}

export interface Cliente {
  id: number;
  nombre: string;
  identificacion: string;
  telefono?: string;
  direccion?: string;
  puntos_acumulados?: number;
}

export interface Proveedor {
  id: number;
  nit: string;
  nombre_comercial: string;
  razon_social?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
}

export interface FacturaVenta {
  id: number;
  fecha: string;
  total: number;
  iva?: number;
  metodo_pago: string;
  pago_efectivo?: number;
  pago_transferencia?: number;
  cajero: string;
  cliente: string;
  cliente_id?: number;
  telefono?: string;
  estado?: string;
  tipo_factura?: string;
  prefijo?: string;
  consecutivo?: number;
}

export interface Borrador {
  id: number;
  fecha: string;
  proveedor: string;
  numero_factura: string;
  detalles: ProductoIngresado[];
}

export interface ProductoIngresado extends Producto {
  id_lote?: string;
  inyectado?: boolean;
  cantidad_inyectada?: number;
  configChanged?: boolean;
}

export interface CartItem extends Producto {
  qty: number;
}

// ─── FIDELIZACIÓN (NUEVA ARQUITECTURA FINANCIERA) ───────────────────────────────

export interface ConfigFidelizacion {
  id?: number;
  empresa_id: number;
  activo: boolean;
  porcentaje_acumulacion: number;
  porcentaje_redencion_max: number;
  vigencia_dias: number;
  monto_minimo_acumular: number;
  monto_minimo_redimir: number;
  valor_punto: number;
  modo_acumulacion: "porcentaje" | "cada_x";
  puntos_por_cada: number;
  monto_para_cada: number;
}

export interface NivelCliente {
  id?: number;
  nombre: string;
  nivel: number;
  porcentaje_acumulacion: number;
  porcentaje_redencion_max: number;
  vigencia_dias: number;
  monto_minimo_acumular: number;
  monto_minimo_redimir: number;
  multiplicador_base: number;
  activo: boolean;
}

export interface CampaniaPuntos {
  id?: number;
  nombre: string;
  tipo: "multiplicador" | "puntos_fijos" | "descuento";
  multiplicador: number;
  puntos_fijos_por_cada: number | null;
  monto_para_puntos_fijos: number | null;
  nivel_cliente_id: number | null;
  producto_id: number | null;
  categoria: string | null;
  marca: string | null;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

export interface PuntosInfo {
  puntosAntes: number;
  puntosGanados: number;
  puntosDespues: number;
  meta: number;
  premio: string;
  gano_premio: boolean;
  descuento_puntos?: number;
  puntos_redimidos?: number;
}

export interface PuntosCliente {
  cliente: {
    id: number;
    nombre: string;
    telefono?: string;
    correo?: string;
  };
  puntos_acumulados: number;
  nivel: NivelCliente | null;
  lotes: LotePuntos[];
  puntos_proximo_vencer: number;
  puntos_vencidos: number;
  movimientos_recientes: MovimientoPuntos[];
  config: {
    basica: ConfigFidelizacion;
    niveles: NivelCliente[];
    tieneNiveles: boolean;
    tieneCampanias: boolean;
  };
}

export interface LotePuntos {
  id: number;
  empresa_id: number;
  cliente_id: number;
  factura_id: number | null;
  factura_tipo: string;
  puntos_generados: number;
  puntos_disponibles: number;
  fecha_generacion: string;
  fecha_vencimiento: string;
  estado: "ACTIVO" | "EXPIRADO" | "CANCELADO";
  proximo_a_vencer?: boolean;
}

export interface MovimientoPuntos {
  id: number;
  empresa_id: number;
  cliente_id: number;
  cliente_nombre?: string;
  lote_id: number | null;
  tipo_movimiento: "GENERACION" | "REDENCION" | "EXPIRACION" | "AJUSTE" | "BONIFICACION" | "CANCELACION" | "REVERSION";
  puntos: number;
  saldo_anterior: number;
  saldo_posterior: number;
  referencia_id: number | null;
  referencia_tipo: string | null;
  descripcion: string | null;
  cajero_id: number | null;
  fecha: string;
}

export interface PuntosSocketEvent {
  cliente_id: number;
  puntos: number;
  puntos_ganados?: number;
  campania_id?: number | null;
}

export interface PuntosRedimidosEvent {
  cliente_id: number;
  puntos_redimidos: number;
  descuento: number;
  saldo_restante: number;
}
