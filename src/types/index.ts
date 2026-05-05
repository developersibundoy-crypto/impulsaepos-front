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
}

export interface CartItem extends Producto {
  qty: number;
}
