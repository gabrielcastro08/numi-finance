# Checklist de deploy — Controle Financeiro multi-usuário

## 1. Configurar URLs de autenticação no Supabase (fazer 1x, antes do deploy)

No painel do Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://controle-financeiro-gabriel.netlify.app`
- **Redirect URLs** (adicionar as duas):
  - `https://controle-financeiro-gabriel.netlify.app`
  - `http://localhost:3000`

Sem isso, os links de confirmação de email e de "esqueci minha senha" não voltam para o app.

## 2. Testar localmente (antes de subir)

`file://` não funciona com Supabase — sirva por HTTP:

```
cd controle-financeiro
npx serve -l 3000 .
```

Abra `http://localhost:3000` e verifique:

- [ ] Login com sua conta → dados históricos aparecem com os mesmos totais do relatório de migração.
- [ ] Criar/editar/excluir transação (excluir pede confirmação).
- [ ] F12 → Console sem erros vermelhos.
- [ ] Para simular o mobile: F12 → ícone de celular (device toolbar) → recarregar a página (o layout é decidido no carregamento).

## 3. Subir no Netlify

Drag-and-drop da pasta no painel do Netlify, como sempre. Arquivos necessários:
`index.html`, `sw.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.

(As pastas `supabase/`, `backup/` e o `DEPLOY.md` podem ir junto sem problema — são estáticos e ninguém acessa — mas se preferir, arraste só os 6 arquivos acima.)

## 4. Testar no desktop (produção)

- [ ] Abrir o site, fazer login, conferir dashboard/meses/receitas/despesas.
- [ ] Menu do avatar (rodapé da sidebar): Perfil, Configurações, Sair.
- [ ] Exportar planilha em Configurações e abrir o .xlsx gerado.

## 5. Reinstalar o PWA no Android

O service worker novo (`finctrl-v2`) é network-first para o HTML e se auto-atualiza,
mas o app instalado ainda roda o SW antigo (v1, cache-first). Para garantir:

1. Abra o app instalado uma vez com internet e espere ~10s (o SW novo assume e a página recarrega sozinha).
2. Se ainda vier a versão antiga: desinstale o PWA → abra o site no Chrome →
   menu ⋮ → *Configurações do site* → **Limpar dados** → recarregue → menu ⋮ → *Instalar app*.
3. Faça login (a sessão fica salva; não pede login toda vez).

- [ ] "Olá, Gabriel! 👋" no topo; avatar abre o menu.
- [ ] Lançar despesa no celular e ver no desktop segundos depois (e vice-versa), com os dois abertos.
- [ ] Nova transação no mobile tem campo de Data (mês é derivado automaticamente).
- [ ] Recorrentes e Categorias em Configurações (mobile).

## 6. Testar onboarding com uma conta nova

- [ ] Criar segunda conta (Criar conta → confirmar email → login).
- [ ] Wizard: perfil (nome/nascimento/foto), ponto de partida, meta (com cálculo mensal), dados anteriores.
- [ ] Baixar modelo .xlsx, preencher 2–3 linhas (inclusive 1 com erro de propósito), importar e conferir o preview de erros.
- [ ] Conferir que a conta nova NÃO vê seus dados (e vice-versa).

## Manutenção

- A cada nova versão publicada, **incrementar** `finctrl-vN` no topo do `sw.js` — o app instalado se atualiza sozinho no próximo uso.
- A tabela `app_state` segue no Supabase como backup dos dados antigos; o app não a usa mais. Quando quiser, pode apagá-la (recomendo esperar algumas semanas).
- Backup do app antigo em `backup/index-v1-app_state.html`.
