// Supabase falso, em memória, com dados fictícios — só para testes locais.
(function(){
  const UID='00000000-0000-4000-8000-000000000001';
  const Y=new Date().getFullYear();
  const id=()=>crypto.randomUUID();
  const db={profiles:[],transactions:[],recurrents:[],categories:[]};
  db.profiles.push({id:UID,name:'Ana Teste',birth_date:null,avatar_url:null,start_date:Y+'-01-01',goal:15000});
  const cats={receita:['Salário','Bônus','Investimento','Atividade complementar','Presente'],
    despesa:['Alimentação','Cuidados Pessoais','Lazer','Presente/Doação','Saúde','Transporte','Utilitários','Vestuário'],
    meio:['Crédito','Débito','Pix']};
  Object.entries(cats).forEach(([t,a])=>a.forEach(n=>db.categories.push({id:id(),user_id:UID,type:t,name:n})));
  const recs=[
    ['despesa','Aluguel',1800,'Utilitários','Pix'],['despesa','Condomínio',450,'Utilitários','Pix'],
    ['despesa','Internet',120,'Utilitários','Crédito'],['despesa','Academia',99.9,'Saúde','Crédito'],
    ['despesa','Spotify',21.9,'Lazer','Crédito'],['despesa','Netflix',44.9,'Lazer','Crédito'],
    ['despesa','Mercado',0,'Alimentação','Débito'],['despesa','Uber',0,'Transporte','Crédito'],
    ['despesa','Plano de saúde',380,'Saúde','Débito'],['despesa','Conta de luz',0,'Utilitários','Pix'],
    ['receita','Salário',6500,'Salário',''],['receita','Aulas de violão',600,'Atividade complementar','']];
  recs.forEach(([k,n,v,t,m])=>db.recurrents.push({id:id(),user_id:UID,kind:k,name:n,value:v,tag:t,meio:m||null,created_at:new Date().toISOString()}));
  const now=new Date();const lastM=now.getFullYear()===Y?now.getMonth():11;
  let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let m=0;m<=lastM;m++){
    const d=dd=>`${Y}-${String(m+1).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
    const tx=(k,n,v,t,me,day)=>db.transactions.push({id:id(),user_id:UID,kind:k,name:n,value:Math.round(v*100)/100,tag:t,meio:me||null,date:d(day),month:m,year:Y,created_at:new Date().toISOString()});
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
      then(res,rej){return Promise.resolve(run()).then(res,rej);}
    };
    function run(){
      const T=db[table];const match=r=>filters.every(f=>f(r));
      if(op==='upsert'){(Array.isArray(payload)?payload:[payload]).forEach(p=>{const i=T.findIndex(r=>r.id===p.id);if(i>=0)Object.assign(T[i],p);else T.push({...p});});return{data:null,error:null};}
      if(op==='update'){T.filter(match).forEach(r=>Object.assign(r,payload));return{data:null,error:null};}
      if(op==='delete'){db[table]=T.filter(r=>!match(r));return{data:null,error:null};}
      rows=T.filter(match).map(r=>({...r}));
      orders.slice().reverse().forEach(([c,asc])=>rows.sort((a,b)=>((a[c]??'')>(b[c]??'')?1:(a[c]??'')<(b[c]??'')?-1:0)*(asc?1:-1)));
      return{data:single?(rows[0]||null):rows,error:null};
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
