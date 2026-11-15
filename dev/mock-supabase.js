// Supabase falso, em memória, com dados fictícios — só para testes locais.
(function(){
  const UID='00000000-0000-4000-8000-000000000001';
  const Y=new Date().getFullYear();
  const id=()=>crypto.randomUUID();
  // ?v12 na URL simula o banco antes da migração 1.3 (sem dia/limite/parcelas)
  const V13=!/[?&]v12(&|$)/.test(location.search);
  // ?noicon simula o banco sem a coluna de emoji (1.4)
  const ICON=V13&&!/[?&]noicon(&|$)/.test(location.search);
  // ?noplace simula o banco sem a coluna de local (1.5)
  const PLACE=V13&&!/[?&]noplace(&|$)/.test(location.search);
  // ?nogoals simula o banco sem as tabelas de objetivos (1.7)
  const GOALS=!/[?&]nogoals(&|$)/.test(location.search);
  const db={profiles:[],transactions:[],recurrents:[],categories:[],goals:[],goal_moves:[]};
  db.profiles.push({id:UID,name:'Ana Teste',birth_date:null,avatar_url:null,start_date:Y+'-01-01',goal:15000});
  const cats={receita:['Salário','Bônus','Investimento','Atividade complementar','Presente'],
    despesa:['Alimentação','Cuidados Pessoais','Lazer','Presente/Doação','Saúde','Transporte','Utilitários','Vestuário'],
    meio:['Crédito','Débito','Pix']};
  Object.entries(cats).forEach(([t,a])=>a.forEach(n=>db.categories.push({id:id(),user_id:UID,type:t,name:n,...(ICON?{icon:null}:{}),...(V13?{monthly_limit:t==='despesa'&&n==='Alimentação'?1200:t==='despesa'&&n==='Lazer'?250:null}:{})})));
  const recs=[
    ['despesa','Aluguel',1800,'Utilitários','Pix'],['despesa','Condomínio',450,'Utilitários','Pix'],
    ['despesa','Internet',120,'Utilitários','Crédito'],['despesa','Academia',99.9,'Saúde','Crédito'],
    ['despesa','Spotify',21.9,'Lazer','Crédito'],['despesa','Netflix',44.9,'Lazer','Crédito'],
    ['despesa','Mercado',0,'Alimentação','Débito'],['despesa','Uber',0,'Transporte','Crédito'],
    ['despesa','Plano de saúde',380,'Saúde','Débito'],['despesa','Conta de luz',0,'Utilitários','Pix'],
    ['receita','Salário',6500,'Salário',''],['receita','Aulas de violão',600,'Atividade complementar','']];
  recs.forEach(([k,n,v,t,m],i)=>db.recurrents.push({id:id(),user_id:UID,kind:k,name:n,value:v,tag:t,meio:m||null,created_at:new Date().toISOString(),...(V13?{day:[5,8,12,3,null,null,null,null,10,20,5,10][i]}:{})}));
  const now=new Date();const lastM=now.getFullYear()===Y?now.getMonth():11;
  let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  // ano anterior inteiro (para o seletor de ano / visão geral) + ano atual até o mês corrente
  for(const[YY,LM,F]of[[Y-1,11,.85],[Y,lastM,1]])for(let m=0;m<=LM;m++){
    const d=dd=>`${YY}-${String(m+1).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
    const tx=(k,n,v,t,me,day)=>db.transactions.push({id:id(),user_id:UID,kind:k,name:n,value:Math.round(v*(k==='receita'?F:1)*100)/100,tag:t,meio:me||null,date:d(day),month:m,year:YY,created_at:new Date().toISOString(),...(PLACE?{place:k==='despesa'?({Mercado:m%2?'Carrefour':'Pão de Açúcar',iFood:'iFood',Uber:'Uber',Aluguel:'Imobiliária Lar',Cinema:'Cinemark',Roupas:'Renner',Farmácia:'Drogasil'}[n]||null):null}:{}),...(V13?{installment_group:null,installment_no:null,installment_total:null}:{})});
    tx('receita','Salário',6500,'Salário','',5);
    if(m%2===0)tx('receita','Aulas de violão',600,'Atividade complementar','',10);
    if(m===5)tx('receita','Bônus semestral',2500,'Bônus','',20);
    tx('despesa','Aluguel',1800,'Utilitários','Pix',5);
    tx('despesa','Condomínio',450,'Utilitários','Pix',8);
    tx('despesa','Internet',120,'Utilitários','Crédito',12);
    tx('despesa','Academia',99.9,'Saúde','Crédito',3);
    tx('despesa','Mercado',500+rnd()*400,'Alimentação','Débito',9);
    tx('despesa','Mercado',300+rnd()*300,'Alimentação','Débito',22);
    tx('despesa','iFood',80+rnd()*220,'Alimentação','Crédito',15);
    tx('despesa','Uber',60+rnd()*200,'Transporte','Crédito',17);
    tx('despesa','Cinema',40+rnd()*120,'Lazer','Crédito',25);
    if(m%3===1)tx('despesa','Roupas',150+rnd()*400,'Vestuário','Crédito',19);
    if(m%4===2)tx('despesa','Farmácia',50+rnd()*150,'Saúde','Débito',14);
    if(m%2===1)tx('despesa','Cabeleireiro',70,'Cuidados Pessoais','Pix',11);
  }
  // objetivos fictícios: viagem com data, reserva sem data, notebook perto e um já realizado
  {const iso=(k,d)=>`${Math.floor(k/12)}-${String(k%12+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
   const nk=now.getFullYear()*12+now.getMonth();
   const G=[['Viagem para o Chile','✈️',12000,iso(nk+8,15),0,'ativo',[600,600,700,600],[{label:'Passagens',amount:4200},{label:'Hospedagem (10 noites)',amount:3800},{label:'Passeios e comida',amount:3000}]],
     ['Reserva de emergência','🛟',20000,null,1,'ativo',[1000,1000,1000],[]],
     ['Notebook novo','💻',7500,iso(nk+4,1),2,'ativo',[500,500],[]],
     ['Bicicleta','🚲',2400,iso(nk-2,10),3,'concluido',[800,800,800],[]]];
   G.forEach(([n,ic,t,d,p,st,mv,plan])=>{const gid=id();
     db.goals.push({id:gid,user_id:UID,name:n,icon:ic,target:t,target_date:d,priority:p,status:st,plan,notes:null,created_at:new Date().toISOString(),done_at:st==='concluido'?new Date(Date.now()-40*864e5).toISOString():null});
     mv.forEach((a,i)=>db.goal_moves.push({id:id(),user_id:UID,goal_id:gid,amount:a,date:iso(nk-(mv.length-1-i)-(st==='concluido'?3:0),5),note:null,created_at:new Date().toISOString()}));});}
  window.__mockdb=db;

  function query(table){
    let rows=null,filters=[],orders=[],single=false,op='select',payload=null;
    const q={
      select(){return q;},
      eq(c,v){filters.push(r=>r[c]===v);return q;},
      match(o){filters.push(r=>Object.entries(o).every(([k,v])=>r[k]===v));return q;},
      order(c,o){orders.push([c,o?.ascending!==false]);return q;},
      maybeSingle(){single=true;return q;},
      insert(p){op='upsert';payload=p;return q;},
      upsert(p){op='upsert';payload=p;return q;},
      update(p){op='update';payload=p;return q;},
      delete(){op='delete';return q;},
      then(res,rej){return Promise.resolve(window.__offline?{data:null,error:{message:'TypeError: Failed to fetch'},status:0}:run()).then(res,rej);}
    };
    function run(){
      if(!GOALS&&(table==='goals'||table==='goal_moves'))return{data:null,error:{code:'PGRST205',message:`Could not find the table 'public.${table}' in the schema cache`},status:404};
      const T=db[table];const match=r=>filters.every(f=>f(r));
      if(!PLACE&&payload&&op!=='select'&&(Array.isArray(payload)?payload:[payload]).some(r=>'place' in r))return{data:null,error:{message:"Could not find the 'place' column",code:'PGRST204'},status:400};
      if(!ICON&&payload&&op!=='select'&&(Array.isArray(payload)?payload:[payload]).some(r=>'icon' in r))return{data:null,error:{message:"Could not find the 'icon' column",code:'PGRST204'},status:400};
      if(!V13&&payload&&op!=='select'){const bad=['day','monthly_limit','installment_group','installment_no','installment_total'];
        const rows=Array.isArray(payload)?payload:[payload];const col=rows.flatMap(Object.keys).find(k=>bad.includes(k));
        if(col)return{data:null,error:{message:`Could not find the '${col}' column of '${table}' in the schema cache`,code:'PGRST204'},status:400};}
      if(op==='upsert'){(Array.isArray(payload)?payload:[payload]).forEach(p=>{const i=T.findIndex(r=>r.id===p.id);if(i>=0)Object.assign(T[i],p);else T.push({...p});});return{data:null,error:null};}
      if(op==='update'){T.filter(match).forEach(r=>Object.assign(r,payload));return{data:null,error:null};}
      if(op==='delete'){db[table]=T.filter(r=>!match(r));return{data:null,error:null};}
      rows=T.filter(match).map(r=>({...r}));
      orders.slice().reverse().forEach(([c,asc])=>rows.sort((a,b)=>((a[c]??'')>(b[c]??'')?1:(a[c]??'')<(b[c]??'')?-1:0)*(asc?1:-1)));
      return{data:single?(rows[0]||null):rows,error:null,status:200};
    }
    return q;
  }
  const session={user:{id:UID,email:'ana@teste.local'}};
  window.supabase={createClient(){return{
    from:query,
    auth:{getSession:async()=>({data:{session}}),onAuthStateChange(){return{data:{subscription:{unsubscribe(){}}}};},
      signOut:async()=>({}),signInWithPassword:async()=>({data:{session},error:null}),signUp:async()=>({data:{},error:null}),
      updateUser:async()=>({data:{},error:null}),resetPasswordForEmail:async()=>({error:null})},
    storage:{from(){return{upload:async()=>({error:null}),getPublicUrl:()=>({data:{publicUrl:''}})};}}
  };}};
})();

// ---------- IA falsa (Edge Function numi-ai) ----------
// Pergunta nova → pede ferramenta(s) conforme o texto; resultado de ferramenta → responde com base nele.
// Ações de teste: "lança ..." (1 despesa), "lança duas" (2 cartões), "parcela" (10x), "apaga" (último lançamento),
// "corrige" (edita o último), "cria objetivo", "guarda" (no 1º objetivo), "limite", "recorrente".
// ?aierr=1 simula erro; ?ailimit=1 simula limite diário.
(function(){
  const qs=new URLSearchParams(location.search);
  const realFetch=window.fetch.bind(window);
  window.__aiCalls=[];
  const today=()=>new Date().toISOString().slice(0,10);
  const lastTx=()=>typeof TX_ALL!=='undefined'?TX_ALL.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''))[0]:null;
  function plan(q){
    const t=(id,name,input)=>({type:'tool_use',id:'tu_'+Date.now()+'_'+id,name,input});
    if(/lan[cç]a duas/.test(q))return[t(1,'criar_lancamento',{tipo:'despesa',nome:'Almoço',valor:32.5,categoria:'Alimentação',data:today()}),
      t(2,'criar_lancamento',{tipo:'despesa',nome:'Uber',valor:18,categoria:'Transporte',data:today(),meio:'Pix'})];
    if(/parcel/.test(q))return[t(1,'criar_lancamento',{tipo:'despesa',nome:'Geladeira',valor:3000,categoria:'Casa',parcelas:10,valor_e:'total'})];
    if(/lan[cç]a|gastei/.test(q))return[t(1,'criar_lancamento',{tipo:'despesa',nome:'Farmácia',valor:45,categoria:'Saúde',data:today(),meio:'Pix'})];
    if(/apaga|exclui/.test(q))return[t(1,'excluir_lancamento',{id:lastTx()?.id})];
    if(/corrige|edita/.test(q))return[t(1,'editar_lancamento',{id:lastTx()?.id,valor:99.9})];
    if(/cria.*objetivo/.test(q))return[t(1,'criar_objetivo',{nome:'Show do Coldplay',valor:1200,data:'2027-03-10',icone:'🎸',ja_guardado:200})];
    if(/guarda/.test(q))return[t(1,'movimentar_objetivo',{objetivo_id:state?.goals?.[0]?.id,operacao:'guardar',valor:150})];
    if(/limite/.test(q))return[t(1,'definir_limite',{categoria:'Lazer',valor:400})];
    if(/recorrente/.test(q))return[t(1,'criar_recorrente',{tipo:'despesa',nome:'Netflix',valor:55.9,categoria:'Lazer',dia:12})];
    if(/invalid/.test(q))return[t(1,'excluir_lancamento',{id:'nao-existe'})];
    const name=/objetiv/.test(q)?'objetivos':/onde|categoria/.test(q)?'gastos_por_categoria':/delivery|ifood/.test(q)?'buscar_lancamentos':'resumo_financeiro';
    return[t(1,name,name==='buscar_lancamentos'?{tipo:'despesa',texto:'ifood',de:'2026-01'}:{})];
  }
  function answer(results){
    const r=results[0];
    if(results.every(x=>x.cancelado))return'Tudo bem, não fiz nada.';
    if(results.some(x=>x.erro))return'Não consegui: '+results.find(x=>x.erro).erro+'.';
    if(results.some(x=>x.ok))return results.length>1?`Pronto, fiz ${results.filter(x=>x.ok).length} de ${results.length}.`:'Pronto, feito! ✅';
    if(r.mes_atual)return`Seu mês até agora: entraram **R$ ${r.mes_atual.receitas.toLocaleString('pt-BR',{minimumFractionDigits:2})}** e saíram **R$ ${r.mes_atual.despesas.toLocaleString('pt-BR',{minimumFractionDigits:2})}**.\n\nMaiores gastos:\n${r.mes_atual.maiores_categorias.slice(0,3).map(c=>'- '+c.categoria+': R$ '+c.valor).join('\n')}`;
    if(r.categorias)return`Em ${r.de}, a maior categoria foi **${r.categorias[0]?.categoria||'—'}** (${r.categorias[0]?.pct||0}%).`;
    if(r.objetivos)return`Você tem **${r.objetivos.length} objetivos**. Livre para alocar: R$ ${r.visao_geral.livre_para_alocar}.`;
    return`Achei **${r.encontrados} lançamentos**, somando R$ ${r.soma}.`;
  }
  window.fetch=async(url,opts)=>{
    if(!String(url).includes('/functions/v1/numi-ai'))return realFetch(url,opts);
    const body=JSON.parse(opts.body);window.__aiCalls.push(body);
    if(qs.has('ailimit'))return new Response(JSON.stringify({error:'limit',message:'Por hoje deu: você chegou ao limite de 40 perguntas. Amanhã tem mais!'}),{status:429});
    const msgs=body.messages,last=msgs[msgs.length-1];
    const evs=[];
    if(qs.has('aierr'))evs.push({t:'error',message:'Não consegui responder agora. Tenta de novo daqui a pouco.'});
    else if(last.role==='user'&&last.content.some(b=>b.type==='text')&&/viagem|chile|custa/.test(last.content.find(b=>b.type==='text').text.toLowerCase())){
      evs.push({t:'status',d:'Pesquisando na internet'});
      evs.push({t:'done',stop_reason:'pause_turn',content:[{type:'server_tool_use',id:'srvtoolu_1',name:'web_search',input:{query:'passagem São Paulo Santiago julho preço'}},
        {type:'web_search_tool_result',tool_use_id:'srvtoolu_1',content:[{type:'web_search_result',url:'https://www.latamairlines.com/br/pt',title:'LATAM',encrypted_content:'x'}]}]});
    }
    else if(last.role==='assistant'){
      evs.push({t:'status',d:'Lendo uma página'});
      const txt='Para 7 dias em Santiago em julho, dá pra contar com uns **R$ 7.900** por pessoa:\n- Passagem: R$ 2.400\n- Hospedagem: R$ 2.800\n- Comida e passeios: R$ 2.000\n- Seguro e imprevistos: R$ 700\n\nPreços de hoje, podem mudar. Brasileiro entra só com RG.';
      txt.match(/.{1,14}/gs).forEach(d=>evs.push({t:'text',d}));
      evs.push({t:'done',stop_reason:'tool_use',content:[
        {type:'text',text:txt,citations:[{type:'web_search_result_location',url:'https://www.latamairlines.com/br/pt',title:'LATAM'},
          {type:'web_search_result_location',url:'https://www.gov.br/mre/pt-br/embaixada-santiago',title:'Embaixada do Brasil em Santiago'},
          {type:'web_search_result_location',url:'javascript:alert(1)',title:'ruim'}]},
        {type:'tool_use',id:'tu_obj_'+Date.now(),name:'criar_objetivo',input:{nome:'Chile em julho',valor:0,data:'2027-07-10',icone:'🏔️',
          orcamento:[{item:'Passagens',valor:2400},{item:'Hospedagem',valor:2800},{item:'Comida e passeios',valor:2000},{item:'Seguro e imprevistos',valor:700}],
          notas:'Preços de nov/2026 (LATAM, Booking).'}}]});
    }
    else if(last.content.some(b=>b.type==='text')){
      const q=last.content.find(b=>b.type==='text').text.toLowerCase();
      evs.push({t:'done',stop_reason:'tool_use',content:[{type:'thinking',thinking:'',signature:'sig'},...plan(q)]});
    }else{
      const txt=answer(last.content.map(b=>JSON.parse(b.content)));
      txt.match(/.{1,12}/gs).forEach(d=>evs.push({t:'text',d}));
      evs.push({t:'done',stop_reason:'end_turn',content:[{type:'text',text:txt}]});
    }
    const enc=new TextEncoder();
    const stream=new ReadableStream({async start(c){for(const e of evs){await new Promise(r=>setTimeout(r,30));c.enqueue(enc.encode('data: '+JSON.stringify(e)+'\n\n'));}c.close();}});
    return new Response(stream,{status:200,headers:{'Content-Type':'text/event-stream'}});
  };
})();
