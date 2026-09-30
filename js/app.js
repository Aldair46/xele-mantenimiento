// Versión sin servidor: los datos se guardan en el navegador de este dispositivo (localStorage).
import { MAQ, FREQS, FREQ_PERIODO } from "./datos.js";

const PHOTOS = Object.fromEntries(MAQ.map(m => [m.c, `img/${m.c}.jpg`]));
const MAQ_BY = Object.fromEntries(MAQ.map(m=>[m.c,m]));
const TASKS = {}; FREQS.forEach(([f])=>{TASKS[f]=[];MAQ.forEach(m=>(m.plan[f]||[]).forEach((t,i)=>TASKS[f].push({id:`${m.c}-${f}-${i}`,m:m.c,t})))});

/* ---------- state ---------- */
const S = {view:"panel", ficha:null, freq:"diario", filtro:"abiertas", fallas:[], ejec:{}, ajustes:{horasDia:14},
  owner:false, verComo:null, name:"", uid:null, email:"", db:null, auth:null, mode:"local", loginErr:"", sel:null, fotos:{}, toast:null,
  form:null, ro:false, unsubs:[], periodKeys:{}};
try{ S.name = localStorage.getItem("xele_nombre")||""; }catch(e){}
const isDueno = ()=> S.owner && S.verComo!=="trabajador";

/* ---------- helpers ---------- */
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pad = n => String(n).padStart(2,"0");
function isoWeek(d){const t=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const day=t.getUTCDay()||7;t.setUTCDate(t.getUTCDate()+4-day);const y=t.getUTCFullYear();const w=Math.ceil(((t-Date.UTC(y,0,1))/864e5+1)/7);return `${y}-W${pad(w)}`}
function periodKey(f,d=new Date()){const y=d.getFullYear(),m=d.getMonth();
  return {diario:`${y}-${pad(m+1)}-${pad(d.getDate())}`,semanal:isoWeek(d),mensual:`${y}-${pad(m+1)}`,trimestral:`${y}-T${Math.floor(m/3)+1}`,semestral:`${y}-S${m<6?1:2}`,anual:`${y}`}[f]}
const fmtFecha = ms => { if(!ms) return "—"; const d=new Date(ms); return d.toLocaleDateString("es-PE",{day:"2-digit",month:"short"})+" "+d.toLocaleTimeString("es-PE",{hour:"2-digit",minute:"2-digit"}); };
const hace = ms => { const h=(Date.now()-ms)/3.6e6; if(h<1) return `hace ${Math.max(1,Math.round(h*60))} min`; if(h<48) return `hace ${Math.round(h)} h`; return `hace ${Math.round(h/24)} días`; };
const n1 = v => (v==null||!isFinite(v))?"—":(Math.round(v*10)/10).toLocaleString("es-PE");
const pct = v => (v==null||!isFinite(v))?"—":(Math.round(v*1000)/10).toLocaleString("es-PE")+" %";
const ESTADO = {reportada:["Reportada","b-rep"],en_proceso:["En proceso","b-proc"],resuelta:["Resuelta","b-res"]};
const newId = p => p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function toast(msg){S.toast=msg;renderToast();clearTimeout(toast.t);toast.t=setTimeout(()=>{S.toast=null;renderToast()},2600)}

/* ---------- metrics ---------- */
function monthStart(){const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1).getTime()}
function paradaMes(f,ms,now,hd){
  if(f.estado==="resuelta") return (f.fechaCierre||0)>=ms ? (+f.horasParada||0) : 0;
  if(f.fueraServicio){const st=Math.max(f.fecha,ms);return Math.max(0,(now-st)/3.6e6*hd/24)}
  return 0;
}
function metrics(){
  const now=Date.now(), ms=monthStart(), hd=+S.ajustes.horasDia||14;
  const hop=Math.max(1,hd*((now-ms)/864e5));
  const per=MAQ.map(m=>{
    const fs=S.fallas.filter(f=>f.maquina===m.c);
    const mes=fs.filter(f=>f.fecha>=ms);
    const par=fs.reduce((a,f)=>a+paradaMes(f,ms,now,hd),0);
    const abiertas=fs.filter(f=>f.estado!=="resuelta");
    const res=mes.filter(f=>f.estado==="resuelta");
    const n=mes.length;
    return {m, hop, par, n, total:fs.length, disp:Math.max(0,(hop-par)/hop),
      mtbf:n?(hop-par)/n:null, mttr:res.length?res.reduce((a,f)=>a+(+f.horasParada||0),0)/res.length:null,
      abiertas, fuera:abiertas.some(f=>f.fueraServicio), costo:mes.reduce((a,f)=>a+(+f.costo||0),0)};
  });
  let done=0,tot=0; const porFreq={};
  FREQS.forEach(([f])=>{const tasks=(S.ejec[f]&&S.ejec[f].tasks)||{};const d=TASKS[f].filter(t=>tasks[t.id]).length;porFreq[f]={d,t:TASKS[f].length};done+=d;tot+=TASKS[f].length});
  const resMes=S.fallas.filter(f=>f.estado==="resuelta"&&(f.fechaCierre||0)>=ms);
  return {per, disp:per.reduce((a,p)=>a+p.disp,0)/per.length, cumpl:tot?done/tot:0, porFreq,
    abiertas:S.fallas.filter(f=>f.estado!=="resuelta").length,
    mttr:resMes.length?resMes.reduce((a,f)=>a+(+f.horasParada||0),0)/resMes.length:null,
    costo:per.reduce((a,p)=>a+p.costo,0), fallasMes:per.reduce((a,p)=>a+p.n,0), hop,
    alertas:S.fallas.filter(f=>f.estado!=="resuelta"&&f.prioridad==="Alta"&&Date.now()-f.fecha>24*3.6e6)};
}

/* ---------- icons ---------- */
const I = {
 panel:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
 maq:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 5v14M18 5v14M3 8v8M21 8v8M6 12h12"/></svg>',
 plan:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 2v4M15 2v4M8 12l2.5 2.5L16 9"/></svg>',
 falla:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
 cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
 plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
 check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
 gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
 back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
 dl:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
 img:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>'
};

/* ---------- render ---------- */
const root=document.getElementById("root");
const NAV=[["panel","Panel",I.panel],["maquinas","Máquinas",I.maq],["plan","Plan",I.plan],["fallas","Fallas",I.falla]];
function render(){
  const M=metrics();
  const abiertas=M.abiertas;
  const nav=NAV.map(([k,l,ic])=>`<button data-go="${k}" ${S.view===k||(k==="maquinas"&&S.view==="ficha")?'aria-current="page"':""}>${ic}<span>${l}</span>${k==="fallas"&&abiertas?`<span class="badge b-brand">${abiertas}</span>`:""}</button>`).join("");
  const ajustesBtn = true?`<button data-go="ajustes" ${S.view==="ajustes"?'aria-current="page"':""}>${I.gear}<span>Ajustes</span></button>`:"";
  let body="";
  if(S.view==="panel") body=vPanel(M);
  else if(S.view==="maquinas") body=vMaquinas(M);
  else if(S.view==="ficha") body=vFicha(M);
  else if(S.view==="plan") body=vPlan(M);
  else if(S.view==="fallas") body=vFallas();
  else if(S.view==="reportar") body=vReportar();
  else if(S.view==="ajustes") body=vAjustes();
  const tab=(k,l,ic)=>`<button data-go="${k}" ${S.view===k||(k==="maquinas"&&S.view==="ficha")?'aria-current="page"':""}>${ic}<span>${l}</span>${k==="fallas"&&abiertas?`<span class="badge b-brand">${abiertas}</span>`:""}</button>`;
  root.innerHTML=`
  <div class="mobilebar"><div class="brand">XELE<span>Mantenimiento</span></div><button class="btn sm ghost" style="color:#fff;border-color:rgba(255,255,255,.25)" data-go="ajustes" aria-label="Ajustes">${I.gear}</button></div>
  <div class="app">
    <aside class="rail">
      <div class="brand">XELE<span>Fitness · Mantenimiento</span></div>
      <nav class="nav">${nav}${ajustesBtn}</nav>
      <button class="btn primary report" data-go="reportar">${I.cam} Reportar una falla</button>
      <div class="rail-foot"><div class="who">${esc(S.name||"Sin nombre")}</div><div>${isDueno()?"Dueño / administración":"Personal de sala"}</div></div>
    </aside>
    <main>${banner()}${body}</main>
  </div>
  <nav class="tabbar">${tab("panel","Panel",I.panel)}${tab("maquinas","Máquinas",I.maq)}
    <button class="fab" data-go="reportar" aria-label="Reportar falla"><span class="c">${I.cam}</span><span class="lbl">Reportar</span></button>
    ${tab("plan","Plan",I.plan)}${tab("fallas","Fallas",I.falla)}</nav>
  <div id="modal"></div><div id="toast"></div>`;
  renderModal(); renderToast(); loadThumbs();
}
function banner(){
  if(S.mode==="loading") return `<div class="banner">Conectando con la base de datos…</div>`;
  if(S.mode==="local" && !S.avisoVisto) return `<div class="banner" style="display:flex;gap:12px;align-items:center;justify-content:space-between">Los datos se guardan solo en este navegador y dispositivo. <button class="btn sm" data-act="aviso">Entendido</button></div>`;
  if(S.ro) return `<div class="banner">Tu usuario no tiene permiso para guardar este cambio. Pide al dueño que revise tu acceso.</div>`;
  return "";
}
function statusOf(p){ if(p.fuera) return ["Fuera de servicio","var(--bad)"]; if(p.abiertas.length) return [`${p.abiertas.length} falla${p.abiertas.length>1?"s":""} abierta${p.abiertas.length>1?"s":""}`,"var(--warn)"]; return ["Operativa","var(--ok)"]; }
function tagHTML(p){
  const [st,col]=statusOf(p); const m=p.m;
  return `<button class="tag ${p.fuera?"lock":""}" data-ficha="${m.c}" aria-label="${esc(m.n)}, ${st}">
    <div class="ph"><img src="${PHOTOS[m.c]||""}" alt="">${p.fuera?'<span class="lab">FUERA DE SERVICIO</span>':""}<span class="code">${m.c.replace("XF-","")}</span></div>
    <div class="body"><div class="name">${esc(m.n)}</div>
    <div class="chips"><span class="badge ${m.crit==="Alta"?"b-alta":"b-media"}">Criticidad ${m.crit}</span></div>
    <div class="st"><span class="dot" style="background:${col}"></span>${st}</div></div></button>`;
}
function vPanel(M){
  const d=new Date();
  const hola = S.name?`Hola, ${esc(S.name.split(" ")[0])}`:"Estado de la sala";
  const alertas = M.alertas.map(f=>`<div class="alert">${I.falla}<div><b>${esc(MAQ_BY[f.maquina]?.n||f.maquina)}</b> tiene una falla de prioridad Alta sin resolver ${hace(f.fecha)}: ${esc(f.descripcion)} <button class="btn sm" style="margin-left:6px" data-falla="${f.id}">Ver</button></div></div>`).join("");
  const maxN=Math.max(1,...M.per.map(p=>p.total));
  return `
  <div class="top"><div><h1>${hola}</h1><p class="muted">${d.toLocaleDateString("es-PE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})} · Sala de musculación</p></div>
    <div class="actions"><button class="btn primary" data-go="reportar">${I.cam} Reportar una falla</button></div></div>
  ${alertas?`<div style="margin-bottom:18px">${alertas}</div>`:""}
  <div class="board">${M.per.map(tagHTML).join("")}</div>
  <div class="section"><div class="head"><h2>Indicadores del mes</h2><span class="muted small">${n1(M.hop)} h operativas por máquina a la fecha</span></div>
  <div class="kpis">
    <div class="kpi"><div class="l">Disponibilidad</div><div class="v" style="color:${M.disp>=.9?"var(--ok)":"var(--bad)"}">${pct(M.disp)}</div><div class="s">Meta: más de 90 %</div></div>
    <div class="kpi"><div class="l">Cumplimiento del plan</div><div class="v">${pct(M.cumpl)}</div><div class="meter"><i style="width:${Math.round(M.cumpl*100)}%"></i></div><div class="s">Tareas del periodo vigente</div></div>
    <div class="kpi"><div class="l">Fallas abiertas</div><div class="v" style="color:${M.abiertas?"var(--bad)":"var(--ok)"}">${M.abiertas}</div><div class="s">${M.fallasMes} reportadas este mes</div></div>
    <div class="kpi"><div class="l">MTTR</div><div class="v">${M.mttr==null?"—":n1(M.mttr)+" h"}</div><div class="s">Tiempo medio de reparación</div></div>
    <div class="kpi"><div class="l">Costo del mes</div><div class="v">S/ ${Math.round(M.costo).toLocaleString("es-PE")}</div><div class="s">Repuestos y mano de obra</div></div>
  </div></div>
  <div class="section grid" style="grid-template-columns:repeat(auto-fit,minmax(300px,1fr))">
    <div class="panel"><h3>Cumplimiento por frecuencia</h3><div class="bars" style="margin-top:14px">
      ${FREQS.map(([f,l])=>{const x=M.porFreq[f];return `<div class="bar"><span>${l}</span><div class="tr"><i style="width:${x.t?x.d/x.t*100:0}%;background:${x.d===x.t?"var(--ok)":"var(--brand)"}"></i></div><b>${x.d}/${x.t}</b></div>`}).join("")}
    </div></div>
    <div class="panel"><h3>Fallas por máquina (histórico)</h3><div class="bars" style="margin-top:14px">
      ${M.per.map(p=>`<div class="bar"><span>${p.m.c.replace("XF-","")}</span><div class="tr"><i style="width:${p.total/maxN*100}%;background:${p.m.crit==="Alta"?"var(--bad)":"var(--warn)"}"></i></div><b>${p.total}</b></div>`).join("")}
    </div></div>
  </div>
  <div class="section panel"><h3 style="margin-bottom:8px">Indicadores por máquina · mes actual</h3><div class="scroll"><table>
    <thead><tr><th>Máquina</th><th>Criticidad</th><th class="num">Disponibilidad</th><th class="num">Fallas</th><th class="num">H. parada</th><th class="num">MTBF (h)</th><th class="num">MTTR (h)</th></tr></thead>
    <tbody>${M.per.map(p=>`<tr><td><b>${p.m.c}</b> <span class="muted">${esc(p.m.n)}</span></td><td><span class="badge ${p.m.crit==="Alta"?"b-alta":"b-media"}">${p.m.crit}</span></td>
      <td class="num" style="color:${p.disp>=.9?"var(--ok)":"var(--bad)"};font-weight:700">${pct(p.disp)}</td><td class="num">${p.n}</td><td class="num">${n1(p.par)}</td><td class="num">${p.mtbf==null?"—":n1(p.mtbf)}</td><td class="num">${p.mttr==null?"—":n1(p.mttr)}</td></tr>`).join("")}</tbody>
  </table></div><p class="small muted" style="margin:10px 0 0">Disponibilidad = (H. operativas − H. de parada) / H. operativas. MTBF = (H. operativas − H. de parada) / N° de fallas. MTTR = H. de parada / N° de fallas resueltas.</p></div>`;
}
function vMaquinas(M){
  return `<div class="top"><div><h1>Máquinas</h1><p class="muted">8 activos codificados de la sala de musculación. Toca una para ver su ficha técnica.</p></div></div>
  <div class="board">${M.per.map(tagHTML).join("")}</div>`;
}
function li(a){return `<ul class="list">${a.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`}
function vFicha(M){
  const m=MAQ_BY[S.ficha]; if(!m){S.view="maquinas";return vMaquinas(M)}
  const p=M.per.find(x=>x.m.c===m.c); const [st,col]=statusOf(p);
  const hist=S.fallas.filter(f=>f.maquina===m.c);
  return `<button class="btn ghost sm" data-go="maquinas" style="margin-bottom:12px">${I.back} Máquinas</button>
  <div class="ficha">
    <div><div class="ph"><img src="${PHOTOS[m.c]}" alt="Fotografía de ${esc(m.n)}"></div>
      <button class="btn primary" style="width:100%;margin-top:12px" data-reportar="${m.c}">${I.cam} Reportar falla en esta máquina</button></div>
    <div>
      <div class="chips"><span class="badge b-brand">${m.c}</span><span class="badge ${m.crit==="Alta"?"b-alta":"b-media"}">Criticidad ${m.crit}</span><span class="badge" style="background:var(--surface);color:var(--ink2)"><span class="dot" style="background:${col}"></span>${st}</span></div>
      <h1 style="margin-top:10px">${esc(m.full)}</h1>
      <p style="margin:8px 0 0;max-width:62ch">${esc(m.fn)}</p>
      <div class="kpis" style="grid-template-columns:repeat(3,minmax(0,1fr));margin-top:16px">
        <div class="kpi"><div class="l">Disponibilidad</div><div class="v">${pct(p.disp)}</div></div>
        <div class="kpi"><div class="l">MTBF</div><div class="v">${p.mtbf==null?"—":n1(p.mtbf)+" h"}</div></div>
        <div class="kpi"><div class="l">MTTR</div><div class="v">${p.mttr==null?"—":n1(p.mttr)+" h"}</div></div>
      </div>
    </div>
  </div>
  <div class="section cols">
    <div class="panel"><h3>Componentes principales</h3>${li(m.comp)}</div>
    <div class="panel"><h3>Fallas comunes</h3>${li(m.fal)}</div>
    <div class="panel" style="background:var(--bad-soft)"><h3>Riesgo ocupacional</h3>${li(m.rie)}<h3 style="margin-top:14px">EPP y control</h3>${li(m.epp)}</div>
    <div class="panel"><h3>Lubricantes e insumos</h3>${li(m.lub)}<h3 style="margin-top:14px">Repuestos críticos</h3>${li(m.rep)}</div>
  </div>
  <div class="section panel"><h3>Plan de mantenimiento preventivo</h3>
    ${FREQS.map(([f,l])=>`<div class="freqrow"><b>${l}</b><div>${(m.plan[f]||[]).map((t,i)=>{const id=`${m.c}-${f}-${i}`;const e=(S.ejec[f]&&S.ejec[f].tasks||{})[id];return `<div style="display:flex;gap:8px;align-items:baseline">${e?`<span class="badge b-ok">Hecha</span>`:`<span class="badge b-baja">Pendiente</span>`}<span>${esc(t)}</span></div>`}).join("")}</div></div>`).join("")}
  </div>
  <div class="section"><div class="head"><h2>Historial de fallas</h2><span class="muted small">${hist.length} registro${hist.length===1?"":"s"}</span></div>
    ${hist.length?hist.map(fallaCard).join(""):`<div class="panel empty">Esta máquina no tiene fallas registradas.</div>`}</div>`;
}
function vPlan(M){
  const f=S.freq, tasks=(S.ejec[f]&&S.ejec[f].tasks)||{}, x=M.porFreq[f];
  const groups=MAQ.map(m=>{const ts=TASKS[f].filter(t=>t.m===m.c);if(!ts.length)return"";
    return `<div class="mgroup panel"><h3><span class="badge b-brand">${m.c.replace("XF-","")}</span>${esc(m.n)}</h3>
    ${ts.map(t=>{const e=tasks[t.id];return `<div class="task ${e?"done":""}"><button class="check" data-task="${t.id}" aria-pressed="${!!e}" aria-label="${e?"Desmarcar":"Marcar como realizada"}: ${esc(t.t)}" ${S.mode==="loading"||S.ro?"disabled":""}>${I.check}</button>
      <div><div class="tt">${esc(t.t)}</div>${e?`<div class="meta">Realizada por ${esc(e.por)} · ${fmtFecha(e.at)}</div>`:""}</div></div>`}).join("")}</div>`}).join("");
  return `<div class="top"><div><h1>Plan de mantenimiento</h1><p class="muted">Marca cada tarea cuando la completes. El registro se reinicia en cada periodo.</p></div></div>
  <div class="seg" role="group" aria-label="Frecuencia">${FREQS.map(([k,l])=>`<button data-freq="${k}" aria-pressed="${k===f}">${l} <span class="muted">${M.porFreq[k].d}/${M.porFreq[k].t}</span></button>`).join("")}</div>
  <div class="panel" style="margin:16px 0;display:flex;align-items:center;gap:16px;flex-wrap:wrap"><div style="flex:1;min-width:200px"><b>${x.d} de ${x.t} tareas completadas ${FREQ_PERIODO[f]}</b><div class="meter"><i style="width:${x.t?x.d/x.t*100:0}%"></i></div></div><span class="muted small">Periodo ${periodKey(f)}</span></div>
  <div class="grid">${groups}</div>`;
}
function fallaCard(f){
  const m=MAQ_BY[f.maquina]; const [el,ec]=ESTADO[f.estado]||ESTADO.reportada;
  const th=f.hasFoto?`<img class="thumb" data-thumb="${f.id}" alt="Foto de la falla" src="${S.fotos[f.id]||""}">`:`<div class="thumb">${I.img}</div>`;
  return `<button class="falla" data-falla="${f.id}">${th}<div><div class="chips"><b>${esc(f.maquina)}</b><span class="muted small">${esc(m?.n||"")}</span></div>
    <div class="t" style="margin-top:4px">${esc(f.descripcion)}</div>
    <div class="m">${esc(f.componente||"Sin componente")} · ${esc(f.reportadoPor||"—")} · ${fmtFecha(f.fecha)}</div></div>
    <div class="chips" style="flex-direction:column;align-items:flex-end"><span class="badge ${ec}">${el}</span><span class="badge ${f.prioridad==="Alta"?"b-alta":f.prioridad==="Media"?"b-media":"b-baja"}">${esc(f.prioridad)}</span>${f.fueraServicio&&f.estado!=="resuelta"?`<span class="badge b-alta">Bloqueada</span>`:""}</div></button>`;
}
function vFallas(){
  const F={abiertas:f=>f.estado!=="resuelta",reportada:f=>f.estado==="reportada",en_proceso:f=>f.estado==="en_proceso",resuelta:f=>f.estado==="resuelta",todas:()=>true};
  const list=S.fallas.filter(F[S.filtro]);
  return `<div class="top"><div><h1>Fallas reportadas</h1><p class="muted">${S.fallas.length} registros en total.${isDueno()?" Toca una falla para actualizar su estado.":""}</p></div>
    <div class="chips">${S.fallas.length?`<button class="btn" data-act="csv">${I.dl} Exportar CSV</button>`:""}<button class="btn primary" data-go="reportar">${I.cam} Reportar</button></div></div>
  <div class="seg" role="group" aria-label="Filtro" style="margin-bottom:16px">${[["abiertas","Abiertas"],["reportada","Reportadas"],["en_proceso","En proceso"],["resuelta","Resueltas"],["todas","Todas"]].map(([k,l])=>`<button data-filtro="${k}" aria-pressed="${S.filtro===k}">${l}</button>`).join("")}</div>
  ${list.length?list.map(fallaCard).join(""):`<div class="panel empty">${S.filtro==="abiertas"?"No hay fallas abiertas. Todas las máquinas están operativas.":"No hay fallas con este estado."}</div>`}`;
}
function vReportar(){
  const fm=S.form||(S.form={maquina:"",componente:"",descripcion:"",prioridad:"",fuera:false,foto:null,nombre:S.name});
  const m=MAQ_BY[fm.maquina];
  const prio = fm.prioridad || (m?(m.crit==="Alta"?"Alta":"Media"):"");
  return `<div class="top"><div><h1>Reportar una falla</h1><p class="muted">Toma una foto y describe el problema. El dueño lo verá de inmediato en el panel.</p></div></div>
  <div class="form panel">
    <div class="f" style="display:grid;gap:8px;font-weight:600;font-size:14px">Máquina afectada
      <div class="picks">${MAQ.map(x=>`<button type="button" class="pick" data-pick="${x.c}" aria-pressed="${fm.maquina===x.c}"><b>${x.c.replace("XF-","")}</b>${esc(x.n)}</button>`).join("")}</div></div>
    <label class="f">Componente afectado
      <select id="f-comp" ${m?"":"disabled"}><option value="">${m?"Selecciona un componente":"Primero elige la máquina"}</option>${m?m.comp.map(c=>`<option ${fm.componente===c?"selected":""}>${esc(c)}</option>`).join("")+`<option ${fm.componente==="Otro"?"selected":""}>Otro</option>`:""}</select></label>
    <label class="f">¿Qué pasa? <textarea id="f-desc" placeholder="Ej.: el cable del lado izquierdo está deshilachado cerca de la polea superior">${esc(fm.descripcion)}</textarea></label>
    <div class="f" style="display:grid;gap:8px;font-weight:600;font-size:14px">Prioridad <small>${m?`Sugerida según la criticidad ${m.crit} de la máquina.`:""}</small>
      <div class="prio">${["Alta","Media","Baja"].map(p=>`<button type="button" class="btn" data-prio="${p}" aria-pressed="${prio===p}">${p}</button>`).join("")}</div></div>
    <label class="toggle"><input type="checkbox" id="f-fuera" ${fm.fuera?"checked":""}><span><b>La máquina no se puede usar</b><br><span class="small muted">Se marcará como fuera de servicio y contará como tiempo de parada.</span></span></label>
    <div class="f" style="display:grid;gap:8px;font-weight:600;font-size:14px">Foto de la falla <small>Opcional, pero ayuda mucho a diagnosticar.</small>
      <div class="photo-drop">${fm.foto?`<img src="${fm.foto}" alt="Vista previa">`:`<div class="thumb" style="width:96px;height:96px">${I.cam}</div>`}
        <div style="display:grid;gap:8px"><label class="btn" style="cursor:pointer">${I.cam} ${fm.foto?"Cambiar foto":"Tomar o elegir foto"}<input type="file" id="f-foto" accept="image/*" capture="environment" hidden></label>${fm.foto?`<button type="button" class="btn ghost sm" data-act="quitarfoto">Quitar foto</button>`:""}</div></div></div>
    <label class="f">Tu nombre <input type="text" id="f-nombre" value="${esc(fm.nombre)}" placeholder="Nombre y apellido" autocomplete="name"></label>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" data-act="enviar" ${S.ro?"disabled":""}>Enviar reporte al dueño</button><button class="btn ghost" data-act="cancelar">Cancelar</button></div>
  </div>`;
}
function vAjustes(){
  return `<div class="top"><div><h1>Ajustes</h1><p class="muted">Parámetros usados para calcular los indicadores.</p></div></div>
  <div class="form panel">
    ${S.owner?`<label class="f">Horas de operación del gimnasio por día <small>Se usa para las horas operativas de cada máquina.</small><input type="number" id="a-horas" min="1" max="24" step="0.5" value="${esc(S.ajustes.horasDia)}"></label>`:""}
    <label class="f">Tu nombre en este dispositivo <input type="text" id="a-nombre" value="${esc(S.name)}"></label>
    ${S.owner?`<div class="toggle"><input type="checkbox" id="a-vista" ${S.verComo==="trabajador"?"checked":""} style="accent-color:var(--brand)"><span><b>Ver como personal de sala</b><br><span class="small muted">Oculta las acciones de administración para revisar lo que ve un trabajador.</span></span></div>`:""}
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" data-act="guardarajustes">Guardar ajustes</button><button class="btn ghost" data-act="borrar">Borrar todos los datos</button></div>
  </div>`;
}

/* ---------- modal: falla detail ---------- */
function renderModal(){
  const el=document.getElementById("modal"); if(!el) return;
  const f=S.sel&&S.fallas.find(x=>x.id===S.sel); if(!f){el.innerHTML="";return}
  const m=MAQ_BY[f.maquina]; const [elb,ec]=ESTADO[f.estado]||ESTADO.reportada; const adm=isDueno();
  const sugerida = f.fueraServicio? Math.round((Date.now()-f.fecha)/3.6e6*(+S.ajustes.horasDia||14)/24*10)/10 : 0;
  el.innerHTML=`<div class="scrim" data-act="cerrar"><div class="sheet" role="dialog" aria-modal="true" aria-label="Detalle de la falla">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px"><div><div class="chips"><span class="badge b-brand">${esc(f.maquina)}</span><span class="badge ${ec}">${elb}</span><span class="badge ${f.prioridad==="Alta"?"b-alta":f.prioridad==="Media"?"b-media":"b-baja"}">Prioridad ${esc(f.prioridad)}</span></div>
      <h2 style="margin-top:8px">${esc(m?.n||f.maquina)}</h2></div><button class="btn sm" data-act="cerrar">Cerrar</button></div>
    ${f.hasFoto?`<img class="bigph" style="margin-top:14px" data-thumb="${f.id}" src="${S.fotos[f.id]||""}" alt="Foto de la falla">`:""}
    <div class="panel" style="margin-top:14px"><p style="margin:0;font-weight:600">${esc(f.descripcion)}</p>
      <p class="small muted" style="margin:8px 0 0">${esc(f.componente||"Sin componente")} · Reportada por ${esc(f.reportadoPor||"—")} · ${fmtFecha(f.fecha)} (${hace(f.fecha)})${f.fueraServicio?" · Máquina fuera de servicio":""}</p>
      ${f.estado==="resuelta"?`<p style="margin:12px 0 0"><b>Solución:</b> ${esc(f.accion||"—")}<br><b>Técnico:</b> ${esc(f.tecnico||"—")} · <b>Repuestos:</b> ${esc(f.repuestos||"—")}<br><b>Parada:</b> ${n1(+f.horasParada||0)} h · <b>Costo:</b> S/ ${n1(+f.costo||0)} · <b>Cierre:</b> ${fmtFecha(f.fechaCierre)}</p>`:""}
    </div>
    ${adm?`<div class="form panel" style="margin-top:14px;max-width:none">
      <h3>Gestionar la falla</h3>
      <div class="seg" role="group" aria-label="Estado">${Object.entries(ESTADO).map(([k,[l]])=>`<button data-estado="${k}" aria-pressed="${f.estado===k}">${l}</button>`).join("")}</div>
      <label class="toggle"><input type="checkbox" id="g-fuera" ${f.fueraServicio?"checked":""}><span><b>Máquina fuera de servicio</b></span></label>
      <label class="f">Acción tomada <textarea id="g-accion" placeholder="Qué se hizo para solucionarla">${esc(f.accion||"")}</textarea></label>
      <div class="cols"><label class="f">Técnico responsable <input type="text" id="g-tecnico" value="${esc(f.tecnico||"")}"></label>
      <label class="f">Repuestos utilizados <input type="text" id="g-rep" value="${esc(f.repuestos||"")}"></label>
      <label class="f">Tiempo de parada (h) <small>${f.fueraServicio&&f.estado!=="resuelta"?`Sugerido: ${n1(sugerida)} h según las horas de operación`:""}</small><input type="number" id="g-horas" min="0" step="0.5" value="${f.horasParada??(f.estado!=="resuelta"&&f.fueraServicio?sugerida:"")}"></label>
      <label class="f">Costo (S/) <input type="number" id="g-costo" min="0" step="1" value="${f.costo??""}"></label></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" data-act="guardarfalla">Guardar cambios</button>${f.estado!=="resuelta"?`<button class="btn" data-act="resolver">Marcar como resuelta</button>`:""}</div>
    </div>`:""}
  </div></div>`;
  loadThumbs();
}
function renderToast(){const el=document.getElementById("toast");if(el)el.innerHTML=S.toast?`<div class="toast" role="status">${esc(S.toast)}</div>`:""}

/* ---------- photos ---------- */
function loadThumbs(){
  document.querySelectorAll("[data-thumb]").forEach(img=>{ const id=img.getAttribute("data-thumb"); if(S.fotos[id]) img.src=S.fotos[id] });
}

function compress(file){ /* versión ligera para caber en el almacenamiento del navegador */
  return new Promise((res,rej)=>{const fr=new FileReader();fr.onerror=rej;fr.onload=()=>{const im=new Image();im.onerror=rej;im.onload=()=>{
    let max=900,q=.7,out="";
    for(let k=0;k<6;k++){const sc=Math.min(1,max/Math.max(im.width,im.height));const c=document.createElement("canvas");c.width=Math.round(im.width*sc);c.height=Math.round(im.height*sc);c.getContext("2d").drawImage(im,0,0,c.width,c.height);out=c.toDataURL("image/jpeg",q);if(out.length<110000)break;max*=.8;q-=.06}
    res(out)};im.src=fr.result};fr.readAsDataURL(file)});
}

/* ---------- actions ---------- */
function syncForm(){
  if(S.view!=="reportar"||!S.form) return;
  const g=id=>document.getElementById(id);
  if(g("f-comp")) S.form.componente=g("f-comp").value;
  if(g("f-desc")) S.form.descripcion=g("f-desc").value;
  if(g("f-fuera")) S.form.fuera=g("f-fuera").checked;
  if(g("f-nombre")) S.form.nombre=g("f-nombre").value;
}
function go(v){ if(v!=="reportar") S.form=null; S.view=v; render(); window.scrollTo(0,0) }
async function write(){ return guardarLocal() }
async function toggleTask(id){
  const f=id.split("-")[3]; const key=periodKey(f); const cur=(S.ejec[f]&&S.ejec[f].tasks)||{};
  const entry = cur[id]?null:{por:S.name||"Personal",uid:S.uid||null,at:Date.now()};
  if(cur[id] && !isDueno() && cur[id].uid && cur[id].uid!==S.uid){toast("Solo quien la marcó o el dueño puede desmarcarla");return}
  S.ejec[f]={...(S.ejec[f]||{}),key,tasks:{...cur,[id]:entry}}; render();
  await write();
}
async function enviar(){
  syncForm(); const fm=S.form; const m=MAQ_BY[fm.maquina];
  if(!m){toast("Elige la máquina afectada");return}
  if(!fm.descripcion.trim()){toast("Describe qué le pasa a la máquina");document.getElementById("f-desc")?.focus();return}
  if(!fm.nombre.trim()){toast("Escribe tu nombre");document.getElementById("f-nombre")?.focus();return}
  S.name=fm.nombre.trim(); try{localStorage.setItem("xele_nombre",S.name)}catch(e){}
  const id=newId("F"); const now=Date.now();
  const data={maquina:m.c,componente:fm.componente||"",descripcion:fm.descripcion.trim().slice(0,1000),prioridad:fm.prioridad||(m.crit==="Alta"?"Alta":"Media"),
    fueraServicio:!!fm.fuera,estado:"reportada",fecha:now,reportadoPor:S.name,reportadoId:S.uid||null,hasFoto:!!fm.foto,
    accion:"",tecnico:"",repuestos:"",horasParada:null,costo:null,fechaCierre:null};
  const btn=document.querySelector('[data-act="enviar"]'); if(btn){btn.disabled=true;btn.textContent="Enviando…"}
  if(fm.foto) S.fotos[id]=fm.foto;
  const ok=true;
  if(!ok){ if(btn){btn.disabled=false;btn.textContent="Enviar reporte al dueño"} return }
  if(S.mode!=="live"){ S.fallas=[{id,...data},...S.fallas]; guardarLocal() }
  S.form=null; toast("Reporte enviado"); go("fallas");
}
async function guardarFalla(resolver, nuevoEstado){
  const f=S.fallas.find(x=>x.id===S.sel); if(!f) return;
  const g=id=>document.getElementById(id);
  const patch={accion:g("g-accion").value.trim(),tecnico:g("g-tecnico").value.trim(),repuestos:g("g-rep").value.trim(),
    fueraServicio:g("g-fuera").checked, horasParada:g("g-horas").value===""?null:Math.max(0,+g("g-horas").value), costo:g("g-costo").value===""?null:Math.max(0,+g("g-costo").value)};
  let estado=nuevoEstado||f.estado; if(resolver) estado="resuelta";
  patch.estado=estado;
  if(estado==="resuelta"){ patch.fechaCierre=f.fechaCierre||Date.now(); if(patch.horasParada==null) patch.horasParada=0; patch.fueraServicio=false }
  else patch.fechaCierre=null;
  Object.assign(f,patch);
  const ok=await write();
  if(ok){ toast(estado==="resuelta"&&resolver?"Falla marcada como resuelta":"Cambios guardados"); if(resolver) S.sel=null }
  render();
}
async function exportCSV(){
  const cols=["Código de activo","Máquina","Fecha de reporte","Reportado por","Descripción","Componente","Prioridad","Estado","Fuera de servicio","Acción tomada","Técnico","Fecha de cierre","Tiempo de parada (h)","Costo (S/)","Repuestos"];
  const q=v=>`"${String(v??"").replace(/"/g,'""')}"`;
  const dt=ms=>ms?new Date(ms).toLocaleString("es-PE"):"";
  const rows=S.fallas.map(f=>[f.maquina,MAQ_BY[f.maquina]?.n,dt(f.fecha),f.reportadoPor,f.descripcion,f.componente,f.prioridad,(ESTADO[f.estado]||[""])[0],f.fueraServicio?"Sí":"No",f.accion,f.tecnico,dt(f.fechaCierre),f.horasParada??"",f.costo??"",f.repuestos].map(q).join(","));
  const csv="\ufeff"+[cols.map(q).join(","),...rows].join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  const a=document.createElement("a"); a.href=url; a.download=`fallas_xele_${periodKey("diario")}.csv`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
}

document.addEventListener("click",async e=>{
  const t=e.target.closest("[data-go],[data-ficha],[data-freq],[data-task],[data-filtro],[data-falla],[data-pick],[data-prio],[data-act],[data-estado],[data-reportar]");
  if(!t) return;
  const d=t.dataset;
  if(d.act==="cerrar"){ if(t.classList.contains("scrim")&&e.target!==t) return; S.sel=null; renderModal(); return }
  if(d.go){ syncForm(); go(d.go); return }
  if(d.ficha){ S.ficha=d.ficha; go("ficha"); return }
  if(d.reportar){ S.form={maquina:d.reportar,componente:"",descripcion:"",prioridad:"",fuera:false,foto:null,nombre:S.name}; S.view="reportar"; render(); window.scrollTo(0,0); return }
  if(d.freq){ S.freq=d.freq; render(); return }
  if(d.task){ toggleTask(d.task); return }
  if(d.filtro){ S.filtro=d.filtro; render(); return }
  if(d.falla){ S.sel=d.falla; renderModal(); return }
  if(d.pick){ syncForm(); if(S.form.maquina!==d.pick){S.form.componente="";S.form.prioridad=""} S.form.maquina=d.pick; render(); return }
  if(d.prio){ syncForm(); S.form.prioridad=d.prio; render(); return }
  if(d.estado){ guardarFalla(false,d.estado); return }
  if(d.act==="enviar"){ enviar(); return }
  if(d.act==="cancelar"){ S.form=null; go("panel"); return }
  if(d.act==="quitarfoto"){ syncForm(); S.form.foto=null; render(); return }
  if(d.act==="guardarfalla"){ guardarFalla(false); return }
  if(d.act==="resolver"){ guardarFalla(true); return }
  if(d.act==="csv"){ exportCSV(); return }
  if(d.act==="aviso"){ S.avisoVisto=true; try{localStorage.setItem("xele_aviso","1")}catch(e){} render(); return }
  if(d.act==="borrar"){ if(!confirm("¿Borrar todas las fallas, fotos y tareas registradas en este dispositivo? No se puede deshacer.")) return;
    ["xele_datos","xele_fotos"].forEach(k=>{try{localStorage.removeItem(k)}catch(e){}}); S.fallas=[]; S.fotos={}; EJEC={}; cargarEjecVigente(); toast("Datos borrados"); render(); return }
  if(d.act==="guardarajustes"){
    const h=Math.min(24,Math.max(1,+(document.getElementById("a-horas")?.value)||+S.ajustes.horasDia||14));
    const nm=document.getElementById("a-nombre").value.trim(); S.name=nm; try{localStorage.setItem("xele_nombre",nm)}catch(e){}
    if(S.owner){ S.verComo=document.getElementById("a-vista").checked?"trabajador":null;
      if(h!==+S.ajustes.horasDia){ S.ajustes={...S.ajustes,horasDia:h}; await write() } }
    toast("Ajustes guardados"); render(); return }
});
document.addEventListener("change",async e=>{
  if(e.target.id==="f-foto"&&e.target.files[0]){ syncForm(); try{ S.form.foto=await compress(e.target.files[0]); render() }catch(err){ toast("No se pudo leer la imagen") } }
});
document.addEventListener("keydown",e=>{ if(e.key==="Escape"&&S.sel){S.sel=null;renderModal()} });

/* ---------- data ---------- */
let rt=null; function schedule(){ if(rt||S.mode==="login") return; rt=requestAnimationFrame(()=>{rt=null; const a=document.activeElement; const typing=a&&/INPUT|TEXTAREA|SELECT/.test(a.tagName); if(typing){ if(S.sel) return; if(S.view==="reportar"||S.view==="ajustes") return } render() }) }
/* ---------- almacenamiento local ---------- */
let EJEC={};  // { "diario_2026-09-30": {tasks:{...}}, ... }
function cargarEjecVigente(){ FREQS.forEach(([f])=>{ const key=periodKey(f); S.periodKeys[f]=key; const t=(EJEC[`${f}_${key}`]||{}).tasks||{}; S.ejec[f]={key,tasks:Object.fromEntries(Object.entries(t).filter(([,v])=>v))} }) }
function guardarLocal(){
  FREQS.forEach(([f])=>{ if(S.ejec[f]) EJEC[`${f}_${S.ejec[f].key}`]={tasks:S.ejec[f].tasks} });
  try{ localStorage.setItem("xele_datos",JSON.stringify({fallas:S.fallas,ajustes:S.ajustes,ejec:EJEC})) }
  catch(e){ toast("No hay espacio suficiente en este navegador"); return false }
  const ids=new Set(S.fallas.map(f=>f.id)); const fotos=Object.fromEntries(Object.entries(S.fotos).filter(([id])=>ids.has(id)));
  try{ localStorage.setItem("xele_fotos",JSON.stringify(fotos)) }
  catch(e){ toast("No hay espacio para más fotos: borra fallas antiguas o repórtalas sin foto"); }
  return true;
}
function cargarLocal(){
  try{ const d=JSON.parse(localStorage.getItem("xele_datos")||"{}"); S.fallas=d.fallas||[]; S.ajustes={horasDia:14,...(d.ajustes||{})}; EJEC=d.ejec||{} }catch(e){}
  try{ S.fotos=JSON.parse(localStorage.getItem("xele_fotos")||"{}") }catch(e){}
  try{ S.avisoVisto=!!localStorage.getItem("xele_aviso") }catch(e){}
  cargarEjecVigente();
}
function init(){
  S.owner=true; cargarLocal(); render();
  setInterval(()=>{ if(FREQS.some(([f])=>periodKey(f)!==S.periodKeys[f])){ cargarEjecVigente() } schedule() },60000);
}
init();
