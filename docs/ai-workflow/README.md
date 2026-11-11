# Como o Numi foi construído com um agente de IA

O código do Numi foi escrito pelo **Claude Code**, um agente de programação, a partir de
especificações que eu escrevi. Esta pasta guarda essas especificações exatamente como
foram usadas.

| Spec | Objetivo | Resultado |
|------|----------|-----------|
| [`01-multiusuario-e-supabase.md`](01-multiusuario-e-supabase.md) | Transformar um app single-user (estado num JSON único) em produto multiusuário | Auth, schema relacional com RLS, migração validada, onboarding, import/export `.xlsx`, paridade desktop/mobile |
| [`02-identidade-visual.md`](02-identidade-visual.md) | Aplicar a nova marca "Numi" sem tocar em lógica de dados | Paleta, logo, ícones do PWA, splash screen, banner de atualização |

## O que funcionou

**1. Contexto antes de tarefa.** Cada spec começa descrevendo a arquitetura atual *e o
problema real* (ex.: "último que salva ganha" causando perda de lançamentos). Com o porquê
explícito, o agente toma decisões melhores nos pontos que a spec não cobre.

**2. Restrições explícitas.** "Manter arquivo único, sem build step obrigatório",
"não tocar em funções de dados, Supabase ou autenticação", "manter a identidade visual
exatamente". Restrições claras reduzem o espaço de soluções e evitam refatorações não pedidas.

**3. Pontos de parada para validação humana.** A spec de migração obriga o agente a
**parar** depois do schema (para eu rodar o SQL e criar a conta) e depois do script de
migração (para eu conferir contagens e somas contra o app antigo) antes de seguir. Dados
reais nunca dependeram de "confiar" no agente.

**4. Critérios de aceite testáveis.** Cada spec termina com um checklist do que será
verificado ("lançar despesa no celular e vê-la no desktop segundos depois, com os dois
abertos"). Isso define "pronto" de forma objetiva para os dois lados.

**5. Escopo isolado por spec.** A mudança de identidade visual veio numa spec separada,
proibida de tocar em dados. Mudanças de risco diferente não se misturam.

## O que eu faria diferente

- Pedir **testes automatizados** (ao menos da camada de dados e do importador de
  planilha) como entrega da spec, não só checklist manual.
- Quebrar o `index.html` em módulos ES nativos (ainda sem build step) para facilitar
  revisão de diffs.
