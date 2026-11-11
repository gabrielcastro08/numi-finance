# Changelog — Numi

## [1.4.0] — categorias, meses, valor e calendário
- Categorias e limites redesenhados: abas, cards com emoji e uso no ano, barra de limite do mês e painel lateral
- Escolher emoji ao criar categoria; editar nome, emoji e limite das existentes (renomear atualiza lançamentos e recorrentes)
- Meses redesenhado: resumo do ano (melhor mês, mais apertado, média, meses no azul) e cards maiores com barras de receita × despesa
- Campo de valor estilo Nubank: digite só os números e a vírgula se ajusta sozinha
- Calendário próprio no lugar do seletor de data do navegador, com atalhos Hoje / Ontem / Sem data
- Correção: no mobile, editar um lançamento ou lançar a partir de uma recorrente abria com o valor vazio

## [1.3.0] — nova identidade, análise com filtros e planejamento
- Desktop redesenhado: barra lateral verde-escura, superfícies com profundidade, tipografia maior
- Nova tela de Início (desktop): saudação, resumo do mês, destaques automáticos, recorrentes, meta, limites e saúde financeira
- Abertura com a logo "se escrevendo"
- Análise com painel de filtros (período, tipo, categorias, meio de pagamento, comparação com período anterior), igual no desktop e no mobile
- Seletor de ano e Visão geral com todos os anos (ano a ano, patrimônio acumulado, categorias por ano, compromissos futuros)
- Compras parceladas (2 a 72x, valor da parcela ou total), com exclusão de uma ou de todas as parcelas
- Recorrentes com dia do mês (data sugerida) e "Lançar pendentes" em lote
- Limite mensal opcional por categoria, com aviso ao chegar a 80% e 100%
- Excluir com "Desfazer" no lugar do "Tem certeza?"
- Alterações feitas sem internet ficam salvas no aparelho e são enviadas depois, mesmo fechando o app; o app abre offline com os últimos dados

## [1.2.0] — recorrentes, autocomplete e gráficos
- Novo ícone do app: logo branca sobre verde, sem cantos transparentes (ícone maskable correto no Android)
- Recorrentes no mobile: pendentes do mês primeiro, marcação de "lançada este mês" e tela "Ver todas" com busca e filtro
- Autocomplete de recorrentes ao digitar o nome (mobile e desktop), sem diferenciar acentos; no desktop, navegável por teclado
- Correção: gráficos de categoria no mobile abriam vazios até clicar em um filtro
- Gráficos de categoria ordenados por valor, com valor em R$ na legenda
- Economia acumulada para no último mês com dados

## [1.1.0] — identidade visual
- Nova paleta de cores alinhada ao verde do logo Numi
- Logo Numi substitui texto "fin//ctrl" / "Controle Financeiro"
- Novos ícones do app com fundo verde gradiente
- Splash screen na abertura do app
- Favicon no browser
- Auto-update: banner "nova versão disponível" sem precisar reinstalar o app

## [1.0.0] — lançamento inicial
- Dashboard, Receitas, Despesas, Meses, Recorrentes, Categorias
- Interface desktop + mobile (PWA)
- Sincronização via Supabase
