import { useEffect, useState } from "react";
import { API_BASE_URL } from "../config/runtime";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import { Carrito, Comprobante, Gestion, leerCarrito, persistir, Item } from "./tiendaPiloto/Compra";
import Seleccion from "./tiendaPiloto/Seleccion";

type Producto = {id:number; nombre:string; referencia:string|null; categoria:string; precio_venta:string; cantidad:number; disponible:number};
type Catalogo = {productos:Producto[]; total:number; pagina:number; paginas:number};
const cop = new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0});

export default function TiendaPiloto() {
  const [cart,setCart]=useState(leerCarrito);
  function cambiar(items:Item[]){const next=persistir(items);setCart(next);}
  return <Routes><Route index element={<CatalogoPiloto items={cart.items} cambiar={cambiar}/>}/>
    <Route path="carrito" element={<Carrito cart={cart} cambiar={cambiar}/>}/>
    <Route path="pedido/:ref" element={<Comprobante/>}/><Route path="gestion" element={<Gestion/>}/>
    <Route path="gestion/productos" element={<Seleccion key="editar"/>}/><Route path="gestion/previa" element={<Seleccion key="previa" previa/>}/>
    <Route path="*" element={<Link to="/tienda-piloto">Volver al catálogo</Link>}/></Routes>;
}
function CatalogoPiloto({items,cambiar}:{items:Item[];cambiar:(items:Item[])=>void}) {
  const [aviso,setAviso]=useState("");
  const navigate=useNavigate();
  const [texto,setTexto] = useState("");
  const [consulta,setConsulta] = useState({q:"",stock:false,p:1});
  const [datos,setDatos] = useState<Catalogo|null>(null);
  const [error,setError] = useState(false);
  useEffect(()=>{
    const abort = new AbortController();
    setDatos(null); setError(false);
    const params=new URLSearchParams({q:consulta.q,stock:consulta.stock?"1":"0",p:String(consulta.p)});
    fetch(`${API_BASE_URL}/tienda-piloto/catalogo?${params}`,{signal:abort.signal})
      .then(r=>{if(!r.ok)throw Error();return r.json();})
      .then(data=>{if(!abort.signal.aborted)setDatos(data);})
      .catch(()=>{if(!abort.signal.aborted)setError(true);});
    return ()=>abort.abort();
  },[consulta]);
  return <main className="min-h-screen bg-slate-50 p-5 text-slate-900"><div className="mx-auto max-w-6xl">
    <p className="mt-6 text-sm font-semibold text-teal-800">Empresa A · Vista previa local</p>
    <h1 className="my-3 text-3xl font-bold">Catálogo de productos</h1>
    <button className="rounded border bg-white px-4 py-2" onClick={()=>navigate("carrito")}>Ver carrito ({items.reduce((s,i)=>s+i.cantidad,0)})</button>
    <p role="status">{aviso}</p>
    <form className="my-5 flex flex-wrap items-end gap-4" onSubmit={e=>{e.preventDefault();setConsulta({...consulta,q:texto.trim(),p:1});}}>
      <label className="grid gap-1">Nombre o referencia<input className="rounded border p-2" value={texto} maxLength={100} onChange={e=>setTexto(e.target.value)}/></label>
      <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={consulta.stock} onChange={e=>setConsulta({...consulta,q:texto.trim(),stock:e.target.checked,p:1})}/>Solo disponibles</label>
      <button className="rounded bg-teal-800 px-5 py-3 text-white">Buscar</button>
    </form>
    <p role="status">{error?"No se pudo cargar el catálogo local.":datos?`${datos.total.toLocaleString("es-CO")} productos`:"Cargando catálogo…"}</p>
    {datos && <><section aria-label="Productos" className="my-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{datos.productos.map(r=><article className="rounded-xl border bg-white p-4" key={r.id}>
      <small>{r.categoria}</small><h2 className="font-semibold">{r.nombre}</h2>{r.referencia && <p>Ref. {r.referencia}</p>}
      <div className="mt-3 flex justify-between gap-2"><strong>{cop.format(Number(r.precio_venta))}</strong><span>{r.disponible?"Disponible":"Agotado"}</span></div>
      <button disabled={!r.disponible} className="mt-4 rounded bg-teal-800 px-4 py-2 text-white disabled:opacity-40" onClick={()=>{
        const old=items.find(i=>i.id===r.id);
        if((old?.cantidad||0)>=r.cantidad){setAviso("Ya agregaste todas las unidades disponibles de este producto.");return;}
        if(!old&&items.length>=40){setAviso("El carrito admite hasta 40 referencias.");return;}
        cambiar(old?items.map(i=>i.id===r.id?{...i,cantidad:i.cantidad+1}:i):[...items,{id:r.id,nombre:r.nombre,cantidad:1}]);setAviso(`${r.nombre}: agregado al carrito.`);
      }}>Agregar al carrito</button>
    </article>)}</section>{!datos.total && <p>Prueba con otro nombre o referencia.</p>}
    {datos.paginas>1 && <nav aria-label="Páginas" className="flex items-center justify-center gap-4">
      <button className="p-3 disabled:opacity-40" disabled={datos.pagina===1} onClick={()=>setConsulta({...consulta,p:datos.pagina-1})}>Anterior</button>
      <span>{datos.pagina} de {datos.paginas}</span><button className="p-3 disabled:opacity-40" disabled={datos.pagina>=datos.paginas} onClick={()=>setConsulta({...consulta,p:datos.pagina+1})}>Siguiente</button>
    </nav>}</>}
  </div></main>;
}
