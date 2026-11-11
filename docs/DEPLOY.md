# Checklist de deploy — Numi

## 1. Configurar URLs de autenticação no Supabase (fazer 1x, antes do deploy)

No painel do Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://numi-finance.netlify.app`
- **Redirect URLs** (adicionar as duas):
  - `https://numi-finance.netlify.app`
  - `http://localhost:3000`

Sem isso, os links de confirmação de email e de "esqueci minha senha" não voltam para o app.

## 2. Testar localmente (antes de subir)

`file://` não funciona com Supabase — sirva por HTTP:

```
npx serve -l 3000 controle-financeiro-deploy
```

Abra `http://localhost:3000` e verifique:

- [ ] Login com sua conta → dados históricos aparecem com os mesmos totais do relatório de migração.
- [ ] Criar/editar/excluir transação (excluir pede confirmação).
- [ ] F12 → Console sem erros vermelhos.
- [ ] Para simular o mobile: F12 → ícone de celular (device toolbar) → recarregar a página (o layout é decidido no carregamento).

## 3. Subir no Netlify

O deploy é contínuo: o site no Netlify está ligado a este repositório e cada `git push`
na branch `main` publica uma nova versão. A pasta publicada é `controle-financeiro-deploy/`
(definida em `netlify.toml`); não há etapa de build.

Para voltar a uma versão anterior: Netlify → **Deploys** → escolher o deploy → *Publish deploy*.

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

- [ ] "Olá, {nome}! 👋" no topo; avatar abre o menu.
- [ ] Lançar despesa no celular e ver no desktop segundos depois (e vice-versa), com os dois abertos.
- [ ] Nova transação no mobile tem campo de Data (mês é derivado automaticamente).
- [ ] Recorrentes e Categorias em Configurações (mobile).

## 6. Testar onboarding com uma conta nova

- [ ] Criar segunda conta (Criar conta → confirmar email → login).
- [ ] Wizard: perfil (nome/nascimento/foto), ponto de partida, meta (com cálculo mensal), dados anteriores.
- [ ] Baixar modelo .xlsx, preencher 2–3 linhas (inclusive 1 com erro de propósito), importar e conferir o preview de erros.
- [ ] Conferir que a conta nova NÃO vê seus dados (e vice-versa).

## Manutenção

- A cada nova versão publicada, **incrementar** `numi-vN` no topo do `sw.js` — o app instalado se atualiza sozinho no próximo uso.
- A tabela `app_state` segue no Supabase como backup dos dados antigos; o app não a usa mais. Quando quiser, pode apagá-la (recomendo esperar algumas semanas).
- A versão antiga (single-user, `app_state`) está no histórico do Git, no commit inicial.
