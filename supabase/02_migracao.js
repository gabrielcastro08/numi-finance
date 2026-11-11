// ============================================================
// CONTROLE FINANCEIRO — Migração app_state -> tabelas novas (Etapa 2)
//
// COMO RODAR:
//   1. Rode antes o 01_schema.sql no SQL Editor do Supabase.
//   2. Crie sua conta no Supabase Dashboard:
//      Authentication > Users > Add user > email + senha,
//      marcando "Auto Confirm User".
//   3. Abra o app ATUAL (https://controle-financeiro-gabriel.netlify.app/)
//      no desktop, abra o DevTools (F12) > aba Console.
//   4. Cole este arquivo INTEIRO no console e aperte Enter.
//   5. Informe email/senha quando pedido e confira o relatório final.
//
// O script NÃO apaga nem altera a tabela app_state (fica como backup).
// Se você já tiver transações migradas, ele avisa e aborta (sem duplicar).
// ============================================================
(async () => {
  const START_DATE = '2026-01-01'; // data de início do controle
  const YEAR = 2026;               // ano fiscal dos dados atuais

  const log = (...a) => console.log('%c[migração]', 'color:#4a7c59;font-weight:bold', ...a);
  const err = (...a) => console.error('%c[migração]', 'color:#b54d3a;font-weight:bold', ...a);

  if (typeof sb === 'undefined') {
    err('Cliente Supabase não encontrado. Rode este script no console do app (index.html aberto).');
    return;
  }

  // ---------- 1. Login ----------
  const email = prompt('Email da sua conta Supabase:');
  const password = prompt('Senha:');
  if (!email || !password) { err('Login cancelado.'); return; }

  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({ email, password });
  if (authErr) { err('Falha no login:', authErr.message); return; }
  const uid = auth.user.id;
  log('Logado como', email, '| user_id:', uid);

  // ---------- 2. Guarda contra migração dupla ----------
  const { count: existing, error: cntErr } = await sb
    .from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', uid);
  if (cntErr) { err('Erro ao checar tabelas novas (o 01_schema.sql foi rodado?):', cntErr.message); return; }
  if (existing > 0) {
    err(`Você já tem ${existing} transações nas tabelas novas. Abortando para não duplicar.`,
        'Se quiser re-migrar, apague antes os dados do seu user_id nas tabelas novas.');
    return;
  }

  // ---------- 3. Ler o JSON atual (app_state) ----------
  const { data: row, error: stErr } = await sb
    .from('app_state').select('data').eq('id', 'main').maybeSingle();
  if (stErr || !row?.data) { err('Não foi possível ler app_state:', stErr?.message || 'linha vazia'); return; }
  const st = row.data;
  log(`app_state lido: ${st.receitas.length} receitas, ${st.despesas.length} despesas, ` +
      `${st.recorrentes.length} recorrentes, goal ${st.goal}`);

  // ---------- 4. Mapear ----------
  const txRows = [
    ...st.receitas.map(r => ({
      user_id: uid, kind: 'receita', name: r.name, value: r.value,
      tag: r.tag, meio: null, date: r.date || null, month: r.month, year: YEAR,
    })),
    ...st.despesas.map(d => ({
      user_id: uid, kind: 'despesa', name: d.name, value: d.value,
      tag: d.tag, meio: d.meio || null, date: d.date || null, month: d.month, year: YEAR,
    })),
  ];
  const recRows = st.recorrentes.map(r => ({
    user_id: uid, kind: r.type, name: r.name, value: r.value || 0,
    tag: r.tag, meio: r.meio || null,
  }));
  const catRows = Object.entries(st.categories).flatMap(([type, names]) =>
    names.map(name => ({ user_id: uid, type, name })));

  // ---------- 5. Inserir ----------
  const insertBatches = async (table, rows) => {
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await sb.from(table).insert(rows.slice(i, i + 100));
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    log(`${table}: ${rows.length} linhas inseridas`);
  };

  try {
    await insertBatches('transactions', txRows);
    await insertBatches('recurrents', recRows);
    await insertBatches('categories', catRows);
    const { error: profErr } = await sb.from('profiles').upsert({
      id: uid, name: 'Gabriel', start_date: START_DATE, goal: st.goal,
    });
    if (profErr) throw new Error(`profiles: ${profErr.message}`);
    log('profiles: perfil criado/atualizado (name, start_date, goal)');
  } catch (e) {
    err('Falha durante a inserção:', e.message,
        '— corrija e re-rode (se transações foram parcialmente inseridas, apague-as antes).');
    return;
  }

  // ---------- 6. Relatório de validação (lendo de volta do banco) ----------
  const { data: dbTx } = await sb.from('transactions')
    .select('kind,value').eq('user_id', uid).limit(10000);
  const { count: dbRec } = await sb.from('recurrents')
    .select('id', { count: 'exact', head: true }).eq('user_id', uid);
  const { count: dbCat } = await sb.from('categories')
    .select('id', { count: 'exact', head: true }).eq('user_id', uid);

  const sum = arr => Math.round(arr.reduce((s, x) => s + Number(x.value), 0) * 100) / 100;
  const fmtBRL = v => 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  const jsonRecSum = sum(st.receitas), jsonDespSum = sum(st.despesas);
  const dbRecRows = dbTx.filter(t => t.kind === 'receita');
  const dbDespRows = dbTx.filter(t => t.kind === 'despesa');
  const dbRecSum = sum(dbRecRows), dbDespSum = sum(dbDespRows);
  const jsonCatCount = Object.values(st.categories).reduce((s, a) => s + a.length, 0);

  const ok = (a, b) => (a === b ? '✅' : '❌ DIVERGÊNCIA');
  console.table([
    { item: 'Receitas (qtd)',   json: st.receitas.length,    banco: dbRecRows.length,  status: ok(st.receitas.length, dbRecRows.length) },
    { item: 'Despesas (qtd)',   json: st.despesas.length,    banco: dbDespRows.length, status: ok(st.despesas.length, dbDespRows.length) },
    { item: 'Recorrentes (qtd)',json: st.recorrentes.length, banco: dbRec,             status: ok(st.recorrentes.length, dbRec) },
    { item: 'Categorias (qtd)', json: jsonCatCount,          banco: dbCat,             status: ok(jsonCatCount, dbCat) },
    { item: 'Soma receitas',    json: fmtBRL(jsonRecSum),    banco: fmtBRL(dbRecSum),  status: ok(jsonRecSum, dbRecSum) },
    { item: 'Soma despesas',    json: fmtBRL(jsonDespSum),   banco: fmtBRL(dbDespSum), status: ok(jsonDespSum, dbDespSum) },
    { item: 'Meta (goal)',      json: fmtBRL(st.goal),       banco: '(em profiles)',   status: '—' },
  ]);
  log('Migração concluída. Confira a tabela acima com os totais do app atual ANTES de seguirmos.',
      'A tabela app_state foi mantida intacta como backup.');
})();
