import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "../../config/runtime";

const ruta="/tienda-piloto/gestion";
const api=API_BASE_URL+ruta+"/seleccion";
const cop=new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:0});
type Producto={id:number;nombre:string;referencia:string|null;categoria:string;precio_venta:string;disponible:number;seleccionado:number};
type Lista={productos:Producto[];pagina:number;paginas:number;total:number};

export default function Seleccion({previa=false}:{previa?:boolean}){
  const [texto,setTexto]=useState(""),[q,buscar]=useState(""),[p,paginar]=useState(1);
  const [lista,setLista]=useState<Lista|null>(null),[version,refrescar]=useState(0);
  const [ocupado,setOcupado]=useState(false),[error,setError]=useState(""),[aviso,setAviso]=useState("");
  const autorizacion=()=>({Authorization:"Bearer "+(sessionStorage.getItem("operadorPiloto")||"")});
  useEffect(()=>{
    const controller=new AbortController();setLista(null);setError("");
    const params=new URLSearchParams({vista:previa?"seleccion":"todos",q,p:String(p)});
    fetch(`${api}?${params}`,{signal:controller.signal,headers:autorizacion()})
      .then(r=>{if(!r.ok)throw Error(r.status===403?"Abre el acceso privado local de la bandeja.":"No se pudo consultar la selección.");return r.json();})
      .then(v=>{if(!controller.signal.aborted)setLista(v);}).catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();
  },[previa,q,p,version]);
  async function actualizar(item:Producto){
    setOcupado(true);setError("");setAviso("");
    try{
      const r=await fetch(`${api}/${item.id}`,{method:"PUT",headers:{...autorizacion(),"Content-Type":"application/json"},body:JSON.stringify({seleccionar:!item.seleccionado})});
      if(!r.ok)throw Error("No se pudo guardar la selección.");
      setAviso(`${item.nombre}: ${item.seleccionado?"retirado de":"incluido en"} la vista previa.`);refrescar(n=>n+1);
    }catch(e){setError((e as Error).message);}finally{setOcupado(false);}
  }
  return <main className="mx-auto grid max-w-6xl gap-4 p-6">
    <nav className="flex flex-wrap gap-5 text-teal-800 underline"><Link to={ruta}>Bandeja de pedidos</Link>
    <Link to={`${ruta}/${previa?"productos":"previa"}`}>{previa?"Elegir productos":"Ver selección como comprador"}</Link></nav>
    <p>Empresa A · Borrador local</p><h1 className="text-3xl font-bold">{previa?"Vista previa de la selección":"Elegir productos"}</h1>
    <p>{previa?"Así se ven los productos elegidos. Esta vista previa es privada.":"Incluye productos del catálogo real. Los cambios se guardan en el borrador."}</p>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();buscar(texto.trim());paginar(1);}}>
      <label className="grid gap-1">Nombre o referencia<input className="rounded border p-2" maxLength={100} value={texto} onChange={e=>setTexto(e.target.value)}/></label><button className="rounded bg-teal-800 px-4 py-2 text-white">Buscar</button></form>
    <p role="status">{error||aviso}</p>
    {lista?<><p>{lista.total.toLocaleString("es-CO")} productos</p>{!lista.total&&<p>{q?"No hay coincidencias.": "Aún no hay productos seleccionados."}</p>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{lista.productos.map(i=><article key={i.id} className="grid gap-2 rounded-xl border p-4">
      <small>{i.categoria}</small><h2 className="font-semibold">{i.nombre}</h2>{i.referencia&&<p>Ref. {i.referencia}</p>}
      <p>{cop.format(Number(i.precio_venta))} · {i.disponible?"Disponible":"Agotado"}</p>
      {!previa&&<button className="rounded border p-2 text-teal-900" disabled={ocupado} aria-pressed={!!i.seleccionado} onClick={()=>actualizar(i)}>{i.seleccionado?"Retirar de la selección":"Incluir en la selección"}</button>}
    </article>)}</section>{lista.paginas>1&&<nav className="flex items-center gap-3"><button className="p-3" disabled={lista.pagina===1} onClick={()=>paginar(lista.pagina-1)}>Anterior</button>{lista.pagina}/{lista.paginas}<button className="p-3" disabled={lista.pagina===lista.paginas} onClick={()=>paginar(lista.pagina+1)}>Siguiente</button></nav>}</>:!error&&<p>Cargando productos…</p>}
  </main>;
}
