// ============================================================
//  NUMI 1.7 — OBJETIVOS (caixinhas)
//  Cada objetivo tem valor estimado, data desejada e "caixinha": o dinheiro
//  guardado (+) ou retirado (−) fica em goal_moves. Guardar não é despesa:
//  o dinheiro sai da economia acumulada que o app já calcula.
//  Depende de globals do index.html (state, TX_ALL, dbOp, openPanel, fmt...).
// ============================================================

const GOAL_ICONS=['✈️','🏖️','🏔️','🎒','🗺️','🚗','🏍️','🏠','🛋️','💻','📱','🎧','🎸','📷','🎮','🚲','🎓','💍','👶','🐶','🏥','🛟','📈','🌱','🎉','🎁','⛺','💰'];
const GOAL_PRESETS=[
  {name:'Viagem',icon:'✈️'},{name:'Reserva de emergência',icon:'🛟'},
  {name:'Notebook novo',icon:'💻'},{name:'Curso',icon:'🎓'}];

// ---------- helpers de data ----------
const gNowK=()=>keyOf(CUR_YEAR,CUR_MONTH);
const gKeyISO=iso=>keyOf(+iso.slice(0,4),+iso.slice(5,7)-1);
const gLong=k=>MONTHS[k%12].toLowerCase()+' de '+Math.floor(k/12);
function gMonthsTxt(n){
  if(n<=0)return'este mês';
  const y=Math.floor(n/12),m=n%12;
  const p=[];if(y)p.push(y+(y>1?' anos':' ano'));if(m)p.push(m+(m>1?' meses':' mês'));
  return(n===1?'falta ':'faltam ')+p.join(' e ');
}
function gAddMonthsISO(n){const d=new Date();const t=new Date(d.getFullYear(),d.getMonth()+n,1);return isoOf(t.getFullYear(),t.getMonth(),d.getDate());}

// ---------- dados ----------
const _mapGoal=x=>({id:x.id,name:x.name,icon:x.icon||'🎯',target:Number(x.target),target_date:x.target_date||null,priority:x.priority||0,
  status:x.status||'ativo',plan:Array.isArray(x.plan)?x.plan:[],notes:x.notes||'',created_at:x.created_at||'',done_at:x.done_at||null});
const _mapMove=x=>({id:x.id,goal_id:x.goal_id,amount:Number(x.amount),date:x.date||todayISO(),note:x.note||''});
function _goalRow(g){return{id:g.id,user_id:USER.id,name:g.name,icon:g.icon||null,target:g.target,target_date:g.target_date||null,
  priority:g.priority,status:g.status,plan:g.plan||[],notes:g.notes||null,done_at:g.done_at||null};}
const goalById=id=>state.goals.find(g=>g.id===id);
const goalSaved=id=>state.goalMoves.filter(m=>m.goal_id===id).reduce((s,m)=>s+m.amount,0);
function activeGoals(){return state.goals.filter(g=>g.status!=='concluido')
  .sort((a,b)=>a.priority-b.priority||(a.target_date||'9999').localeCompare(b.target_date||'9999'));}

function addGoal(f){
  const g={id:uuid(),name:f.name,icon:f.icon||'🎯',target:f.target,target_date:f.target_date||null,
    priority:state.goals.reduce((m,x)=>Math.max(m,x.priority),-1)+1,status:'ativo',plan:f.plan||[],notes:f.notes||'',
    created_at:new Date().toISOString(),done_at:null};
  state.goals.push(g);dbOp({t:'goals',k:'upsert',row:_goalRow(g)});return g;
}
function updateGoal(id,fields){
  const g=goalById(id);if(!g)return;Object.assign(g,fields);
  const r=_goalRow(g);delete r.id;delete r.user_id;
  dbOp({t:'goals',k:'update',id,row:r});
}
function addGoalMove(goal_id,amount,date,note){
  const m={id:uuid(),goal_id,amount:Math.round(amount*100)/100,date:date||todayISO(),note:note||''};
  state.goalMoves.push(m);
  dbOp({t:'goal_moves',k:'upsert',row:{id:m.id,user_id:USER.id,goal_id,amount:m.amount,date:m.date,note:m.note||null}});
  return m;
}
function removeGoal(id){
  const g=goalById(id);if(!g)return;const moves=state.goalMoves.filter(m=>m.goal_id===id);
  state.goals=state.goals.filter(x=>x.id!==id);state.goalMoves=state.goalMoves.filter(m=>m.goal_id!==id);
  dbOp({t:'goals',k:'delete',id});
  closePanel();rerender();
  toastUndo(`“${g.name}” excluído`,()=>{
    state.goals.push(g);state.goalMoves.push(...moves);
    dbOp({t:'goals',k:'upsert',row:_goalRow(g)});
    if(moves.length)dbOp({t:'goal_moves',k:'upsert',row:moves.map(m=>({id:m.id,user_id:USER.id,goal_id:m.goal_id,amount:m.amount,date:m.date,note:m.note||null}))});
    rerender();
  });
}
function removeGoalMove(id){
  const m=state.goalMoves.find(x=>x.id===id);if(!m)return;
  state.goalMoves=state.goalMoves.filter(x=>x.id!==id);
  dbOp({t:'goal_moves',k:'delete',id});
  openGoal(m.goal_id);rerender();
  toastUndo('Movimentação excluída',()=>{state.goalMoves.push(m);
    dbOp({t:'goal_moves',k:'upsert',row:{id:m.id,user_id:USER.id,goal_id:m.goal_id,amount:m.amount,date:m.date,note:m.note||null}});
    openGoal(m.goal_id);rerender();});
}

// ---------- cálculos ----------
// economia acumulada (tudo que já aconteceu) e quanto você costuma guardar por mês
function goalBase(){
  const nowK=gNowK();
  const REAL=TX_ALL.filter(t=>t.year*12+t.month<=nowK);
  const acc=sumV(REAL.filter(t=>t.kind==='receita'))-sumV(REAL.filter(t=>t.kind==='despesa'));
  // média dos últimos 6 meses fechados com lançamentos (o mês atual ainda está em andamento)
  const ks=[];for(let k=nowK-6;k<nowK;k++)if(TX_ALL.some(t=>t.year*12+t.month===k))ks.push(k);
  const cap=ks.length?ks.reduce((s,k)=>s+sumV(txByKey(k,'receita'))-sumV(txByKey(k,'despesa')),0)/ks.length:0;
  const allocated=activeGoals().reduce((s,g)=>s+Math.max(0,goalSaved(g.id)),0);
  return{acc,cap,allocated,free:acc-allocated,months:ks.length,nowK};
}
function goalInfo(g,base){
  const nowK=base.nowK;
  const saved=Math.max(0,goalSaved(g.id)),rem=Math.max(0,g.target-saved),pct=Math.min(100,saved/g.target*100);
  const tk=g.target_date?gKeyISO(g.target_date):null;
  const monthsLeft=tk===null?null:tk-nowK;
  // quanto guardar por mês até a data (no mês da data já precisa estar tudo guardado)
  const per=rem<=0?0:tk===null?null:rem/Math.max(1,monthsLeft);
  // ritmo: média do que guardou nos últimos 3 meses (incluindo o atual)
  const recent=state.goalMoves.filter(m=>m.goal_id===g.id&&gKeyISO(m.date)>=nowK-2).reduce((s,m)=>s+m.amount,0);
  const pace=recent>0?recent/3:0;
  const etaK=rem<=0?nowK:pace>0?nowK+Math.ceil(rem/pace):null;
  let st;
  if(g.status==='concluido')st={t:'Realizado 🎉',c:'pos'};
  else if(g.status==='pausado')st={t:'Pausado',c:''};
  else if(rem<=0)st={t:'Pronto para realizar!',c:'pos'};
  else if(tk!==null&&monthsLeft<0)st={t:'A data passou',c:'neg'};
  else if(!pace)st={t:'Comece a guardar',c:'warn'};
  else if(per===null||pace>=per*.95)st={t:'No ritmo',c:'pos'};
  else st={t:'Abaixo do ritmo',c:'warn'};
  return{saved,rem,pct,tk,monthsLeft,per,pace,etaK,st};
}
// visão de conjunto: compromisso mensal × capacidade, saldo projetado e "saldo depois de realizar"
function goalsPlan(){
  const base=goalBase();const act=activeGoals().filter(g=>g.status==='ativo');
  const info=new Map(activeGoals().map(g=>[g.id,goalInfo(g,base)]));
  const commit=act.reduce((s,g)=>s+(info.get(g.id).per||0),0);
  const proj=k=>base.acc+base.cap*(k-base.nowK);
  const dated=act.filter(g=>g.target_date).sort((a,b)=>info.get(a.id).tk-info.get(b.id).tk);
  const after=new Map();let cum=0;
  dated.forEach(g=>{cum+=g.target;after.set(g.id,proj(info.get(g.id).tk)-cum);});
  // sugestão quando não cabe: adiar o objetivo menos prioritário que tenha data
  let tip='';
  const deficit=commit-Math.max(0,base.cap);
  if(deficit>1&&act.length){
    const cand=[...act].reverse().find(g=>(info.get(g.id).per||0)>0);
    if(cand){const i=info.get(cand.id);const np=i.per-deficit;
      if(np>0){const k=base.nowK+Math.ceil(i.rem/np);tip=`Adiar <b>${escHTML(cand.name)}</b> para ${gLong(k)} resolve, ou guarde mais <b>${fmt(deficit)}</b> por mês.`;}
      else tip=`Faltam <b>${fmt(deficit)}</b> por mês: dá para adiar datas ou reduzir valores dos menos prioritários.`;}
  }
  return{base,info,commit,deficit,fits:deficit<=1,after,proj,dated,tip};
}

// ---------- componentes ----------
function goalRing(pct,size,stroke,color){
  const r=(size-stroke)/2,c=2*Math.PI*r,o=c*(1-Math.min(100,Math.max(0,pct))/100),h=size/2;
  return`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="ng-ring"><circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="var(--bg3)" stroke-width="${stroke}"/>`
    +`<circle cx="${h}" cy="${h}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${o.toFixed(1)}" transform="rotate(-90 ${h} ${h})"/></svg>`;
}
const gColor=i=>i.st.c==='neg'?'var(--red)':i.st.c==='warn'?'#c9952e':'var(--green)';
function goalTileHTML(g,i,idx,n){
  const date=g.target_date?`${gLong(i.tk)} · ${gMonthsTxt(i.monthsLeft)}`:'sem data definida';
  const line=g.status==='pausado'?'Pausado — não entra no planejamento':i.rem<=0?'Tudo guardado. Hora de realizar!'
    :i.per!==null?`Guarde <b>${fmt(i.per)}</b>/mês`:i.etaK!==null?`No seu ritmo, chega lá em ${gLong(i.etaK)}`:'Defina uma data para planejar';
  return`<div class="ng-card" onclick="openGoal('${g.id}')">
    <div class="ng-card-top">
      <div class="ng-ring-wrap">${goalRing(i.pct,64,6,gColor(i))}<span>${g.icon}</span></div>
      <div class="ng-card-main"><div class="ng-name">${escHTML(g.name)}</div><div class="ng-date">${date}</div>
        <span class="ng-chip ${i.st.c}">${i.st.t}</span></div>
      <div class="ng-order" onclick="event.stopPropagation()">
        <button ${idx===0?'disabled':''} onclick="moveGoal('${g.id}',-1)" title="Mais prioritário" aria-label="Subir prioridade">▲</button>
        <button ${idx===n-1?'disabled':''} onclick="moveGoal('${g.id}',1)" title="Menos prioritário" aria-label="Descer prioridade">▼</button></div>
    </div>
    <div class="ng-amounts"><b>${fmt(i.saved)}</b> <span>de ${fmt(g.target)}</span><em>${Math.floor(i.pct)}%</em></div>
    <div class="ng-line">${line}</div>
    <div class="ng-card-btns" onclick="event.stopPropagation()">
      <button class="nx-btn primary" onclick="openGoalMove('${g.id}',1)">+ Guardar</button>
      ${i.rem<=0?`<button class="nx-btn" onclick="openGoalDone('${g.id}')">Realizei! 🎉</button>`:`<button class="nx-btn" onclick="openGoal('${g.id}')">Detalhes</button>`}
    </div></div>`;
}
// card resumido para a tela inicial
function goalsHomeCardHTML(){
  if(!HAS_GOALS)return'';
  const act=activeGoals();const nav=IS_MOBILE?"mNav('objetivos')":"showPage('objetivos')";
  if(!act.length)return`<div class="nx-card ng-home-cta" onclick="${nav}"><img src="mascote/vazio.webp" alt=""><div><div class="nx-card-title">Objetivos</div><p class="nx-p">Uma viagem, um notebook, uma reserva… Planeje quanto guardar por mês.</p></div><span class="nx-link">criar ›</span></div>`;
  const base=goalBase();
  return`<div class="nx-card"><div class="nx-card-head"><div class="nx-card-title">Objetivos</div><button class="nx-link" onclick="${nav}">ver todos</button></div>
    ${act.slice(0,3).map(g=>{const i=goalInfo(g,base);return`<div class="ng-mini" onclick="openGoal('${g.id}')"><span class="ng-mini-ico">${g.icon}</span>
      <div class="ng-mini-main"><div class="nx-bar-top"><span class="nx-bar-name">${escHTML(g.name)}</span><span class="nx-bar-val">${Math.floor(i.pct)}%</span></div>
      <div class="nx-bar-track"><div class="nx-bar-fill ${i.st.c==='neg'?'neg':i.st.c==='warn'?'warn':'pos'}" style="width:${i.pct}%"></div></div>
      <div class="ng-mini-sub">${fmt(i.saved)} de ${fmt(g.target)}${i.per?` · ${fmt(i.per)}/mês`:''}</div></div></div>`;}).join('')}</div>`;
}

// ---------- tela ----------
function renderGoals(elId){
  const el=document.getElementById(elId);if(!el)return;
  const head=`<div class="nx-an-head"><div>${IS_MOBILE?'':'<div class="nx-h1">Objetivos</div>'}<div class="nx-sub">O que você quer realizar e quanto guardar para chegar lá</div></div>
    ${HAS_GOALS?`<button class="nx-btn primary ng-new" onclick="openGoalEditor()">+ Novo objetivo</button>`:''}</div>`;
  if(!HAS_GOALS){el.innerHTML=`<div class="nx-an">${head}<div class="nx-card">${mascotEmpty('busca','Objetivos chegam já já','Falta só atualizar o banco de dados para liberar esta área.',110)}</div></div>`;return;}
  const P=goalsPlan();const{base,info}=P;const act=activeGoals();const done=state.goals.filter(g=>g.status==='concluido').sort((a,b)=>(b.done_at||'').localeCompare(a.done_at||''));
  if(!state.goals.length){
    el.innerHTML=`<div class="nx-an">${head}<div class="nx-card ng-empty">${mascotEmpty('vazio','Nenhum objetivo ainda','Uma viagem, um notebook novo, uma reserva de emergência… Cadastre e o Numi calcula quanto guardar por mês.',120)}
      <div class="ng-presets">${GOAL_PRESETS.map((p,k)=>`<button class="nx-chip" onclick="openGoalEditor(null,${k})">${p.icon} ${p.name}</button>`).join('')}</div></div></div>`;return;}
  const capTxt=base.months?`média de ${base.months} ${base.months>1?'meses':'mês'}`:'sem meses fechados ainda';
  let say='';
  if(P.dated.length||act.some(g=>g.status==='ativo')){
    if(base.cap<=0)say=mascotSay({tone:'neg',text:'Nos últimos meses as despesas empataram com as receitas (ou passaram), então ainda não sobra para os objetivos. Começar com um valor pequeno por mês já ajuda.'});
    else if(P.fits)say=mascotSay({tone:'pos',text:`Seus objetivos pedem <b>${fmt(P.commit)}</b> por mês e você costuma guardar <b>${fmt(base.cap)}</b>. Cabe, e ainda sobram <b>${fmt(base.cap-P.commit)}</b>.`});
    else say=mascotSay({tone:'neg',text:`Seus objetivos pedem <b>${fmt(P.commit)}</b> por mês, mas você costuma guardar <b>${fmt(base.cap)}</b>. ${P.tip}`});
  }
  el.innerHTML=`<div class="nx-an">${head}
    <div class="nx-kpis">
      <div class="nx-kpi"><div class="nx-kpi-l">Guardado nos objetivos</div><div class="nx-kpi-v pos">${fmt(base.allocated)}</div></div>
      <div class="nx-kpi" title="Economia acumulada no app (${fmt(base.acc)}) menos o que já está nos objetivos"><div class="nx-kpi-l">Livre para alocar</div><div class="nx-kpi-v ${base.free<0?'neg':''}">${fmt(base.free)}</div><div class="nx-delta">${base.free<0?'mais do que a economia registrada no app':'da economia acumulada'}</div></div>
      <div class="nx-kpi"><div class="nx-kpi-l">Você guarda por mês</div><div class="nx-kpi-v">${fmt(base.cap)}</div><div class="nx-delta">${capTxt}</div></div>
      <div class="nx-kpi"><div class="nx-kpi-l">Objetivos pedem por mês</div><div class="nx-kpi-v ${P.fits?'':'neg'}">${fmt(P.commit)}</div><div class="nx-delta ${P.fits?'pos':'neg'}">${P.fits?'cabe no orçamento':'acima do que você guarda'}</div></div>
    </div>
    ${say?`<div class="ng-say">${say}</div>`:''}
    <div class="ng-grid">${act.map((g,k)=>goalTileHTML(g,info.get(g.id),k,act.length)).join('')}
      <button class="ng-card ng-add" onclick="openGoalEditor()"><span>＋</span>Novo objetivo</button></div>
    ${P.dated.length?`<div class="nx-card" style="margin-top:16px"><div class="nx-card-head"><div class="nx-card-title">Linha do tempo</div><span class="nx-hint">economia projetada, descontando cada objetivo na data</span></div><div class="nx-chart" style="height:${IS_MOBILE?200:250}px"><canvas id="ng-timeline-${elId}"></canvas></div></div>`:''}
    ${done.length?`<div class="nx-card" style="margin-top:16px"><div class="nx-card-head"><div class="nx-card-title">Realizados</div><span class="nx-hint">${done.length}</span></div>
      ${done.map(g=>`<div class="nx-row" onclick="openGoal('${g.id}')"><span class="ng-mini-ico">${g.icon}</span><div class="nx-row-main"><div class="nx-row-name">${escHTML(g.name)}</div><div class="nx-row-sub">${g.done_at?'realizado em '+fmtDateBR(g.done_at.slice(0,10)):'realizado'}</div></div><div class="nx-row-val">${fmt(g.target)}</div></div>`).join('')}</div>`:''}
  </div>`;
  if(P.dated.length)goalsTimeline('ng-timeline-'+elId,P);
}
function goalsTimeline(id,P){
  const{base,info,dated}=P;const k0=base.nowK;
  const kEnd=Math.max(...dated.map(g=>info.get(g.id).tk))+2;
  const keys=[];for(let k=k0;k<=kEnd;k++)keys.push(k);
  const costUntil=k=>dated.reduce((s,g)=>s+(info.get(g.id).tk<=k?g.target:0),0);
  const line=keys.map(k=>Math.round(P.proj(k)-costUntil(k)));
  const PAL=['#2a6f97','#c9952e','#8e5ea2','#c4624f','#3c8d7a','#7a5c3e'];
  const sets=dated.map((g,n)=>{const tk=info.get(g.id).tk;return{type:'line',label:`${g.icon} ${g.name}`,showLine:false,
    data:keys.map(k=>k===tk?line[k-k0]:null),pointRadius:7,pointHoverRadius:9,pointBackgroundColor:PAL[n%PAL.length],pointBorderColor:'#fff',pointBorderWidth:2,
    borderColor:PAL[n%PAL.length],backgroundColor:PAL[n%PAL.length],order:0};});
  nxChart(id,{type:'line',data:{labels:keys.map(keyLabel),datasets:[{label:'Saldo',data:line,borderColor:'#1b854f',backgroundColor:'rgba(27,133,79,.10)',fill:true,borderWidth:2.5,pointRadius:0,tension:.25,order:1,
      segment:{borderColor:c=>c.p1.parsed.y<0?'#c4624f':'#1b854f'}},...sets]},
    options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{display:false}},
      scales:{x:{grid:{display:false},border:{display:false},ticks:{...chTicks,maxRotation:0,autoSkip:true,maxTicksLimit:IS_MOBILE?5:10}},
        y:{grid:{color:'rgba(42,34,24,.06)'},border:{display:false},ticks:{...chTicks,callback:kfmt}}}}});
}
function moveGoal(id,dir){
  const l=activeGoals();const i=l.findIndex(g=>g.id===id);const j=i+dir;if(i<0||j<0||j>=l.length)return;
  [l[i],l[j]]=[l[j],l[i]];
  l.forEach((g,k)=>{if(g.priority!==k){g.priority=k;dbOp({t:'goals',k:'update',id:g.id,row:{priority:k}});}});
  rerender();
}

// ---------- detalhe ----------
function openGoal(id){
  const g=goalById(id);if(!g)return;
  const P=goalsPlan();const i=P.info.get(id)||goalInfo(g,P.base);const after=P.after.get(id);
  const doneG=g.status==='concluido';
  const moves=state.goalMoves.filter(m=>m.goal_id===id).sort((a,b)=>b.date.localeCompare(a.date));
  const planTot=(g.plan||[]).reduce((s,x)=>s+(+x.amount||0),0);
  const simMax=Math.max(100,Math.ceil(Math.max((i.per||0)*2,P.base.cap*1.2,i.pace*2,500)/50)*50);
  const simV=Math.min(simMax,Math.round((i.per||i.pace||Math.max(0,P.base.cap)/2||100)/50)*50);
  openPanel(`<div class="ng-det-head"><div class="ng-ring-wrap big">${goalRing(i.pct,84,7,gColor(i))}<span>${g.icon}</span></div>
      <div style="flex:1;min-width:0"><div class="nx-title" style="margin:0">${escHTML(g.name)}</div>
        <div class="ng-date">${g.target_date?gLong(i.tk)+(doneG?'':' · '+gMonthsTxt(i.monthsLeft)):'sem data definida'}</div><span class="ng-chip ${i.st.c}">${i.st.t}</span></div>
      <button class="nx-link" onclick="openGoalEditor('${id}')">editar</button></div>
    <div class="ng-big"><b>${fmt(i.saved)}</b> de ${fmt(g.target)} <em>${Math.floor(i.pct)}%</em></div>
    ${doneG?'':`<div class="ng-stats">
      <div><span>Faltam</span><b>${fmt(i.rem)}</b></div>
      <div><span>Guardar por mês</span><b>${i.per!==null?fmt(i.per):'—'}</b></div>
      <div><span>Seu ritmo</span><b>${i.pace?fmt(i.pace)+'/mês':'—'}</b></div>
      <div><span>No ritmo, chega em</span><b>${i.etaK!==null?gLong(i.etaK):'—'}</b></div>
      ${after!==undefined?`<div class="wide" title="Economia projetada até a data (média mensal × meses), menos este objetivo e os que vêm antes"><span>Sua economia depois de realizar</span><b class="${after<0?'neg':'pos'}">${fmt(after)}</b></div>`:''}
    </div>
    ${i.rem>0?`<div class="ng-sim"><div class="nx-lbl">E se eu guardar…</div>
      <input type="range" id="gs-range" min="0" max="${simMax}" step="50" value="${simV}" oninput="goalSim('${id}')">
      <div class="ng-sim-out" id="gs-out"></div></div>`:''}`}
    <div class="nx-lbl" style="margin-top:16px">Orçamento detalhado <span class="nx-hint">· opcional — passagens, hospedagem, acessórios…</span></div>
    <div class="ng-plan">${(g.plan||[]).map((x,k)=>`<div class="ng-plan-row"><span>${escHTML(x.label)}</span><b>${fmt(+x.amount||0)}</b><button onclick="goalPlanDel('${id}',${k})" aria-label="Remover item">×</button></div>`).join('')||'<p class="nx-hint" style="margin:2px 0 6px">Nenhum item ainda.</p>'}
      <div class="ng-plan-add"><input class="nx-input" id="gp-label" maxlength="60" placeholder="Item (ex.: passagens)"><input class="nx-input" id="gp-amount" data-money inputmode="numeric" placeholder="R$ 0,00"><button class="nx-btn" onclick="goalPlanAdd('${id}')">Adicionar</button></div>
      ${planTot>0?`<div class="ng-plan-tot">Total: <b>${fmt(planTot)}</b>${Math.abs(planTot-g.target)>0.009&&!doneG?` <button class="nx-link" onclick="updateGoal('${id}',{target:${planTot}});openGoal('${id}');rerender()">usar como valor estimado</button>`:''}</div>`:''}</div>
    ${moves.length?`<div class="nx-lbl" style="margin-top:16px">Movimentações</div><div class="ng-moves">${moves.slice(0,12).map(m=>`<div class="ng-move"><div><b class="${m.amount>0?'pos':'neg'}">${m.amount>0?'+':'−'} ${fmt(Math.abs(m.amount))}</b><span>${fmtDateBR(m.date)}${m.note?' · '+escHTML(m.note):''}</span></div><button onclick="removeGoalMove('${m.id}')" aria-label="Excluir movimentação">×</button></div>`).join('')}</div>`:''}
    ${g.notes?`<div class="nx-lbl" style="margin-top:16px">Anotações</div><p class="nx-p" style="white-space:pre-wrap">${escHTML(g.notes)}</p>`:''}
    <div class="ng-det-btns">
      ${doneG?`<button class="nx-btn" onclick="updateGoal('${id}',{status:'ativo',done_at:null});closePanel();rerender()">Reabrir</button>`
        :`<button class="nx-btn primary" onclick="openGoalMove('${id}',1)">+ Guardar</button>
          ${i.saved>0?`<button class="nx-btn" onclick="openGoalMove('${id}',-1)">Retirar</button>`:''}
          <button class="nx-btn" onclick="openGoalDone('${id}')">Realizei! 🎉</button>`}
    </div>
    <div class="ng-det-btns small">
      ${doneG?'':`<button class="nx-btn ghost" onclick="updateGoal('${id}',{status:'${g.status==='pausado'?'ativo':'pausado'}'});openGoal('${id}');rerender()">${g.status==='pausado'?'Retomar':'Pausar'}</button>`}
      <button class="nx-btn ghost danger-txt" onclick="removeGoal('${id}')">Excluir</button>
      <button class="nx-btn ghost" onclick="closePanel()">Fechar</button></div>`,{wide:true});
  if(document.getElementById('gs-range'))goalSim(id);
}
function goalSim(id){
  const g=goalById(id);const base=goalBase();const i=goalInfo(g,base);
  const v=+document.getElementById('gs-range').value;const out=document.getElementById('gs-out');
  if(!v){out.innerHTML=`<b>R$ 0</b>/mês — assim o objetivo não sai do lugar.`;return;}
  const k=base.nowK+Math.ceil(i.rem/v);
  let cmp='';if(i.tk!==null){const d=i.tk-k;cmp=d>0?` · <span class="pos">${d} ${d>1?'meses':'mês'} antes da data</span>`:d<0?` · <span class="neg">${-d} ${d<-1?'meses':'mês'} depois da data</span>`:' · <span class="pos">bem na data</span>';}
  out.innerHTML=`<b>${fmt(v)}</b>/mês → chega lá em <b>${gLong(k)}</b>${cmp}${base.cap>0?`<small>${Math.round(v/base.cap*100)}% do que você costuma guardar</small>`:''}`;
}
function goalPlanAdd(id){
  const l=document.getElementById('gp-label').value.trim();const a=moneyVal('gp-amount');
  if(!l||!(a>0)){toast('Preencha o item e o valor','error');return;}
  const g=goalById(id);updateGoal(id,{plan:[...(g.plan||[]),{label:l,amount:a}]});openGoal(id);rerender();
}
function goalPlanDel(id,k){const g=goalById(id);const p=[...(g.plan||[])];p.splice(k,1);updateGoal(id,{plan:p});openGoal(id);rerender();}

// ---------- criar / editar ----------
let _ge=null;
function openGoalEditor(id,presetIdx){
  const g=id?goalById(id):null;const pre=presetIdx!=null?GOAL_PRESETS[presetIdx]:null;
  _ge={id:id||null,icon:g?.icon||pre?.icon||'🎯'};
  const quick=[[3,'3 meses'],[6,'6 meses'],[12,'1 ano'],[24,'2 anos']];
  openPanel(`<div class="nx-title">${g?'Editar objetivo':'Novo objetivo'}</div>
    <div class="nx-cat-ed-top"><button type="button" class="nx-cat-ed-ico" id="ge-ico">${_ge.icon}</button>
      <div style="flex:1"><div class="nx-lbl">O que você quer realizar?</div><input class="nx-input" id="ge-name" maxlength="80" value="${escHTML(g?.name||pre?.name||'')}" placeholder="Ex.: Viagem para o Chile"></div></div>
    <div class="nx-emoji-grid ng-emojis">${GOAL_ICONS.map(e=>`<button type="button" class="${e===_ge.icon?'on':''}" onclick="geEmoji('${e}')">${e}</button>`).join('')}</div>
    <div class="ng-form-2">
      <div><div class="nx-lbl">Valor estimado</div><input class="nx-input nx-money-big" id="ge-target" data-money inputmode="numeric" placeholder="R$ 0,00" value="${moneyAttr(g?.target||0)}"></div>
      ${g?'':`<div><div class="nx-lbl">Já tenho guardado <span class="nx-hint">· opcional</span></div><input class="nx-input nx-money-big" id="ge-saved" data-money inputmode="numeric" placeholder="R$ 0,00"></div>`}
    </div>
    <div class="nx-lbl" style="margin-top:14px">Quando? <span class="nx-hint">· opcional, mas é com a data que o Numi calcula quanto guardar por mês</span></div>
    ${dateFieldHTML('ge-date',g?.target_date||'')}
    <div class="ng-quick">${quick.map(([n,l])=>`<button type="button" class="nx-chip" onclick="geQuick(${n})">em ${l}</button>`).join('')}</div>
    <div class="nx-lbl" style="margin-top:14px">Anotações <span class="nx-hint">· opcional</span></div>
    <textarea class="nx-input" id="ge-notes" rows="2" maxlength="2000" placeholder="Ideias, links, detalhes…">${escHTML(g?.notes||'')}</textarea>
    <div style="display:flex;gap:8px;margin-top:16px;"><button class="nx-btn ghost" onclick="${id?`openGoal('${id}')`:'closePanel()'}">Cancelar</button><button class="nx-btn primary" onclick="saveGoalEditor()">${g?'Salvar':'Criar objetivo'}</button></div>`);
  setTimeout(()=>{if(!g)document.getElementById('ge-name')?.focus();},60);
}
function geEmoji(e){_ge.icon=e;document.getElementById('ge-ico').textContent=e;document.querySelectorAll('.ng-emojis button').forEach(b=>b.classList.toggle('on',b.textContent===e));}
function geQuick(n){const i=document.getElementById('ge-date');i.value=gAddMonthsISO(n);dpLabel('ge-date');}
function saveGoalEditor(){
  const name=document.getElementById('ge-name').value.trim();const target=moneyVal('ge-target');
  const date=document.getElementById('ge-date').value||null;const notes=document.getElementById('ge-notes').value.trim();
  if(!name){toast('Dê um nome ao objetivo','error');return;}
  if(!(target>0)){toast('Informe o valor estimado','error');return;}
  if(_ge.id){updateGoal(_ge.id,{name,icon:_ge.icon,target,target_date:date,notes});openGoal(_ge.id);rerender();toast('Objetivo atualizado!','success');return;}
  const g=addGoal({name,icon:_ge.icon,target,target_date:date,notes});
  const s=moneyVal('ge-saved');if(s>0)addGoalMove(g.id,s,todayISO(),'Valor inicial');
  closePanel();if(IS_MOBILE)mNav('objetivos');else if(!document.getElementById('page-objetivos')?.classList.contains('active'))showPage('objetivos');else rerender();
  toastMascot('comemora',`Objetivo criado: ${name}`);
}

// ---------- guardar / retirar ----------
function openGoalMove(id,sign){
  const g=goalById(id);const base=goalBase();const i=goalInfo(g,base);
  const sug=sign>0?Math.min(i.rem,i.per||0):0;
  openPanel(`<div class="nx-title">${sign>0?'Guardar em':'Retirar de'} ${g.icon} ${escHTML(g.name)}</div>
    <p class="nx-p" style="margin-bottom:12px">${sign>0?`Guardado até agora: <b>${fmt(i.saved)}</b> de ${fmt(g.target)}. Livre para alocar: <b>${fmt(base.free)}</b>.`:`Disponível no objetivo: <b>${fmt(i.saved)}</b>.`}</p>
    <div class="nx-lbl">Valor</div><input class="nx-input nx-money-big" id="gm-amount" data-money inputmode="numeric" placeholder="R$ 0,00" value="${moneyAttr(sug)}" oninput="gmWarn('${id}',${sign})">
    <div class="ng-warn" id="gm-warn"></div>
    <div class="nx-lbl" style="margin-top:12px">Data</div>${dateFieldHTML('gm-date',todayISO())}
    <div class="nx-lbl" style="margin-top:12px">Observação <span class="nx-hint">· opcional</span></div><input class="nx-input" id="gm-note" maxlength="200" placeholder="${sign>0?'Ex.: sobra de novembro':'Ex.: imprevisto'}">
    <div style="display:flex;gap:8px;margin-top:16px;"><button class="nx-btn ghost" onclick="openGoal('${id}')">Cancelar</button><button class="nx-btn primary" onclick="saveGoalMove('${id}',${sign})">${sign>0?'Guardar':'Retirar'}</button></div>`);
  setTimeout(()=>{const a=document.getElementById('gm-amount');a?.focus();},60);
}
function gmWarn(id,sign){
  const v=moneyVal('gm-amount')||0;const base=goalBase();const i=goalInfo(goalById(id),base);const w=document.getElementById('gm-warn');
  w.textContent=sign>0&&v>base.free?`É mais do que o livre para alocar (${fmt(base.free)}). Tudo bem se o dinheiro veio de antes do Numi.`
    :sign<0&&v>i.saved?`O objetivo só tem ${fmt(i.saved)}.`:'';
}
function saveGoalMove(id,sign){
  const v=moneyVal('gm-amount');const g=goalById(id);
  if(!(v>0)){toast('Informe o valor','error');return;}
  if(sign<0&&v>goalSaved(id)+0.009){toast(`O objetivo só tem ${fmt(goalSaved(id))}`,'error');return;}
  const before=goalInfo(g,goalBase());
  addGoalMove(id,sign*v,document.getElementById('gm-date').value||todayISO(),document.getElementById('gm-note').value.trim());
  const after=goalInfo(g,goalBase());
  openGoal(id);rerender();
  if(sign>0&&before.rem>0&&after.rem<=0)toastMascot('comemora',`${g.name}: tudo guardado! Hora de realizar 🎉`);
  else toast(sign>0?`${fmt(v)} guardados`:`${fmt(v)} retirados`,'success');
}

// ---------- realizei! ----------
function openGoalDone(id){
  const g=goalById(id);const i=goalInfo(g,goalBase());
  const cats=state.categories.despesa||[];const meios=state.categories.meio||[];
  const travel=['✈️','🏖️','🏔️','🎒','🗺️','⛺'].includes(g.icon);
  const guess=(travel&&cats.find(c=>/viage|lazer/i.test(c)))||cats[0]||'';
  openPanel(`<div class="ng-done-head"><img src="mascote/comemora.webp" alt=""><div><div class="nx-title" style="margin:0">Realizou ${escHTML(g.name)}?</div><p class="nx-p">O objetivo vai para “Realizados”. Se quiser, já registro o gasto como despesa.</p></div></div>
    <label class="ng-check"><input type="checkbox" id="gd-tx" checked onchange="document.getElementById('gd-fields').style.display=this.checked?'block':'none'"> Registrar como despesa</label>
    <div id="gd-fields">
      <div class="nx-lbl" style="margin-top:12px">Quanto custou?</div><input class="nx-input nx-money-big" id="gd-value" data-money inputmode="numeric" value="${moneyAttr(g.target)}">
      <div class="ng-form-2" style="margin-top:12px">
        <div><div class="nx-lbl">Categoria</div><select class="nx-input" id="gd-tag">${cats.map(c=>`<option ${c===guess?'selected':''}>${escHTML(c)}</option>`).join('')}</select></div>
        <div><div class="nx-lbl">Pagamento</div><select class="nx-input" id="gd-meio">${meios.map(c=>`<option>${escHTML(c)}</option>`).join('')}</select></div></div>
      <div class="nx-lbl" style="margin-top:12px">Data</div>${dateFieldHTML('gd-date',todayISO())}
      <p class="nx-hint" style="margin-top:8px">Dica: se pagou em partes (passagem, hotel…), registre só o principal aqui e o resto nos lançamentos.</p>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px;"><button class="nx-btn ghost" onclick="openGoal('${id}')">Cancelar</button><button class="nx-btn primary" onclick="saveGoalDone('${id}')">Concluir 🎉</button></div>`);
}
function saveGoalDone(id){
  const g=goalById(id);
  if(document.getElementById('gd-tx').checked){
    const v=moneyVal('gd-value');if(!(v>0)){toast('Informe quanto custou','error');return;}
    const date=document.getElementById('gd-date').value||todayISO();
    const t=addTransaction('despesa',{name:g.name,value:v,month:+date.slice(5,7)-1,year:+date.slice(0,4),tag:document.getElementById('gd-tag').value,meio:document.getElementById('gd-meio').value,date});
    if(typeof checkBudgetAlert==='function')checkBudgetAlert(t);
  }
  updateGoal(id,{status:'concluido',done_at:new Date().toISOString()});
  closePanel();rerender();
  toastMascot('comemora',`${g.name} realizado! Parabéns 🎉`);
}

// ---------- estilos ----------
document.head.insertAdjacentHTML('beforeend',`<style id="nx-goals-css">
.ng-new{flex:0 0 auto;white-space:nowrap;}
.ng-say{margin:0 0 16px;}
.ng-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;}
.ng-card{background:var(--surface);border:1px solid var(--line);border-radius:18px;padding:16px;box-shadow:var(--shadow-1);cursor:pointer;transition:transform .15s,box-shadow .15s;display:flex;flex-direction:column;gap:10px;text-align:left;font:inherit;color:inherit;min-width:0;}
.ng-card:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(42,34,24,.10);}
.ng-card-top{display:flex;gap:12px;align-items:center;}
.ng-ring-wrap{position:relative;width:64px;height:64px;flex-shrink:0;}
.ng-ring-wrap.big{width:84px;height:84px;}
.ng-ring-wrap span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:26px;}
.ng-ring-wrap.big span{font-size:34px;}
.ng-ring circle{transition:stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1);}
.ng-card-main{flex:1;min-width:0;}
.ng-name{font-family:var(--font-display);font-weight:700;font-size:17px;line-height:1.25;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;font-variation-settings:var(--font-display-vars);}
.ng-date{font-size:12px;color:var(--text3);margin:2px 0 6px;}
.ng-chip{display:inline-block;font-size:11px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--bg3);color:var(--text2);}
.ng-chip.pos{background:var(--green-dim);color:var(--green3);}.ng-chip.warn{background:#f5eedb;color:#8a5f12;}.ng-chip.neg{background:var(--red-dim);color:var(--red);}
.ng-order{display:flex;flex-direction:column;gap:4px;}
.ng-order button{width:26px;height:22px;border-radius:7px;border:1px solid var(--border);background:var(--bg2);color:var(--text3);font-size:9px;cursor:pointer;line-height:1;}
.ng-order button:disabled{opacity:.3;cursor:default;}
.ng-amounts{font-size:13px;color:var(--text3);display:flex;align-items:baseline;gap:5px;}
.ng-amounts b{font-family:var(--font-display);font-size:20px;color:var(--text);font-variation-settings:var(--font-display-vars);}
.ng-amounts em{margin-left:auto;font-style:normal;font-weight:700;color:var(--text2);}
.ng-line{font-size:13px;color:var(--text2);}
.ng-card-btns{display:flex;gap:8px;margin-top:auto;}
.ng-card-btns .nx-btn{padding:9px 12px;}
.ng-add{align-items:center;justify-content:center;border-style:dashed;background:transparent;box-shadow:none;color:var(--text3);font-weight:700;font-size:14px;min-height:150px;}
.ng-add span{font-size:28px;line-height:1;color:var(--green);}
.ng-empty .ng-presets{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding-bottom:10px;}
.ng-mini{display:flex;gap:10px;align-items:center;padding:8px 4px;border-radius:10px;cursor:pointer;}
.ng-mini:hover{background:var(--bg2);}
.ng-mini-ico{width:34px;height:34px;border-radius:12px;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}
.ng-mini-main{flex:1;min-width:0;}
.ng-mini-sub{font-size:11px;color:var(--text3);margin-top:4px;}
.ng-home-cta{display:flex;align-items:center;gap:12px;cursor:pointer;}
.ng-home-cta img{width:64px;height:auto;flex-shrink:0;}
.ng-det-head{display:flex;gap:14px;align-items:center;margin-bottom:12px;}
.ng-big{font-size:14px;color:var(--text3);margin-bottom:12px;}
.ng-big b{font-family:var(--font-display);font-size:28px;color:var(--text);font-variation-settings:var(--font-display-vars);}
.ng-big em{font-style:normal;font-weight:700;color:var(--green);margin-left:6px;}
.ng-stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.ng-stats div{background:var(--bg2);border-radius:12px;padding:10px 12px;min-width:0;}
.ng-stats div.wide{grid-column:1/-1;}
.ng-stats span{display:block;font-size:11px;color:var(--text3);font-weight:600;}
.ng-stats b{font-size:15px;color:var(--text);}
.ng-stats b.pos,.ng-sim-out .pos{color:var(--green);}.ng-stats b.neg,.ng-sim-out .neg{color:var(--red);}
.ng-sim{margin-top:14px;background:var(--green-dim);border-radius:14px;padding:12px 14px;}
.ng-sim input[type=range]{width:100%;accent-color:var(--green);margin:4px 0 6px;}
.ng-sim-out{font-size:13px;color:var(--text2);line-height:1.5;}
.ng-sim-out small{display:block;color:var(--text3);font-size:11px;}
.ng-plan-row{display:flex;align-items:center;gap:8px;padding:7px 2px;border-bottom:1px solid var(--bg2);font-size:13px;}
.ng-plan-row span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text2);}
.ng-plan-row button,.ng-move button{border:none;background:none;color:var(--text3);font-size:18px;cursor:pointer;padding:0 4px;line-height:1;}
.ng-plan-add{display:grid;grid-template-columns:1fr 120px auto;gap:6px;margin-top:8px;}
.ng-plan-add .nx-btn{flex:0;padding:9px 12px;}
.ng-plan-tot{font-size:13px;color:var(--text2);margin-top:8px;}
.ng-moves{max-height:220px;overflow:auto;}
.ng-move{display:flex;justify-content:space-between;align-items:center;padding:7px 2px;border-bottom:1px solid var(--bg2);}
.ng-move b{font-size:13px;margin-right:8px;}.ng-move b.pos{color:var(--green);}.ng-move b.neg{color:var(--red);}
.ng-move span{font-size:12px;color:var(--text3);}
.ng-det-btns{display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;}
.ng-det-btns.small{margin-top:8px;}
.ng-det-btns.small .nx-btn{padding:9px 10px;font-size:12px;}
.danger-txt{color:var(--red)!important;}
.ng-form-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px;}
.ng-quick{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;}
.ng-emojis{margin-top:12px;}
.ng-warn{font-size:12px;color:#8a5f12;margin-top:6px;min-height:0;}
.ng-done-head{display:flex;gap:12px;align-items:center;margin-bottom:10px;}
.ng-done-head img{width:72px;height:auto;flex-shrink:0;}
.ng-check{display:flex;gap:8px;align-items:center;font-size:13px;font-weight:600;color:var(--text);cursor:pointer;}
.ng-check input{accent-color:var(--green);width:16px;height:16px;}
.is-mobile .ng-grid{grid-template-columns:1fr;}
.is-mobile .ng-new{padding:9px 12px;font-size:12px;}
.is-mobile .ng-plan-add{grid-template-columns:1fr 100px;}
.is-mobile .ng-plan-add .nx-btn{grid-column:1/-1;}
.is-mobile .ng-form-2{grid-template-columns:1fr;}
</style>`);
