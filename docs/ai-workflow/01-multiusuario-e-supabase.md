# PROMPT — Evolução do Controle Financeiro para Multi-Usuário

## CONTEXTO DO PROJETO

Tenho um app de controle financeiro pessoal que funciona hoje como um único arquivo `index.html` hospedado no Netlify (https://controle-financeiro-gabriel.netlify.app/), com dados salvos no Supabase. Ele é um PWA instalado no meu Android e tem **duas interfaces no mesmo arquivo**: uma desktop (sidebar + páginas) e uma mobile (bottom nav + bottom sheets), escolhidas em runtime por detecção de user agent / largura de tela (`IS_MOBILE`).

O arquivo `index.html` atual está neste repositório/pasta — leia-o inteiro antes de começar. Os demais arquivos são: `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`.

**Identidade visual (manter exatamente):** paleta bege/verde (bg `#faf6f0`, verde `#4a7c59`, vermelho `#b54d3a`, âmbar `#a07020`), fontes Lora (títulos, itálico) + Plus Jakarta Sans (corpo), ícones de emoji por categoria (`TAG_ICON`), paletas de donut `GP`/`TP`.

## ARQUITETURA ATUAL (a substituir)

- Supabase com **uma única tabela `app_state`** com uma linha (`id='main'`) contendo um JSON com todo o estado: `{goal, receitas[], despesas[], recorrentes[], categories{}}`.
- Sem autenticação: chave anônima + RLS liberado para todos (`using (true)`).
- Persistência: `loadState()` carrega o JSON inteiro; `saveState()` (debounced) sobrescreve o JSON inteiro.
- **BUG CRÍTICO conhecido:** "último que salva ganha". Dois dispositivos abertos = o que salvar por último apaga o que o outro inseriu. Isso já causou perda de lançamentos. A nova arquitetura DEVE eliminar esse problema.

## OBJETIVO GERAL

Transformar em app multi-usuário com login, mantendo o visual, com dados por usuário em tabelas relacionais (fim do JSON único), onboarding para novos usuários, e paridade de funcionalidades entre desktop e mobile. Meus dados atuais DEVEM ser migrados sem perda.

---

## BLOCO 1 — Fundação multi-usuário + migração (FAZER PRIMEIRO)

### 1.1 Novo schema no Supabase

Criar tabelas (gerar os SQLs para eu rodar no SQL Editor):

- `profiles` — `id uuid PK` (= `auth.users.id`), `name text`, `birth_date date`, `avatar_url text`, `start_date date` (data de início do controle), `goal numeric`, `created_at`.
- `transactions` — `id uuid PK default gen_random_uuid()`, `user_id uuid FK -> auth.users`, `kind text check (kind in ('receita','despesa'))`, `name text`, `value numeric`, `tag text`, `meio text` (nullable, só despesas), `date date` (nullable), `month int` (0-11, manter para compatibilidade com a UI atual), `year int default 2026`, `created_at`.
- `recurrents` — `id uuid PK`, `user_id`, `kind`, `name`, `value numeric` (0 = variável), `tag`, `meio`, `created_at`.
- `categories` — `id uuid PK`, `user_id`, `type text check (type in ('receita','despesa','meio'))`, `name text`, `unique(user_id, type, name)`.

**RLS obrigatório em todas:** política `auth.uid() = user_id` para select/insert/update/delete (em `profiles`, `auth.uid() = id`).

Storage: bucket `avatars` (público para leitura, escrita só do próprio usuário) para foto de perfil.

### 1.2 Migração dos MEUS dados atuais

- Gerar um script de migração (pode ser um snippet JS para rodar no console do navegador logado, ou SQL) que leia o JSON atual da tabela `app_state` (`id='main'`) e insira tudo nas tabelas novas vinculado ao MEU `user_id` (vou criar minha conta primeiro e te passar o UID, ou o script pega de `auth.uid()`).
- Mapear: `receitas[]` e `despesas[]` -> `transactions` (com `kind`); `recorrentes[]` -> `recurrents`; `categories{}` -> `categories`; `goal` -> `profiles.goal`; meu `start_date` = `2026-01-01`.
- Após migração, exibir um relatório de validação: contagem de receitas, despesas, recorrentes, categorias, soma total de receitas e de despesas — para eu conferir com o app atual ANTES de desativar `app_state`.
- **NÃO apagar `app_state`** — deixar como backup. O app novo simplesmente não a usa.

### 1.3 Camada de dados no app

- Substituir `loadState()`/`saveState()` por operações granulares: inserir/atualizar/excluir linha a linha (`insert`, `update`, `delete` no Supabase). Nada de sobrescrever estado inteiro.
- Ao abrir o app / voltar ao foreground (`visibilitychange`), recarregar do banco.
- **Indicador de sync:** NENHUM selo quando tudo funciona. Aparecer aviso discreto SOMENTE quando uma gravação falhar (ex.: offline), com re-tentativa automática ao reconectar. (Se eu decidir remover até isso, será fácil apagar.)

## BLOCO 2 — Autenticação + Onboarding

### 2.1 Auth

- Supabase Auth com email + senha (com confirmação de email padrão do Supabase).
- Telas: login, cadastro, "esqueci minha senha".
- Sessão persistente (o PWA não deve pedir login toda vez).

### 2.2 Fluxo de primeiro acesso (wizard, mobile-first, funciona nos dois layouts)

1. **Cadastro** (email + senha) → confirmação de email.
2. **Perfil**: nome (obrigatório), data de nascimento (opcional), foto (opcional, upload para bucket `avatars`; fallback = iniciais do nome num círculo verde).
3. **Ponto de partida** — 3 opções:
   - "Começar hoje" → `start_date` = hoje;
   - "Início do ano" → `start_date` = 01/jan do ano corrente;
   - "Data personalizada" → date picker.
4. **Meta**: valor a economizar até 31/dez. Exibir o cálculo automático da meta mensal proporcional aos meses restantes desde `start_date`.
5. **Dados anteriores** (pular esta etapa se escolheu "Começar hoje"): opções "Preencher manualmente depois" ou "Importar planilha" (ver 2.3).

### 2.3 Importação de planilha (.xlsx)

- Botão para baixar um **modelo .xlsx** gerado pelo app (usar SheetJS via CDN) com colunas: `Tipo` (Receita/Despesa), `Transação`, `Valor`, `Categoria`, `Meio` (vazio para receitas), `Data` (dd/mm/aaaa; aceitar também só mês "jan/2026").
- Importador: parse com SheetJS, validação linha a linha, tela de preview ("X transações válidas, Y com erro: linha N — motivo"), categorias desconhecidas → oferecer criar na hora. Só grava após confirmação.
- A importação também fica acessível depois, em Configurações (não só no onboarding).

### 2.4 Exportação (.xlsx)

- Em Configurações: exportar todas as transações do usuário no mesmo formato do modelo.

## BLOCO 3 — Correções e paridade desktop/mobile

1. **Campo de data no formulário mobile** de nova transação (hoje só existe mês; a data vai vazia). Manter mês derivado da data automaticamente quando data for preenchida.
2. **Editar transações** (nome, valor, tag, meio, data, mês) no desktop (modal, reaproveitar o de criação) e no mobile (botão "Editar" no sheet de detalhe que já existe).
3. **Confirmação antes de excluir** transação e recorrente ("Tem certeza?"), nos dois layouts.
4. **Recorrentes e Categorias no mobile**: hoje NÃO existem telas para gerenciá-las no mobile (só é possível usar recorrentes como atalho). Criar telas completas (listar, criar, editar, excluir) dentro do menu de perfil (Bloco 4). Editar recorrente também deve existir no desktop (hoje só cria/exclui).
5. **Detalhe do mês no desktop**: clicar no card de um mês (página Meses) abre modal com o mesmo conteúdo do sheet mobile: receitas/despesas/saldo/poupança, gastos por categoria com barras, top 5 maiores despesas.
6. **Remover a seção "Análise de IA"** do desktop por completo (a chamada à API Anthropic não funciona em produção e decidimos descontinuar).
7. **Meta com contexto de data**: card da meta (desktop e mobile) mostra "desde {data de início}" e o cálculo de meta mensal usa `start_date` do perfil, não assume janeiro.
8. **Saudação personalizada**: no mobile, header "Olá, {primeiro nome}! 👋"; no desktop, exibir nome + avatar na sidebar.

## BLOCO 4 — Menu de perfil

- **Mobile:** o ícone no canto superior direito (hoje uma folha 🌿) vira o avatar do usuário (foto ou iniciais). Toque abre menu/sheet com: **Perfil** (editar nome, nascimento, foto, email*, senha), **Configurações** (Recorrentes, Categorias, Meta e data de início, Importar/Exportar planilha), **Sair** (logout → volta à tela de login).
- **Desktop:** mesmo menu acessível pela sidebar (avatar + nome no topo ou rodapé da sidebar).
- *Alteração de email pode usar o fluxo padrão do Supabase (confirmação no email novo).

---

## REQUISITOS TÉCNICOS E RESTRIÇÕES

- **Manter arquitetura de arquivo único** o máximo possível (`index.html` + `sw.js` + `manifest.json` + ícones) para o deploy continuar sendo drag-and-drop no Netlify. Se precisar dividir JS em módulos, tudo deve continuar funcionando com deploy estático simples (sem build step obrigatório; se usar build, incluir instruções e o output pronto).
- Bibliotecas via CDN: Chart.js (já usado), supabase-js v2 (já usado), SheetJS (adicionar).
- **Service worker:** incrementar o nome do cache a cada versão (`finctrl-vN`) e adicionar auto-update (skipWaiting + clients.claim + reload prompt ou reload automático quando um novo SW assumir). Já tivemos problema sério de cache preso em versão antiga no PWA Android.
- Credenciais Supabase ficam em constantes no topo do JS como hoje (vou preenchê-las). Deixar placeholders `COLE_SUA_URL_AQUI` / `COLE_SUA_ANON_KEY_AQUI`.
- Ano fiscal: o app hoje é hardcoded para 2026 em vários pontos. Usar `year` nas transações e o ano corrente como padrão, preparando para a virada de ano (não precisa de UI de troca de ano agora, mas o dado deve estar pronto).
- PT-BR em toda a interface. Formato monetário `R$ 1.234,56` (helpers `fmt`/`fmtK` já existem).

## ORDEM DE ENTREGA E VALIDAÇÃO (siga esta sequência)

1. SQLs do schema novo + políticas RLS + bucket. **Pare e me instrua a rodar e criar minha conta.**
2. Script de migração dos meus dados + relatório de validação (contagens e somas). **Pare para eu conferir os números contra o app atual.**
3. App novo completo (Blocos 2, 3, 4). Testes que consigo fazer localmente antes do deploy (instruções de como testar auth localmente — ex.: `npx serve` — já que `file://` não funciona com Supabase).
4. Checklist de deploy: subir no Netlify, testar desktop, reinstalar PWA no Android (instruções de limpeza de SW se necessário).

## CRITÉRIOS DE ACEITE (o que eu vou testar no final)

- [ ] Login/logout funcionando; sessão persiste no PWA.
- [ ] Meus dados históricos (jan–jun/2026) aparecem completos e com os mesmos totais de antes.
- [ ] Lançar despesa no celular e vê-la no desktop segundos depois (e vice-versa) SEM perda — inclusive com os dois abertos ao mesmo tempo.
- [ ] Data da transação salvável no mobile.
- [ ] Editar transação nos dois layouts; excluir pede confirmação.
- [ ] Recorrentes e categorias gerenciáveis nos dois layouts, sincronizadas.
- [ ] Clique no mês (desktop) abre detalhe igual ao mobile.
- [ ] Seção de IA removida.
- [ ] Onboarding completo funciona para uma conta nova (testarei criando uma segunda conta): perfil, ponto de partida, meta, importação por planilha (com modelo baixável e preview de erros).
- [ ] Menu do avatar com Perfil/Configurações/Sair nos dois layouts; "Olá, {nome}!" no mobile.
- [ ] Nenhum selo de sync em operação normal; aviso apenas em falha.
- [ ] Novo usuário não vê nenhum dado meu; eu não vejo dados dele.

Trabalhe de forma incremental, explicando as decisões importantes, e me pergunte quando houver ambiguidade em vez de assumir.
