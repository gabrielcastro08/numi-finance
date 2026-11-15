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
const AI_CONV_VER=3; // sobe quando as ferramentas mudam: conversas antigas recomeçam
const AI_SUGGEST=['Como foi meu mês?','Onde estou gastando mais?','Lança 45 reais de farmácia hoje','Quanto custa uma viagem de 7 dias pro Chile em julho?'];
const AI_TOOL_LABEL={resumo_financeiro:'Olhando seu panorama',buscar_lancamentos:'Procurando lançamentos',
  gastos_por_categoria:'Somando as categorias',objetivos:'Conferindo seus objetivos'};

// ---------- persistência (por usuário, só neste aparelho) ----------
const _aiKey=()=>'numi-ai-'+(USER?.id||'anon');
function aiLoad(){
  try{const o=JSON.parse(localStorage.getItem(_aiKey())||'null');
    if(o&&o.ver===AI_CONV_VER&&Date.now()-(o.last||0)<AI_IDLE_RESET){AI.msgs=o.msgs||[];AI.view=(o.view||[]).map(v=>v.r==='card'&&v.state==='pending'?{...v,state:'cancel',edit:null}:v);AI.last=o.last;}
    else{AI.msgs=[];AI.view=[];}
  }catch(e){AI.msgs=[];AI.view=[];}
}
function aiSave(){AI.last=Date.now();try{localStorage.setItem(_aiKey(),JSON.stringify({ver:AI_CONV_VER,msgs:AI.msgs,view:AI.view,last:AI.last}));}catch(e){}}
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
    ano_atual:{receitas:_r2(anoR),despesas:_r2(anoD),saldo:_r2(anoR-anoD)},
    meta_de_economia:aiMeta(),
    limites_por_categoria:limites,
    recorrentes:recs,
    parcelas_futuras:{total:_r2(sumV(futuras)),por_mes:Object.entries(porMes).map(([k,v])=>({mes:k,valor:_r2(v)}))},
    categorias:{despesa:state.categories.despesa,receita:state.categories.receita},
    meios_de_pagamento:state.categories.meio||[],
  };
}

// meta de economia (1.9): nenhuma, valor até uma data, ou valor por mês
function aiMeta(){
  if(typeof goalCalc!=='function')return null;
  const g=goalCalc();
  if(g.mode==='nenhuma'||!(g.goal>0))return{tipo:'sem meta (só controle)',guardado_desde_o_inicio:_r2(g.saved),inicio:g.startLabel};
  if(g.mode==='mensal')return{tipo:'guardar um valor por mês',valor_por_mes:_r2(g.goal),guardado_este_mes:_r2(g.saved),
    falta_este_mes:_r2(g.rem),meses_fechados:g.am,meses_em_que_bateu:g.hit,media_guardada_por_mes:_r2(g.avg),inicio:g.startLabel};
  return{tipo:'guardar um valor até uma data',valor:_r2(g.goal),data:g.endLabel,inicio:g.startLabel,guardado:_r2(g.saved),
    falta:_r2(g.rem),guardar_por_mes:g.passed?null:_r2(g.per),projecao_na_data:_r2(g.proj),data_ja_passou:!!g.passed};
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
    itens:list.slice(0,lim).map(t=>({id:t.id,data:t.date||null,mes:_kYM(_txK(t)),tipo:t.kind,nome:t.name,valor:_r2(t.value),
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
      return{id:g.id,nome:g.name,icone:g.icon,prioridade:idx+1,status:g.status,valor_estimado:_r2(g.target),
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
//  AÇÕES (1.10): a IA pede, a pessoa confirma num cartão, o app executa
//  Tudo passa pelas funções normais do app (dbOp → fila offline, mesmo banco).
// ============================================================
const AI_READ={resumo_financeiro:1,buscar_lancamentos:1,gastos_por_categoria:1,objetivos:1};
const AI_RT={};   // cartões pendentes: {run, resolve, view}
const AI_UNDO={}; // desfazer das ações confirmadas nesta sessão
const _isoOK=s=>/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))&&!isNaN(new Date(s+'T00:00:00'));
const _num=v=>{const n=Number(v);return isFinite(n)?Math.round(n*100)/100:NaN;};
function _cat(tipo,name){
  const l=state.categories[tipo]||[];const q=normTxt(name);if(!q)return null;
  return l.find(c=>normTxt(c)===q)||l.find(c=>normTxt(c).includes(q)||q.includes(normTxt(c)))||null;
}
function _catOr(tipo,name){const l=state.categories[tipo]||[];return _cat(tipo,name)||l.find(c=>normTxt(c)==='outros')||l[0]||'';}
function _meio(name){const l=state.categories.meio||[];const q=normTxt(name);if(!q)return'';return l.find(c=>normTxt(c)===q)||l.find(c=>normTxt(c).includes(q))||'';}
const _dBR=iso=>iso?fmtDateBR(iso):'sem data';
const _mmY=iso=>({month:+iso.slice(5,7)-1,year:+iso.slice(0,4)});
function _txLine(t){return`${t.name} · ${fmt(t.value)} · ${t.date?fmtDateBR(t.date):MONTHS[t.month]+'/'+t.year}`;}
function _afterChange(){try{rerender();}catch(e){}}

// prepara o cartão de cada ação; devolve {error} quando o pedido é inválido (vira resposta para a IA, sem cartão)
function aiPrepare(name,i){
  i=i&&typeof i==='object'?i:{};
  if(name==='criar_lancamento'){
    const tipo=i.tipo==='receita'?'receita':'despesa';const v=_num(i.valor);
    if(!(v>0))return{error:'valor inválido'};
    const cat=_catOr(tipo,i.categoria);const date=_isoOK(i.data)?i.data:todayISO();
    const n=tipo==='despesa'&&HAS_V13&&parseInt(i.parcelas)>=2?Math.min(72,parseInt(i.parcelas)):0;
    const mode=i.valor_e==='parcela'?'parcela':'total';
    const init={nome:(i.nome||cat||'').trim().slice(0,80),valor:v,categoria:cat,data:date,meio:tipo==='despesa'?_meio(i.meio):'',local:tipo==='despesa'?String(i.local||'').slice(0,80):''};
    const rows=n?[['Parcelado',`${n}x de ${fmt(mode==='total'?v/n:v)}${mode==='total'?'':' (total '+fmt(v*n)+')'}`]]:[];
    if(init.local)rows.push(['Local',init.local]);
    return{ico:tipo==='despesa'?'↓':'↑',title:tipo==='despesa'?'Lançar despesa':'Lançar receita',rows,edit:{tipo,...init},
      run(e){
        if(!(e.valor>0))throw new Error('Informe um valor.');
        if(!_isoOK(e.data))throw new Error('Escolha uma data.');
        const base={name:e.nome||e.categoria,value:e.valor,tag:e.categoria,meio:e.meio,place:init.local,date:e.data,..._mmY(e.data)};
        const made=n?addInstallments(base,n,mode,e.valor):[addTransaction(tipo,base)];
        _afterChange();if(tipo==='despesa')checkBudgetAlert(made[0]);
        return{info:{ok:true,feito:n?`${n} parcelas lançadas`:`${tipo} lançada`,nome:base.name,valor:e.valor,categoria:e.categoria,data:e.data,ids:made.map(t=>t.id)},
          undo(){made.forEach(t=>deleteTransaction(t.kind,t.id));_afterChange();}};
      }};
  }
  if(name==='editar_lancamento'){
    const t=TX_ALL.find(x=>x.id===i.id);if(!t)return{error:'lançamento não encontrado (id inválido)'};
    const f={},rows=[['Lançamento',_txLine(t)]];
    if(i.nome&&i.nome!==t.name){f.name=String(i.nome).slice(0,80);rows.push(['Nome',`${t.name} → ${f.name}`]);}
    if(_num(i.valor)>0&&_num(i.valor)!==t.value){f.value=_num(i.valor);rows.push(['Valor',`${fmt(t.value)} → ${fmt(f.value)}`]);}
    if(i.categoria){const c=_cat(t.kind,i.categoria);if(!c)return{error:'categoria não existe: '+i.categoria};if(c!==t.tag){f.tag=c;rows.push(['Categoria',`${t.tag} → ${c}`]);}}
    if(_isoOK(i.data)&&i.data!==t.date){f.date=i.data;Object.assign(f,_mmY(i.data));rows.push(['Data',`${_dBR(t.date)} → ${fmtDateBR(i.data)}`]);}
    if(i.meio&&t.kind==='despesa'){const m=_meio(i.meio);if(m&&m!==t.meio){f.meio=m;rows.push(['Pagamento',`${t.meio||'—'} → ${m}`]);}}
    if(i.local!=null&&t.kind==='despesa'&&String(i.local)!==t.place){f.place=String(i.local).slice(0,80);rows.push(['Local',`${t.place||'—'} → ${f.place||'—'}`]);}
    if(rows.length===1)return{error:'nada para mudar: os valores pedidos já são os atuais'};
    return{ico:'✏️',title:'Editar lançamento',rows,
      run(){const old={name:t.name,value:t.value,tag:t.tag,meio:t.meio,place:t.place,date:t.date,month:t.month,year:t.year};
        updateTransaction(t.kind,t.id,f);_afterChange();
        return{info:{ok:true,feito:'lançamento editado',id:t.id},undo(){updateTransaction(t.kind,t.id,old);_afterChange();}};}};
  }
  if(name==='excluir_lancamento'){
    const t=TX_ALL.find(x=>x.id===i.id);if(!t)return{error:'lançamento não encontrado (id inválido)'};
    const rows=[['Lançamento',_txLine(t)],['Categoria',t.tag]];if(t.itot)rows.push(['Parcela',`${t.ino}/${t.itot} (só esta)`]);
    return{ico:'🗑️',title:'Excluir lançamento',rows,danger:true,
      run(){const saved={...t};deleteTransaction(t.kind,t.id);_afterChange();
        return{info:{ok:true,feito:'lançamento excluído'},undo(){addTransaction(saved.kind,saved);_afterChange();}};}};
  }
  if(name==='criar_objetivo'){
    if(typeof HAS_GOALS==='undefined'||!HAS_GOALS)return{error:'a área de objetivos não está disponível'};
    const plan=(Array.isArray(i.orcamento)?i.orcamento:[]).map(x=>({label:String(x?.item||'').trim().slice(0,60),amount:_num(x?.valor)}))
      .filter(x=>x.label&&x.amount>0).slice(0,30);
    const planTot=plan.reduce((a,x)=>a+x.amount,0);
    const v=_num(i.valor)>0?_num(i.valor):Math.round(planTot*100)/100;if(!(v>0))return{error:'valor inválido'};
    const nome=String(i.nome||'').trim().slice(0,80);if(!nome)return{error:'falta o nome'};
    const date=_isoOK(i.data)?i.data:null;const ja=_num(i.ja_guardado)>0?_num(i.ja_guardado):0;
    const icon=(String(i.icone||'').trim().slice(0,8))||'🎯';const notes=String(i.notas||'').slice(0,2000);
    const rows=[['Valor estimado',fmt(v)],['Quando',date?fmtDateBR(date):'sem data']];if(ja)rows.push(['Já guardado',fmt(ja)]);
    plan.forEach(x=>rows.push(['· '+x.label,fmt(x.amount)]));
    return{ico:icon,title:'Criar objetivo: '+nome,rows,
      run(){const g=addGoal({name:nome,icon,target:v,target_date:date,plan,notes});if(ja)addGoalMove(g.id,ja,todayISO(),'Já guardado');_afterChange();
        return{info:{ok:true,feito:'objetivo criado',id:g.id},undo(){state.goals=state.goals.filter(x=>x.id!==g.id);state.goalMoves=state.goalMoves.filter(m=>m.goal_id!==g.id);
          dbOp({t:'goals',k:'delete',id:g.id});_afterChange();}};}};
  }
  if(name==='movimentar_objetivo'){
    if(typeof HAS_GOALS==='undefined'||!HAS_GOALS)return{error:'a área de objetivos não está disponível'};
    const g=goalById(i.objetivo_id)||state.goals.find(x=>normTxt(x.name)===normTxt(i.objetivo_id));if(!g)return{error:'objetivo não encontrado'};
    const v=_num(i.valor);if(!(v>0))return{error:'valor inválido'};
    const out=i.operacao==='retirar';const saved=goalSaved(g.id);
    if(out&&v>saved+0.001)return{error:`só há ${fmt(saved)} guardado nesse objetivo`};
    const rows=[['Valor',fmt(v)],['Guardado depois',fmt(saved+(out?-v:v))+' de '+fmt(g.target)]];if(i.nota)rows.push(['Nota',String(i.nota).slice(0,200)]);
    return{ico:g.icon,title:(out?'Retirar de ':'Guardar em ')+g.name,rows,
      run(){const m=addGoalMove(g.id,out?-v:v,todayISO(),String(i.nota||'').slice(0,200));_afterChange();
        return{info:{ok:true,feito:out?'valor retirado':'valor guardado',guardado_agora:_r2(goalSaved(g.id))},
          undo(){state.goalMoves=state.goalMoves.filter(x=>x.id!==m.id);dbOp({t:'goal_moves',k:'delete',id:m.id});_afterChange();}};}};
  }
  if(name==='criar_recorrente'){
    const tipo=i.tipo==='receita'?'receita':'despesa';const v=Math.max(0,_num(i.valor)||0);
    const nome=String(i.nome||'').trim().slice(0,80);if(!nome)return{error:'falta o nome'};
    const cat=_catOr(tipo,i.categoria);const dia=parseInt(i.dia)>=1&&parseInt(i.dia)<=31?parseInt(i.dia):null;const meio=tipo==='despesa'?_meio(i.meio):'';
    const rows=[['Tipo',tipo],['Valor',v>0?fmt(v):'variável'],['Categoria',cat]];if(dia)rows.push(['Dia',String(dia)]);if(meio)rows.push(['Pagamento',meio]);
    return{ico:'🔁',title:'Nova recorrente: '+nome,rows,
      run(){const r=addRecorrente({type:tipo,name:nome,value:v,tag:cat,meio,day:dia});_afterChange();
        return{info:{ok:true,feito:'recorrente criada',id:r.id},undo(){deleteRecorrente(r.id);_afterChange();}};}};
  }
  if(name==='definir_limite'){
    if(!HAS_V13)return{error:'limites não disponíveis'};
    const c=_cat('despesa',i.categoria);if(!c)return{error:'categoria de despesa não encontrada: '+i.categoria};
    const v=Math.max(0,_num(i.valor)||0);const old=state.limits[c]||0;
    return{ico:'🎯',title:'Limite de '+c,rows:[['Limite mensal',`${old?fmt(old):'sem limite'} → ${v?fmt(v):'sem limite'}`]],
      run(){setCategoryLimit(c,v);_afterChange();return{info:{ok:true,feito:v?'limite definido':'limite removido'},undo(){setCategoryLimit(c,old);_afterChange();}};}};
  }
  return{error:'ação desconhecida: '+name};
}

// cria o cartão na conversa; a promessa resolve quando a pessoa confirma ou cancela
function aiMakeCard(u){
  const p=aiPrepare(u.name,u.input);
  if(p.error)return{error:p.error};
  const id=u.id;
  const view={r:'card',id,ico:p.ico,title:p.title,rows:p.rows||[],edit:p.edit||null,danger:!!p.danger,state:'pending',note:''};
  const promise=new Promise(resolve=>{AI_RT[id]={run:p.run,resolve,view};});
  return{view,promise};
}
function _cardEdits(v){
  if(!v.edit)return null;const g=k=>document.getElementById(`aif-${k}-${v.id}`);
  return{nome:(g('n')?.value||'').trim().slice(0,80),valor:moneyVal(g('v')),categoria:g('c')?.value||v.edit.categoria,
    data:g('d')?.value||'',meio:g('m')?g('m').value:''};
}
function aiCardOk(id){
  const rt=AI_RT[id];if(!rt)return;const v=rt.view;
  try{
    const e=_cardEdits(v);
    const res=rt.run(e||{});
    if(e){v.rows=[['Valor',fmt(e.valor)],['Categoria',e.categoria],['Data',fmtDateBR(e.data)]].concat(e.meio?[['Pagamento',e.meio]]:[]).concat(v.rows);
      v.title=(v.edit.tipo==='despesa'?'Despesa: ':'Receita: ')+(e.nome||e.categoria);v.edit=null;}
    v.state='ok';v.note='';AI_UNDO[id]=res.undo;delete AI_RT[id];
    aiRenderCard(v);rt.resolve(res.info);
  }catch(err){v.note=err.message||'Não deu certo.';aiRenderCard(v,true);}
}
function aiCardNo(id){
  const rt=AI_RT[id];if(!rt)return;const v=rt.view;v.state='cancel';v.edit=null;delete AI_RT[id];
  aiRenderCard(v);rt.resolve({ok:false,cancelado:true,mensagem:'A pessoa cancelou no cartão; nada foi feito.'});
}
function aiCardUndo(id){
  const fn=AI_UNDO[id];if(!fn)return;delete AI_UNDO[id];
  try{fn();}catch(e){}
  const v=AI.view.find(x=>x.r==='card'&&x.id===id);if(v){v.state='undone';aiRenderCard(v);aiSave();}
  toast('Desfeito','success');
}
function aiCardHTML(v){
  const opt=(l,sel)=>l.map(x=>`<option${x===sel?' selected':''}>${escHTML(x)}</option>`).join('');
  let body='';
  if(v.state==='pending'&&v.edit){
    const e=v.edit;
    body=`<div class="ai-card-f">
      <label class="w">Descrição<input id="aif-n-${v.id}" value="${escHTML(e.nome)}" maxlength="80"></label>
      <label>Valor<input id="aif-v-${v.id}" data-money inputmode="numeric" value="${moneyAttr(e.valor)}"></label>
      <label>Data<input id="aif-d-${v.id}" type="date" value="${e.data}"></label>
      <label${e.tipo==='despesa'?'':' class="w"'}>Categoria<select id="aif-c-${v.id}">${opt(state.categories[e.tipo]||[],e.categoria)}</select></label>
      ${e.tipo==='despesa'?`<label>Pagamento<select id="aif-m-${v.id}"><option value="">—</option>${opt(state.categories.meio||[],e.meio)}</select></label>`:''}
    </div>`;
  }
  const rows=v.rows.length?`<div class="ai-card-rows">${v.rows.map(([k,x])=>`<div><span>${escHTML(k)}</span><b>${escHTML(x)}</b></div>`).join('')}</div>`:'';
  const foot=v.state==='pending'?`<div class="ai-card-btns"><button class="no" onclick="aiCardNo('${v.id}')">Cancelar</button><button class="ok${v.danger?' danger':''}" onclick="aiCardOk('${v.id}')">${v.danger?'Excluir':'Confirmar'}</button></div>`
    :v.state==='ok'?`<div class="ai-card-st ok"><img src="mascote/joinha.webp" alt="" class="ai-card-ok-img">Feito${AI_UNDO[v.id]?` <button onclick="aiCardUndo('${v.id}')">Desfazer</button>`:''}</div>`
    :v.state==='undone'?`<div class="ai-card-st">Desfeito</div>`:`<div class="ai-card-st">Cancelado</div>`;
  return`<div class="ai-card st-${v.state}" id="aic-${v.id}"><div class="ai-card-h"><span class="ai-card-ico">${escHTML(v.ico||'')}</span><b>${escHTML(v.title)}</b></div>
    ${body}${rows}${v.note?`<div class="ai-card-err">${escHTML(v.note)}</div>`:''}${foot}</div>`;
}
function aiRenderCard(v,keepInputs){
  const el=document.getElementById('aic-'+v.id);if(!el)return;
  if(keepInputs){const n=el.querySelector('.ai-card-err');const h=`<div class="ai-card-err">${escHTML(v.note)}</div>`;
    if(n)n.outerHTML=h;else el.querySelector('.ai-card-btns').insertAdjacentHTML('beforebegin',h);return;}
  el.outerHTML=aiCardHTML(v);
}

// ============================================================
//  CONVERSA (loop: IA → ferramentas no app → IA ...)
// ============================================================
async function aiCall(onText,onStatus){
  const{data:{session}}=await sb.auth.getSession();
  const res=await fetch(AI_URL,{method:'POST',headers:{'Content-Type':'application/json',
      Authorization:'Bearer '+(session?.access_token||''),apikey:SUPABASE_ANON_KEY},
    body:JSON.stringify({messages:AI.msgs,context:{nome:firstName(),
      hoje:new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}})});
  if(!res.ok){let m='';try{m=(await res.json()).message;}catch(e){}
    throw new Error(m||(res.status===401?'Faça login de novo para falar com o Numi.':'Não consegui responder agora. Tenta de novo daqui a pouco.'));}
  const rd=res.body.getReader(),dec=new TextDecoder();let buf='',done=null;
  for(;;){
    const{value,done:end}=await rd.read();if(end)break;
    buf+=dec.decode(value,{stream:true});
    let p;while((p=buf.indexOf('\n\n'))>=0){
      const line=buf.slice(0,p).trim();buf=buf.slice(p+2);
      if(!line.startsWith('data:'))continue;
      const ev=JSON.parse(line.slice(5));
      if(ev.t==='text')onText(ev.d);
      else if(ev.t==='status'&&onStatus)onStatus(ev.d);
      else if(ev.t==='done')done=ev;
      else if(ev.t==='error')throw new Error(ev.message);
    }
  }
  if(!done)throw new Error('A resposta veio incompleta. Tenta de novo?');
  return done;
}

async function aiAsk(q){
  q=(q||'').trim();if(!q||AI.busy)return;
  if(!navigator.onLine){toast('Sem internet: o Numi precisa de conexão para conversar.','error');return;}
  if(AI.msgs.length>=AI_MAX_MSGS){AI.msgs=[];AI.view.push({r:'sep'});}
  AI.busy=true;
  const snap=AI.msgs.length,vsnap=AI.view.length;
  AI.msgs.push({role:'user',content:[{type:'text',text:q}]});
  AI.view.push({r:'u',text:q});
  let cur={r:'a',text:'',status:'Pensando'};AI.view.push(cur);
  aiRender();
  try{
    let ok=false;
    for(let step=0;step<14;step++){
      const r=await aiCall(d=>{cur.text+=d;cur.status='';aiRenderLast(cur);},
        st=>{cur.status=st;if(cur.text&&!/\n$/.test(cur.text))cur.text+='\n\n';aiRenderLast(cur);});
      aiAddSources(cur,r.content);
      if(r.stop_reason==='pause_turn'){   // a busca na web ainda não terminou: reenvia para continuar
        AI.msgs.push({role:'assistant',content:r.content});cur.status=cur.status||'Pesquisando na internet';aiRenderLast(cur);continue;}
      const uses=(r.content||[]).filter(b=>b.type==='tool_use');
      if(r.stop_reason==='tool_use'&&uses.length){
        AI.msgs.push({role:'assistant',content:r.content});
        const res={};
        uses.filter(u=>AI_READ[u.name]).forEach(u=>{res[u.id]=aiRunTool(u.name,u.input);});
        const writes=uses.filter(u=>!AI_READ[u.name]);
        if(writes.length){
          // ações: mostra os cartões e espera a pessoa decidir cada um
          cur.status='';if(!cur.text.trim())AI.view.splice(AI.view.indexOf(cur),1);
          const waits=[];
          writes.forEach(u=>{const c=aiMakeCard(u);
            if(c.error){res[u.id]={ok:false,erro:c.error};return;}
            AI.view.push(c.view);waits.push(c.promise.then(x=>{res[u.id]=x;}));});
          aiRender();
          await Promise.all(waits);
          cur={r:'a',text:'',status:'Pensando'};AI.view.push(cur);aiRender();
        }else{
          cur.status=AI_TOOL_LABEL[uses[0].name]||'Consultando seus dados';
          if(cur.text&&!/\n$/.test(cur.text))cur.text+='\n\n';
          aiRenderLast(cur);
        }
        AI.msgs.push({role:'user',content:uses.map(u=>({type:'tool_result',tool_use_id:u.id,content:JSON.stringify(res[u.id]??{ok:false,erro:'sem resultado'})}))});
        continue;
      }
      if(uses.length)throw new Error('A resposta veio cortada. Tenta de novo?'); // tool_use truncado (max_tokens)
      AI.msgs.push({role:'assistant',content:r.content});
      if(r.stop_reason==='refusal')cur.text+=(cur.text?'\n\n':'')+'Essa eu prefiro não responder. Posso ajudar com alguma coisa das suas finanças?';
      else if(r.stop_reason==='max_tokens')cur.text+=' …';
      if(!cur.text.trim()){if(AI.view[AI.view.length-2]?.r==='card')AI.view.pop();else cur.text='Hmm, fiquei sem palavras. Pode perguntar de outro jeito?';}
      ok=true;break;
    }
    if(!ok)throw new Error('Essa deu muito trabalho e eu me perdi. Pode perguntar de um jeito mais simples?');
    cur.status='';
  }catch(e){
    AI.msgs.length=snap;            // desfaz a pergunta no histórico da IA (fica só na tela)
    Object.keys(AI_RT).forEach(id=>{delete AI_RT[id];});
    const keep=AI.view.slice(vsnap+1).filter(v=>v.r==='card'&&v.state==='ok');  // ações já feitas continuam visíveis
    AI.view.length=vsnap+1;AI.view.push(...keep,{r:'e',text:e.message||'Não consegui responder agora.',q});
  }
  AI.busy=false;aiSave();aiRender();
}
// fontes citadas nas respostas com pesquisa (só links http/https)
function aiAddSources(cur,content){
  (content||[]).forEach(b=>(b.type==='text'&&Array.isArray(b.citations)?b.citations:[]).forEach(c=>{
    const url=String(c?.url||'');if(!/^https?:\/\//i.test(url))return;
    cur.sources=cur.sources||[];if(cur.sources.some(x=>x.url===url)||cur.sources.length>=6)return;
    cur.sources.push({url,title:String(c.title||'').slice(0,90)});}));
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
  if(v.r==='sep')return`<div class="ai-sep">nova conversa · o Numi não lembra do que está acima</div>`;
  if(v.r==='card')return aiCardHTML(v);
  if(v.r==='u')return`<div class="ai-msg u"><div class="ai-b">${escHTML(v.text)}</div></div>`;
  if(v.r==='e')return`<div class="ai-msg a err"><img class="ai-av" src="mascote/preocupado.webp" alt=""><div class="ai-b"><p>${escHTML(v.text)}</p>
    <button class="ai-retry" onclick="aiRetry(${i})">Tentar de novo</button></div></div>`;
  return`<div class="ai-msg a"><img class="ai-av" src="mascote/${v.status?'pensando':'rosto'}.webp" alt=""><div class="ai-b">${aiMd(v.text)}${v.sources?.length&&!v.status?`<div class="ai-src"><span>Fontes</span>${v.sources.map(x=>{let h='';try{h=new URL(x.url).hostname.replace(/^www\./,'');}catch(e){}
    return`<a href="${escHTML(x.url)}" target="_blank" rel="noopener noreferrer" title="${escHTML(x.title)}">${escHTML(h||x.title)}</a>`;}).join('')}</div>`:''}${v.status?`<div class="ai-status"><span class="ai-dots"><i></i><i></i><i></i></span>${escHTML(v.status)}…</div>`:''}</div></div>`;
}
function aiRender(){
  const box=document.getElementById('ai-msgs');if(!box)return;
  const name=firstName();
  box.innerHTML=AI.view.length?AI.view.map(aiBubble).join(''):`<div class="ai-hello">
      <img src="mascote/aceno.webp" alt="">
      <div class="ai-hello-t">Oi${name?', '+escHTML(name):''}! Eu sou o Numi.</div>
      <div class="ai-hello-s">Pergunte sobre seu mês, seus gastos ou seus objetivos. Também lanço, edito e crio coisas pra você (você confirma antes), e pesquiso na internet para planejar viagens e compras.</div>
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
  if(!AI.busy)aiLoad();
  let el=document.getElementById('ai-chat');
  if(!el){
    el=document.createElement('div');el.id='ai-chat';
    el.innerHTML=`<div class="ai-scrim" onclick="aiClose()"></div>
      <section class="ai-panel" role="dialog" aria-label="Conversa com o Numi">
        <header class="ai-head">
          <img src="mascote/rosto.webp" alt="">
          <div class="ai-head-t"><b>Numi</b><span>seu castor das finanças</span></div>
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
  b.setAttribute('aria-label','Conversar com o Numi');b.title='Conversar com o Numi';
  b.innerHTML=`<img src="mascote/rosto.webp" alt="">${IS_MOBILE?'':'<span>Fale com o Numi</span>'}`;
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
.ai-src{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:8px;padding-top:8px;border-top:1px dashed #ece4d8;}
.ai-src span{font-size:11px;color:#8a7f70;font-weight:700;text-transform:uppercase;letter-spacing:.6px;margin-right:2px;}
.ai-src a{font-size:12px;color:#1b854f;background:#eef6f0;border-radius:999px;padding:3px 9px;text-decoration:none;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ai-src a:hover{background:#dcefe2;}
.ai-card{margin-left:38px;background:#fffefb;border:1.5px solid #cfe3d6;border-radius:16px;padding:12px 13px;font-size:14px;color:#2a2218;box-shadow:0 2px 10px rgba(27,133,79,.07);}
.ai-card.st-cancel,.ai-card.st-undone{opacity:.6;border-color:#e6dfd2;box-shadow:none;}
.ai-card-h{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
.ai-card-h b{font-weight:700;font-size:14.5px;overflow-wrap:anywhere;}
.ai-card-ico{width:28px;height:28px;border-radius:9px;background:#eef6f0;color:#1b854f;display:flex;align-items:center;justify-content:center;font-weight:700;flex-shrink:0;}
.ai-card-f{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;}
.ai-card-f label{display:flex;flex-direction:column;gap:3px;font-size:11.5px;color:#8a7f70;font-weight:600;min-width:0;}
.ai-card-f label.w{grid-column:1/-1;}
.ai-card-f input,.ai-card-f select{border:1px solid #ddd5c5;border-radius:10px;padding:8px 9px;font:inherit;font-size:14px;color:#2a2218;background:#fff;min-width:0;width:100%;}
.ai-card-f input:focus,.ai-card-f select:focus{outline:none;border-color:#1b854f;}
.ai-card-rows div{display:flex;justify-content:space-between;gap:10px;padding:5px 0;border-top:1px dashed #ece4d8;font-size:13px;}
.ai-card-rows span{color:#8a7f70;}.ai-card-rows b{text-align:right;overflow-wrap:anywhere;}
.ai-card-err{color:#b54d3a;font-size:12.5px;margin-top:6px;}
.ai-card-btns{display:flex;gap:8px;margin-top:10px;}
.ai-card-btns button{flex:1;border-radius:11px;padding:9px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;border:1px solid #ddd5c5;background:#fff;color:#6b6152;}
.ai-card-btns .ok{background:#1b854f;border-color:#1b854f;color:#fff;}
.ai-card-btns .ok.danger{background:#b54d3a;border-color:#b54d3a;}
.ai-card-st{margin-top:8px;font-size:13px;color:#8a7f70;font-weight:600;display:flex;align-items:center;gap:8px;}
.ai-card-st.ok{color:#1b854f;}
.ai-card-ok-img{width:26px;height:26px;object-fit:contain;}
.ai-card-st button{border:none;background:none;color:#1b854f;text-decoration:underline;font:inherit;font-weight:600;cursor:pointer;padding:0;}

@media (prefers-reduced-motion:reduce){.ai-panel,.ai-scrim{transition:none}.ai-hello img,.ai-dots i{animation:none}}
`;
  document.head.appendChild(st);
})();
