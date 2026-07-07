import { useState, useEffect, useCallback } from 'react';
import API from '../api/api';
import { socket } from '../utils/socket';
import { ConfigFidelizacion, PuntosCliente, PuntosSocketEvent, NivelCliente, CampaniaPuntos } from '../types';

export const usePuntos = (clienteId: string | number | null) => {
  const [configPuntos, setConfigPuntos] = useState<ConfigFidelizacion | null>(null);
  const [puntosCliente, setPuntosCliente] = useState<PuntosCliente | null>(null);
  const [niveles, setNiveles] = useState<NivelCliente[]>([]);
  const [campanias, setCampanias] = useState<CampaniaPuntos[]>([]);
  const [loadingPuntos, setLoadingPuntos] = useState(false);

  const esClienteValido = (id: string | number | null): boolean => {
    if (id === null || id === '' || id === 'null' || id === 'undefined') return false;
    const idStr = String(id).trim();
    return idStr !== '' && idStr !== '1';
  };

  // Cargar config global (una vez)
  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      try {
        const { data } = await API.get('/puntos/config');
        if (!cancelled) {
          setConfigPuntos(data.basica ?? data);
          setNiveles(data.niveles ?? []);
          setCampanias(data.campanias ?? []);
        }
      } catch {
        if (!cancelled) setConfigPuntos(null);
      }
    };
    fetch();
    return () => { cancelled = true; };
  }, []);

  const fetchPuntosCliente = useCallback(async (id: string | number) => {
    setLoadingPuntos(true);
    try {
      const { data } = await API.get<PuntosCliente>(`/puntos/cliente/${id}`);
      setPuntosCliente(data);
    } catch {
      setPuntosCliente(null);
    } finally {
      setLoadingPuntos(false);
    }
  }, []);

  useEffect(() => {
    if (!esClienteValido(clienteId)) {
      setPuntosCliente(null);
      return;
    }
    fetchPuntosCliente(clienteId!);
  }, [clienteId, fetchPuntosCliente]);

  // Socket listeners
  useEffect(() => {
    const handlePuntosActualizados = (payload: PuntosSocketEvent) => {
      if (!esClienteValido(clienteId)) return;
      if (String(payload.cliente_id) !== String(clienteId)) return;

      setPuntosCliente((prev) => {
        if (!prev) return prev;
        const nuevos = prev.puntos_acumulados + (payload.puntos_ganados || 0);
        return {
          ...prev,
          puntos_acumulados: nuevos,
        };
      });
    };

    const handlePuntosRedimidos = (payload: any) => {
      if (!esClienteValido(clienteId)) return;
      if (String(payload.cliente_id) !== String(clienteId)) return;

      setPuntosCliente((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          puntos_acumulados: payload.saldo_restante,
        };
      });
    };

    socket.on('puntos_actualizados', handlePuntosActualizados);
    socket.on('puntos_redimidos', handlePuntosRedimidos);

    return () => {
      socket.off('puntos_actualizados', handlePuntosActualizados);
      socket.off('puntos_redimidos', handlePuntosRedimidos);
    };
  }, [clienteId]);

  const refetchPuntos = useCallback(() => {
    if (esClienteValido(clienteId)) {
      fetchPuntosCliente(clienteId!);
    }
  }, [clienteId, fetchPuntosCliente]);

  return {
    configPuntos,
    puntosCliente,
    niveles,
    campanias,
    loadingPuntos,
    refetchPuntos,
  };
};
