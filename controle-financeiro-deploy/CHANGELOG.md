# Changelog — Numi

## [1.10.0] — o Numi faz coisas por você
- Peça no chat e o Numi lança receitas e despesas (inclusive parceladas), edita ou exclui lançamentos, cria objetivos, guarda ou retira dinheiro de um objetivo, cria recorrentes e define limites de categoria
- Toda ação aparece como um cartão: dá para ajustar descrição, valor, data, categoria e pagamento antes de confirmar; nada acontece sem o clique em Confirmar
- Vários pedidos numa frase viram vários cartões, cada um com sua decisão
- Depois de confirmar, o cartão mostra "Desfazer"

## [1.9.1] — o castor é o Numi
- O assistente agora é o próprio Numi, o castor: fala em primeira pessoa ("Oi! Eu sou o Numi") e o botão vira "Fale com o Numi"

## [1.9.0] — meta flexível
- A meta de economia deixou de ser obrigatória e anual. Três jeitos de usar: só controlar os gastos (sem meta), guardar um valor até uma data, ou guardar um valor todo mês
- A escolha aparece no primeiro acesso (o padrão é "só controlar") e pode ser trocada a qualquer momento em Meta de economia
- Opção de começar a contar a partir do mês atual, para quem cria a meta no meio do caminho
- Cartões, destaques, saúde financeira e o assistente se adaptam ao tipo de meta; sem meta, a saúde financeira usa a taxa de poupança
- Metas anuais antigas continuam valendo (viram "guardar até 31/12")

## [1.8.0] — assistente
- Assistente com IA (Claude Sonnet 5.5): botão do castor abre um chat que responde sobre seu mês, gastos, categorias e objetivos, consultando os seus lançamentos
- Linguagem simples e amigável, respostas aparecendo enquanto são escritas, sugestões de perguntas e "nova conversa"
- Freios de custo: limite diário de perguntas e de gasto por usuário, controlados no servidor; a chave da IA fica só no Supabase
- Nesta fase o assistente só consulta e analisa; lançar/editar com confirmação e pesquisa na web vêm nas próximas
- Botão de ver a senha no login, no cadastro e na troca de senha

## [1.7.0] — objetivos
- Nova área de Objetivos (aba no mobile, item no menu do desktop): viagem, compra, curso, reserva…
- Cada objetivo tem valor estimado, data, "caixinha" (guardar e retirar dinheiro) e orçamento detalhado por itens
- O app calcula quanto guardar por mês, o seu ritmo real, quando você chega lá e a sua economia depois de realizar
- Visão de conjunto: livre para alocar, quanto você costuma guardar × quanto os objetivos pedem, com sugestão do que adiar
- Linha do tempo com a economia projetada e cada objetivo na data
- Simulador "e se eu guardar…" no detalhe do objetivo
- Prioridades (subir/descer), pausar, "Realizei!" (registra a despesa e comemora) e excluir com desfazer
- Card de objetivos na tela inicial

## [1.6.1] — tipografia
- Títulos e valores em Fraunces Bold (no lugar da Lora itálica); textos corridos seguem em Plus Jakarta Sans

## [1.6.0] — mascote
- Novo mascote: um castor
- Abertura com o castor fazendo malabarismo com moedas de R$ (animação em código, leve e funcionando offline)
- Castor acenando no login e no primeiro acesso
- Na tela inicial, o castor comenta o mês: comemora no azul e fica preocupado no vermelho
- Telas vazias com o castor (sem lançamentos, sem recorrentes, busca sem resultado)
- Aviso de limite de categoria e aviso de sem conexão com o castor

## [1.5.0] — local/destinatário, tooltips e mês atual
- Campo opcional de local da compra (ou destinatário, no Pix) nas despesas, com sugestões do histórico
- Análise: novo card "Onde você mais gasta"; exportação inclui a coluna Local/Destinatário
- Tooltips dos gráficos no visual do app
- A tela inicial mostra sempre o mês atual; parcelas futuras não entram em meta, score e economia acumulada
- Meses: mês futuro com parcelas aparece como "previsto"
- Removida a logo transparente do painel do Início

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
