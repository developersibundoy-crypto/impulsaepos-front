import API from "./api";

// Cuentas por Cobrar (CxC)
export const getCxC = () => API.get("/cartera/cxc");
export const createCxC = (data: any) => API.post("/cartera/cxc", data);
export const registerAbonoCxC = (id: number, data: any) => API.post(`/cartera/cxc/${id}/abono`, data);
export const getAbonosCxC = (id: number) => API.get(`/cartera/cxc/${id}/abonos`);

// Cuentas por Pagar (CxP)
export const getCxP = () => API.get("/cartera/cxp");
export const createCxP = (data: any) => API.post("/cartera/cxp", data);
export const registerAbonoCxP = (id: number, data: any) => API.post(`/cartera/cxp/${id}/abono`, data);
export const getAbonosCxP = (id: number) => API.get(`/cartera/cxp/${id}/abonos`);
export const uploadSoporteCxP = (id: number, soporte_url: string) => API.put(`/cartera/cxp/${id}/soporte`, { soporte_url });
