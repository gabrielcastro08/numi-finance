// ============================================================
//  NUMI 1.8 — ASSISTENTE (IA)
//  Chat com o castor. A conversa vai para a Edge Function "numi-ai" (Supabase),
//  que guarda a chave da IA e aplica os limites de uso. Quando a IA precisa de
//  dados, ela pede uma "ferramenta" e o app responde com o que já tem em memória
//  (TX_ALL, state...): nada de dado financeiro é buscado fora do app.
//  Fase atual: só consulta e análise (sem lançar/editar, sem internet).
//  Depende de globals do index.html (sb, SUPABASE_URL, SUPABASE_ANON_KEY, USER,
//  state, TX_ALL, fmt, escHTML, normTxt, keyOf, sumV, txByKey, MONTHS...).
// ============================================================

const AI_URL=SUPABASE_URL+'/functions/v1/numi-ai';
const AI_MAX_MSGS=40;            // conversa maior que isso recomeça (o custo cresce com o histórico)
const AI_IDLE_RESET=6*3600e3;    // depois de 6h parado, abre uma conversa nova
const AI={open:false,busy:false,msgs:[],view:[],last:0};
const AI_SUGGEST=['Como foi meu mês?','Onde estou gastando mais?','Quanto gastei com delivery este ano?','Vou conseguir bater meus objetivos?'];
const AI_TOOL_LABEL={resumo_financeiro:'Olhando seu panorama',buscar_lancamentos:'Procurando lançamentos',
  gastos_por_categoria:'Somando as categorias',objetivos:'Conferindo seus objetivos'};

// ---------- persistência (por usuário, só neste aparelho) ----------
const _aiKey=()=>'numi-ai-'+(USER?.id||'anon');
function aiLoad(){
  try{const o=JSON.parse(localStorage.getItem(_aiKey())||'null');
    if(o&&Date.now()-(o.last||0)<AI_IDLE_RESET){AI.msgs=o.msgs||[];AI.view=o.view||[];AI.last=o.last;}
    else{AI.msgs=[];AI.view=[];}
  }catch(e){AI.msgs=[];AI.view=[];}
}
function aiSave(){AI.last=Date.now();try{localStorage.setItem(_aiKey(),JSON.stringify({msgs:AI.msgs,view:AI.view,last:AI.last}));}catch(e){}}
function aiNew(){AI.msgs=[];AI.view=[];aiSave();aiRender();document.getElementById('ai-input')?.focus();}

// ============================================================
//  FERRAMENTAS (executadas aqui, com os dados do app)
// ============================================================
const _ym=(y,m)=>y+'-'+String(m+1).padStart(2,'0');
const _ymK=s=>{const m=/^(\d{4})-(\d{1,2})$/.exec(String(s||'').trim());return m?keyOf(+m[1],+m[2]-1):null;};
const _kYM=k=>_ym(Math.floor(k/12),k%12);
const _r2=v=>Math.round(v*100)/100;
const _nowK=()=>keyOf(new Date().getFullYear(),new Date().getMonth());
const _txK=t=>t.year*12+t.month;
const _monthHas=k=>TX_ALL.some(t=>_txK(t)===k);
function _catSum(list){const m={};list.forEach(t=>{m[t.tag]=(m[t.tag]||0)+t.value;});return m;}
function _range(i){
  const nowK=_nowK();let a=_ymK(i.de),b=_ymK(i.ate);
  if(a===null&&b===null){a=b=nowK;}else if(a===null)a=b;else if(b===null)b=a;
  if(a>b)[a,b]=[b,a];return[a,b];
}

function aiToolResumo(){
  const nowK=_nowK(),y=Math.floor(nowK/12),m=nowK%12;
  const rec=sumV(txByKey(nowK,'receita')),des=sumV(txByKey(nowK,'despesa'));
  const cats=Object.entries(_catSum(txByKey(nowK,'despesa'))).sort((a,b)=>b[1]-a[1]).slice(0,6)
    .map(([c,v])=>({categoria:c,valor:_r2(v)}));
  const meses=[];for(let k=nowK-11;k<=nowK;k++)if(_monthHas(k)){
    const r=sumV(txByKey(k,'receita')),d=sumV(txByKey(k,'despesa'));
    meses.push({mes:_kYM(k),receitas:_r2(r),despesas:_r2(d),saldo:_r2(r-d)});}
  const fech=meses.filter(x=>_ymK(x.mes)<nowK).slice(-6);
  const avg=f=>fech.length?_r2(fech.reduce((s,x)=>s+x[f],0)/fech.length):null;
  const REAL=TX_ALL.filter(t=>_txK(t)<=nowK);
  const acc=sumV(REAL.filter(t=>t.kind==='receita'))-sumV(REAL.filter(t=>t.kind==='despesa'));
  const anoR=sumV(REAL.filter(t=>t.year===y&&t.kind==='receita')),anoD=sumV(REAL.filter(t=>t.year===y&&t.kind==='despesa'));
  const limites=Object.entries(state.limits||{}).map(([c,l])=>{const g=sumV(txByKey(nowK,'despesa').filter(t=>t.tag===c));
    return{categoria:c,limite:_r2(l),gasto_no_mes:_r2(g),uso_pct:Math.round(g/l*100)};});
  const futuras=TX_ALL.filter(t=>_txK(t)>nowK&&t.kind==='despesa');
  const porMes={};futuras.forEach(t=>{const k=_kYM(_txK(t));porMes[k]=(porMes[k]||0)+t.value;});
  const recs=(state.recorrentes||[]).map(r=>({nome:r.name,tipo:r.type,valor:_r2(r.value),categoria:r.tag,dia:r.day||null,
    lancada_este_mes:typeof recLaunched==='function'&&y===APP_YEAR?recLaunched(r,m):null}));
  return{
    hoje:todayISO(),
    mes_atual:{mes:_kYM(nowK),dia_de_hoje:new Date().getDate(),dias_no_mes:new Date(y,m+1,0).getDate(),
      receitas:_r2(rec),despesas:_r2(des),saldo:_r2(rec-des),maiores_categorias:cats},
    ultimos_meses:meses,
    media_meses_fechados:{meses_considerados:fech.length,receitas:avg('receitas'),despesas:avg('despesas'),saldo:avg('saldo')},
    economia_acumulada_total:_r2(acc),
    ano_atual:{receitas:_r2(anoR),despesas:_r2(anoD),saldo:_r2(anoR-anoD),
      meta_de_economia_do_ano:state.goal?_r2(state.goal):null},
    limites_por_categoria:limites,
    recorrentes:recs,
    parcelas_futuras:{total:_r2(sumV(futuras)),por_mes:Object.entries(porMes).map(([k,v])=>({mes:k,valor:_r2(v)}))},
    categorias:{despesa:state.categories.despesa,receita:state.categories.receita},
  };
}

function aiToolBuscar(i){
  let list=TX_ALL.slice();
  if(i.tipo==='receita'||i.tipo==='despesa')list=list.filter(t=>t.kind===i.tipo);
  const a=_ymK(i.de),b=_ymK(i.ate);
  if(a!==null)list=list.filter(t=>_txK(t)>=a);
  if(b!==null)list=list.filter(t=>_txK(t)<=b);
  if(i.categoria){const c=normTxt(i.categoria);list=list.filter(t=>normTxt(t.tag)===c);}
  if(i.texto){const q=normTxt(i.texto);list=list.filter(t=>normTxt(t.name).includes(q)||normTxt(t.place).includes(q));}
  const soma=sumV(list);
  if(i.ordenar==='valor')list.sort((x,y)=>y.value-x.value);
  else list.sort((x,y)=>_txK(y)-_txK(x)||(y.date||'').localeCompare(x.date||''));
  const lim=Math.max(1,Math.min(100,parseInt(i.limite)||30));
  const nowK=_nowK();
  return{encontrados:list.length,soma:_r2(soma),mostrando:Math.min(lim,list.length),
    itens:list.slice(0,lim).map(t=>({data:t.date||null,mes:_kYM(_txK(t)),tipo:t.kind,nome:t.name,valor:_r2(t.value),
      categoria:t.tag,meio:t.meio||undefined,local:t.place||undefined,
      parcela:t.itot?`${t.ino}/${t.itot}`:undefined,futuro:_txK(t)>nowK||undefined}))};
}

function aiToolCategorias(i){
  const tipo=i.tipo==='receita'?'receita':'despesa';
  const[a,b]=_range(i);const n=b-a+1;
  const list=TX_ALL.filter(t=>t.kind===tipo&&_txK(t)>=a&&_txK(t)<=b);
  const tot=sumV(list);
  const prev=TX_ALL.filter(t=>t.kind===tipo&&_txK(t)>=a-3&&_txK(t)<a);
  const pm=_catSum(prev);
  const rows=Object.entries(_catSum(list)).sort((x,y)=>y[1]-x[1]).map(([c,v])=>({categoria:c,valor:_r2(v),
    pct:tot?Math.round(v/tot*1000)/10:0,lancamentos:list.filter(t=>t.tag===c).length,
    media_mensal_3_meses_antes:pm[c]?_r2(pm[c]/3):0,
    limite_mensal:tipo==='despesa'&&state.limits?.[c]?_r2(state.limits[c]):undefined}));
  return{tipo,de:_kYM(a),ate:_kYM(b),meses:n,total:_r2(tot),categorias:rows};
}

function aiToolObjetivos(){
  if(typeof HAS_GOALS==='undefined'||!HAS_GOALS||typeof goalsPlan!=='function')return{disponivel:false};
  const P=goalsPlan();const lk=k=>k==null?null:_kYM(k);
  const all=state.goals.slice().sort((a,b)=>a.priority-b.priority);
  return{
    visao_geral:{economia_acumulada:_r2(P.base.acc),ja_alocado_nos_objetivos:_r2(P.base.allocated),livre_para_alocar:_r2(P.base.free),
      media_que_guarda_por_mes:_r2(P.base.cap),objetivos_pedem_por_mes:_r2(P.commit),cabe_no_orcamento:P.fits,
      falta_por_mes:P.fits?0:_r2(P.deficit),sugestao:P.tip?P.tip.replace(/<[^>]+>/g,''):null},
    objetivos:all.map((g,idx)=>{
      const i=P.info.get(g.id)||(typeof goalInfo==='function'?goalInfo(g,P.base):null);
      return{nome:g.name,prioridade:idx+1,status:g.status,valor_estimado:_r2(g.target),
        guardado:i?_r2(i.saved):null,falta:i?_r2(i.rem):null,progresso_pct:i?Math.round(i.pct):null,
        data_desejada:g.target_date,guardar_por_mes:i&&i.per!=null?_r2(i.per):null,
        ritmo_ultimos_3_meses:i?_r2(i.pace):null,previsao:i?lk(i.etaK):null,situacao:i?i.st.t:null,
        economia_projetada_depois_de_realizar:P.after.has(g.id)?_r2(P.after.get(g.id)):null,
        orcamento:(g.plan||[]).map(p=>({item:p.label,valor:_r2(Number(p.amount)||0)})),
        notas:g.notes||undefined};
    })};
}

function aiRunTool(name,input){
  try{
    const i=input&&typeof input==='object'?input:{};
    if(name==='resumo_financeiro')return aiToolResumo();
    if(name==='buscar_lancamentos')return aiToolBuscar(i);
    if(name==='gastos_por_categoria')return aiToolCategorias(i);
    if(name==='objetivos')return aiToolObjetivos();
    return{erro:'ferramenta desconhecida: '+name};
  }catch(e){return{erro:'falha ao consultar: '+(e.message||e)};}
}

// ============================================================
//  CONVERSA (loop: IA → ferramentas no app → IA ...)
// ============================================================
async function aiCall(onText){
  const{data:{session}}=await sb.auth.getSession();
  const res=await fetch(AI_URL,{method:'POST',headers:{'Content-Type':'application/json',
      Authorization:'Bearer '+(session?.access_token||''),apikey:SUPABASE_ANON_KEY},
    body:JSON.stringify({messages:AI.msgs,context:{nome:firstName(),
      hoje:new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}})});
  if(!res.ok){let m='';try{m=(await res.json()).message;}catch(e){}
    throw new Error(m||(res.status===401?'Faça login de novo para usar o assistente.':'Não consegui falar com o assistente agora.'));}
  const rd=res.body.getReader(),dec=new TextDecoder();let buf='',done=null;
  for(;;){
    const{value,done:end}=await rd.read();if(end)break;
    buf+=dec.decode(value,{stream:true});
    let p;while((p=buf.indexOf('\n\n'))>=0){
      const line=buf.slice(0,p).trim();buf=buf.slice(p+2);
      if(!line.startsWith('data:'))continue;
      const ev=JSON.parse(line.slice(5));
      if(ev.t==='text')onText(ev.d);
      else if(ev.t==='done')done=ev;
      else if(ev.t==='error')throw new Error(ev.message);
    }
  }
  if(!done)throw new Error('A resposta veio incompleta. Tenta de novo?');
  return done;
}

async function aiAsk(q){
  q=(q||'').trim();if(!q||AI.busy)return;
  if(!navigator.onLine){toast('Sem internet: o assistente precisa de conexão.','error');return;}
  if(AI.msgs.length>=AI_MAX_MSGS){AI.msgs=[];AI.view.push({r:'sep'});}
  AI.busy=true;
  const snap=AI.msgs.length;
  AI.msgs.push({role:'user',content:[{type:'text',text:q}]});
  AI.view.push({r:'u',text:q});
  const cur={r:'a',text:'',status:'Pensando'};AI.view.push(cur);
  aiRender();
  try{
    let ok=false;
    for(let step=0;step<8;step++){
      const r=await aiCall(d=>{cur.text+=d;cur.status='';aiRenderLast(cur);});
      const uses=(r.content||[]).filter(b=>b.type==='tool_use');
      if(r.stop_reason==='tool_use'&&uses.length){
        AI.msgs.push({role:'assistant',content:r.content});
        cur.status=AI_TOOL_LABEL[uses[0].name]||'Consultando seus dados';
        if(cur.text&&!/\n$/.test(cur.text))cur.text+='\n\n';
        aiRenderLast(cur);
        AI.msgs.push({role:'user',content:uses.map(u=>({type:'tool_result',tool_use_id:u.id,
          content:JSON.stringify(aiRunTool(u.name,u.input))}))});
        continue;
      }
      if(uses.length)throw new Error('A resposta veio cortada. Tenta de novo?'); // tool_use truncado (max_tokens)
      AI.msgs.push({role:'assistant',content:r.content});
      if(r.stop_reason==='refusal')cur.text+=(cur.text?'\n\n':'')+'Essa eu prefiro não responder. Posso ajudar com alguma coisa das suas finanças?';
      else if(r.stop_reason==='max_tokens')cur.text+=' …';
      if(!cur.text.trim())cur.text='Hmm, fiquei sem palavras. Pode perguntar de outro jeito?';
      ok=true;break;
    }
    if(!ok)throw new Error('Essa deu muito trabalho e eu me perdi. Pode perguntar de um jeito mais simples?');
    cur.status='';
  }catch(e){
    AI.msgs.length=snap;            // desfaz a pergunta no histórico da IA (fica só na tela)
    AI.view.pop();AI.view.push({r:'e',text:e.message||'Não consegui responder agora.',q});
  }
  AI.busy=false;aiSave();aiRender();
}
function aiRetry(i){const v=AI.view[i];if(!v||AI.busy)return;AI.view.splice(i,1);const q=v.q;
  if(AI.view.length&&AI.view[AI.view.length-1].r==='u'&&AI.view[AI.view.length-1].text===q)AI.view.pop();aiAsk(q);}

// ============================================================
//  INTERFACE
// ============================================================
function aiMd(s){
  const lines=escHTML(s).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').split('\n');
  let out='',list=false;
  lines.forEach(l=>{
    const m=/^\s*(?:[-•*]|\d+[.)])\s+(.*)$/.exec(l);
    if(m){if(!list){out+='<ul>';list=true;}out+='<li>'+m[1]+'</li>';return;}
    if(list){out+='</ul>';list=false;}
    out+=l.trim()?'<p>'+l+'</p>':'';
  });
  if(list)out+='</ul>';
  return out;
}
function aiBubble(v,i){
  if(v.r==='sep')return`<div class="ai-sep">nova conversa · o assistente não lembra do que está acima</div>`;
  if(v.r==='u')return`<div class="ai-msg u"><div class="ai-b">${escHTML(v.text)}</div></div>`;
  if(v.r==='e')return`<div class="ai-msg a err"><img class="ai-av" src="mascote/preocupado.webp" alt=""><div class="ai-b"><p>${escHTML(v.text)}</p>
    <button class="ai-retry" onclick="aiRetry(${i})">Tentar de novo</button></div></div>`;
  return`<div class="ai-msg a"><img class="ai-av" src="mascote/rosto.webp" alt=""><div class="ai-b">${aiMd(v.text)}${v.status?`<div class="ai-status"><span class="ai-dots"><i></i><i></i><i></i></span>${escHTML(v.status)}…</div>`:''}</div></div>`;
}
function aiRender(){
  const box=document.getElementById('ai-msgs');if(!box)return;
  const name=firstName();
  box.innerHTML=AI.view.length?AI.view.map(aiBubble).join(''):`<div class="ai-hello">
      <img src="mascote/aceno.webp" alt="">
      <div class="ai-hello-t">Oi${name?', '+escHTML(name):''}! Sou o assistente do Numi.</div>
      <div class="ai-hello-s">Pergunte sobre seus gastos, seu mês ou seus objetivos. Eu olho seus lançamentos e te respondo.</div>
      <div class="ai-sugs">${AI_SUGGEST.map(s=>`<button onclick="aiAsk(this.textContent)">${escHTML(s)}</button>`).join('')}</div>
    </div>`;
  const send=document.getElementById('ai-send');if(send)send.disabled=AI.busy;
  document.getElementById('ai-newbtn')?.classList.toggle('hide',!AI.view.length);
  box.scrollTop=box.scrollHeight;
}
function aiRenderLast(v){
  const box=document.getElementById('ai-msgs');if(!box)return;
  const els=box.querySelectorAll('.ai-msg');const el=els[els.length-1];
  if(el)el.outerHTML=aiBubble(v,AI.view.length-1);
  box.scrollTop=box.scrollHeight;
}
function aiOpen(){
  if(!USER)return;
  aiLoad();
  let el=document.getElementById('ai-chat');
  if(!el){
    el=document.createElement('div');el.id='ai-chat';
    el.innerHTML=`<div class="ai-scrim" onclick="aiClose()"></div>
      <section class="ai-panel" role="dialog" aria-label="Assistente do Numi">
        <header class="ai-head">
          <img src="mascote/rosto.webp" alt="">
          <div class="ai-head-t"><b>Assistente</b><span>consulta seus dados para responder</span></div>
          <button id="ai-newbtn" class="ai-hbtn" onclick="aiNew()" title="Nova conversa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 5v14M5 12h14"/></svg></button>
          <button class="ai-hbtn" onclick="aiClose()" title="Fechar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </header>
        <div class="ai-msgs" id="ai-msgs"></div>
        <form class="ai-form" onsubmit="event.preventDefault();const i=document.getElementById('ai-input');const q=i.value;i.value='';i.style.height='';aiAsk(q);">
          <textarea id="ai-input" rows="1" maxlength="1500" placeholder="Pergunte alguma coisa…"
            oninput="this.style.height='';this.style.height=Math.min(this.scrollHeight,120)+'px'"
            onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();this.form.requestSubmit();}"></textarea>
          <button id="ai-send" type="submit" aria-label="Enviar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" width="18" height="18"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        </form>
        <div class="ai-foot">A IA pode errar. Confira os números importantes.</div>
      </section>`;
    document.body.appendChild(el);
  }
  AI.open=true;el.classList.add('open');document.body.classList.add('ai-lock');
  aiRender();
  if(!IS_MOBILE)setTimeout(()=>document.getElementById('ai-input')?.focus(),60);
}
function aiClose(){AI.open=false;document.getElementById('ai-chat')?.classList.remove('open');document.body.classList.remove('ai-lock');}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&AI.open)aiClose();});

function aiMountButton(){
  if(document.getElementById('ai-fab'))return;
  const b=document.createElement('button');b.id='ai-fab';b.className=IS_MOBILE?'m':'d';
  b.setAttribute('aria-label','Abrir o assistente');b.title='Assistente';
  b.innerHTML=`<img src="mascote/rosto.webp" alt="">${IS_MOBILE?'':'<span>Assistente</span>'}`;
  b.onclick=aiOpen;document.body.appendChild(b);
}
// o botão aparece quando o app abre (depois do login)
if(typeof startApp==='function'){const _aiStart=startApp;startApp=function(){const r=_aiStart.apply(this,arguments);try{aiMountButton();}catch(e){}return r;};}

(function(){
  const st=document.createElement('style');st.id='nx-ai-css';
  st.textContent=`
#ai-fab{position:fixed;z-index:60;border:none;cursor:pointer;display:flex;align-items:center;gap:8px;background:#fffefb;
  box-shadow:0 6px 22px rgba(42,34,24,.18),0 0 0 1px #ddd5c5;transition:transform .15s,box-shadow .15s;font-family:'Plus Jakarta Sans',sans-serif;}
#ai-fab img{width:40px;height:40px;object-fit:contain;}
#ai-fab:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(42,34,24,.22),0 0 0 1px #1b854f;}
#ai-fab.d{right:24px;bottom:24px;border-radius:999px;padding:6px 18px 6px 8px;font-weight:700;color:#1b854f;font-size:14px;}
#ai-fab.m{right:18px;bottom:140px;width:52px;height:52px;border-radius:16px;justify-content:center;padding:0;}
#ai-fab.m img{width:42px;height:42px;}
body.ai-lock #ai-fab{display:none;}
#ai-chat{position:fixed;inset:0;z-index:400;pointer-events:none;}
#ai-chat.open{pointer-events:auto;}
.ai-scrim{position:absolute;inset:0;background:rgba(42,34,24,.35);opacity:0;transition:opacity .2s;}
#ai-chat.open .ai-scrim{opacity:1;}
.ai-panel{position:absolute;top:0;right:0;bottom:0;width:min(440px,100%);background:#f7f3ec;display:flex;flex-direction:column;
  transform:translateX(100%);transition:transform .25s cubic-bezier(.2,.8,.2,1);box-shadow:-10px 0 40px rgba(42,34,24,.18);}
#ai-chat.open .ai-panel{transform:none;}
.ai-head{display:flex;align-items:center;gap:10px;padding:14px 14px 12px 16px;padding-top:max(14px,env(safe-area-inset-top));background:#1b854f;color:#fff;}
.ai-head img{width:40px;height:40px;object-fit:contain;background:rgba(255,255,255,.14);border-radius:12px;padding:2px;}
.ai-head-t{flex:1;display:flex;flex-direction:column;line-height:1.2;}
.ai-head-t b{font-family:var(--font-display);font-variation-settings:var(--font-display-vars);font-weight:700;font-size:18px;}
.ai-head-t span{font-size:12px;opacity:.8;}
.ai-hbtn{width:36px;height:36px;border-radius:11px;border:none;background:rgba(255,255,255,.14);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.ai-hbtn:hover{background:rgba(255,255,255,.24);}
.ai-hbtn.hide{display:none;}
.ai-msgs{flex:1;overflow-y:auto;padding:16px 14px 8px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain;}
.ai-msg{display:flex;gap:8px;align-items:flex-end;max-width:100%;}
.ai-msg.u{justify-content:flex-end;}
.ai-av{width:30px;height:30px;object-fit:contain;flex-shrink:0;}
.ai-b{padding:10px 13px;border-radius:16px;font-size:14.5px;line-height:1.5;color:#2a2218;max-width:85%;overflow-wrap:anywhere;}
.ai-msg.u .ai-b{background:#1b854f;color:#fff;border-bottom-right-radius:5px;white-space:pre-wrap;}
.ai-msg.a .ai-b{background:#fffefb;border:1px solid #e6dfd2;border-bottom-left-radius:5px;}
.ai-msg.err .ai-b{border-color:#e9c4b8;background:#fdf3ef;}
.ai-b p{margin:0 0 6px;}.ai-b p:last-child{margin-bottom:0;}
.ai-b ul{margin:4px 0 8px;padding-left:18px;}.ai-b li{margin:2px 0;}
.ai-b b{font-weight:700;}
.ai-status{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#8a7f70;margin-top:2px;}
.ai-dots{display:inline-flex;gap:3px;}
.ai-dots i{width:5px;height:5px;border-radius:50%;background:#1b854f;animation:aiDot 1s infinite ease-in-out;}
.ai-dots i:nth-child(2){animation-delay:.15s}.ai-dots i:nth-child(3){animation-delay:.3s}
@keyframes aiDot{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}
.ai-retry{margin-top:8px;border:1px solid #1b854f;color:#1b854f;background:none;border-radius:10px;padding:6px 12px;font-weight:600;cursor:pointer;font-family:inherit;font-size:13px;}
.ai-sep{text-align:center;font-size:11.5px;color:#8a7f70;padding:4px 0;border-top:1px dashed #ddd5c5;margin-top:4px;}
.ai-hello{margin:auto 0;text-align:center;padding:12px 6px;}
.ai-hello img{width:110px;height:auto;animation:mWave 2.4s ease-in-out infinite;transform-origin:50% 100%;}
.ai-hello-t{font-family:var(--font-display);font-variation-settings:var(--font-display-vars);font-weight:700;font-size:20px;color:#2a2218;margin:8px 0 4px;}
.ai-hello-s{font-size:14px;color:#6b6152;line-height:1.45;max-width:320px;margin:0 auto;}
.ai-sugs{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px;}
.ai-sugs button{border:1px solid #cfe3d6;background:#fffefb;color:#1b854f;border-radius:999px;padding:8px 13px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;}
.ai-sugs button:hover{background:#eef6f0;}
.ai-form{display:flex;gap:8px;align-items:flex-end;padding:10px 12px 6px;background:#fffefb;border-top:1px solid #e6dfd2;}
.ai-form textarea{flex:1;resize:none;border:1px solid #ddd5c5;border-radius:14px;padding:10px 12px;font:inherit;font-size:15px;line-height:1.4;max-height:120px;background:#fff;color:#2a2218;outline:none;}
.ai-form textarea:focus{border-color:#1b854f;box-shadow:0 0 0 3px rgba(27,133,79,.12);}
.ai-form button{width:42px;height:42px;border-radius:13px;border:none;background:#1b854f;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.ai-form button:disabled{opacity:.45;cursor:default;}
.ai-foot{font-size:11px;color:#a0957f;text-align:center;padding:2px 12px 10px;padding-bottom:max(10px,env(safe-area-inset-bottom));background:#fffefb;}
@media (max-width:767px){.ai-panel{width:100%;box-shadow:none;}}
@media (prefers-reduced-motion:reduce){.ai-panel,.ai-scrim{transition:none}.ai-hello img,.ai-dots i{animation:none}}
`;
  document.head.appendChild(st);
})();
