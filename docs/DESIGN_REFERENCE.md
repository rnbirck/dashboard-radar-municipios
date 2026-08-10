# Referência de design e comportamento

## 1. Objetivo visual

O novo **Radar dos Municípios do Rio Grande do Sul** deve preservar a leitura institucional, sóbria e orientada a dados do dashboard atual, enquanto transforma a experiência em uma aplicação estática React/Vite mais rápida, responsiva e previsível.

A referência principal é o estado atual do projeto Dash em `DASHBOARDS/RANKING-MUNICIPIOS`, complementado pelos screenshots fornecidos. A migração não deve ser uma cópia literal do HTML gerado pelo Dash: deve reproduzir a hierarquia visual, a terminologia e os fluxos, com componentes React próprios e acessíveis.

Princípios:

- leitura rápida do contexto selecionado antes dos gráficos;
- filtros sempre coerentes entre si;
- progressão explícita de região para município, dimensão e indicador;
- comparação do município com sua região funcional;
- posição em ranking apresentada como posição (menor número é melhor), sem ambiguidade;
- estados sem seleção e sem dados tão cuidados quanto os estados preenchidos;
- alta densidade de informação sem perder alinhamento, contraste e respiro.

## 2. Identidade visual a preservar

### Paleta observada

Os tokens abaixo derivam de `assets/style.css` e dos gráficos Plotly atuais. Devem ser consolidados como CSS custom properties no novo app.

| Papel | Referência |
|---|---|
| Barra de navegação / azul institucional | `#061f3b` |
| Texto principal | `#102542` |
| Texto secundário | `#5d6b7e` / `#526277` |
| Verde-petróleo | `#006c67` |
| Verde-petróleo suave | `#eaf4f2` |
| Dourado/laranja principal | `#b7791f` e variações `#c9761c`, `#8a5a12` |
| Fundo dourado suave | `#fff2df` / `#fff4dc` / `#fff7ed` |
| Sucesso | `#07845f` |
| Alerta/queda | `#d92f3a` |
| Linhas e bordas | `#dfe6ec` |
| Painéis | `#ffffff` |
| Sombra | `0 10px 26px rgba(20, 34, 50, 0.08)` |

### Tipografia, formas e iconografia

- Família atual: `Inter, Segoe UI, Arial, sans-serif`.
- Títulos em azul escuro, peso alto; rótulos e notas em escala menor e contraste secundário.
- Cards brancos, cantos arredondados, borda clara e sombra suave.
- Ícones lineares no padrão Bootstrap Icons; manter coerência sem depender obrigatoriamente da CDN.
- Dourado identifica seleção, município e ação; verde-petróleo apoia contexto institucional e estados positivos.
- Pílulas coloridas comunicam ranking, classificação e variação.
- Gráficos usam fundo transparente, vírgula decimal e comparação em dourado (município) versus cinza-azulado tracejado (mediana regional).
- Logo branca da Unisinos sobre a barra azul. Ativos relevantes atuais: `assets/logo_unisinos_white.png` e `assets/logo_unisinos.png`.

### Arquivo visual de referência

O CSS legado relevante está concentrado em `assets/style.css`. Ele contém tokens globais, shell, home, visão regional, tabela, detalhe municipal, seletores segmentados, gráficos, estados vazios e regras responsivas. Deve servir como inventário visual, não ser copiado integralmente.

## 3. Estrutura de navegação atual

### Navegação principal

| Item | Rota | Comportamento |
|---|---|---|
| Início | `/` | Landing page; painel global de filtros fica oculto. |
| Regiões funcionais | `/ranking-regional` | Abre a visão das nove regiões; ao selecionar uma região, navega para Municípios. |
| Municípios | `/municipios` | Fluxo exploratório e detalhe municipal. Aceita contexto por query string. |
| Ajuda | sem rota funcional identificada | Elemento visual no cabeçalho; precisa de decisão de produto. |
| Núcleo CEI | sem rota funcional identificada | Botão institucional; precisa de URL/destino definido. |

O cabeçalho é persistente, com logo à esquerda, navegação central e ações à direita. A aba ativa recebe sublinhado dourado.

### Query string e persistência de contexto

A rota `/municipios` lê e atualiza parâmetros como:

- `ano`;
- `regiao`;
- `corede`;
- `municipio`.

Isso permite entrar diretamente em um recorte e deve ser preservado no React. A dimensão e o indicador selecionados hoje são principalmente estado interno; recomenda-se avaliar sua inclusão na URL para links reproduzíveis.

### Filtros globais encadeados

- **Ano:** obrigatório, não limpável; padrão é o ano mais recente disponível.
- **Região funcional:** opções dependem do ano.
- **Corede:** opções dependem de ano e região; em Municípios pode restringir municípios mesmo sem região explícita.
- **Município:** busca textual tolerante a acentos; opções dependem do recorte anterior.
- **Limpar filtros:** remove região, Corede e município, preservando o ano.

Regras de shell:

- na Home os filtros ficam ocultos;
- na visão inicial de Regiões funcionais aparecem apenas Ano e Região funcional;
- nas demais situações aparecem os quatro filtros e a ação de limpeza;
- valores inválidos ou incompatíveis vindos da URL são descartados;
- a mudança de um filtro superior invalida seleções descendentes incompatíveis.

## 4. Páginas e estados de tela

### 4.1 Início (`/`)

Conteúdo observado:

- badge “Página inicial”;
- título e texto de apresentação;
- ornamento de órbitas/radar no hero;
- quatro métricas: municípios, regiões funcionais, Coredes e série histórica;
- dois cards de objetivo;
- fluxo “Como navegar” em quatro passos;
- dois cards de descoberta, com links para Regiões funcionais e Municípios.

Dados usados: `load_ranking_data`, `filter_ranking_data` e `get_default_year`, para totais e intervalo da série.

Estado esperado sem dados: métricas com placeholder neutro e mensagem clara, sem quebrar a landing page.

### 4.2 Regiões funcionais (`/ranking-regional`)

Estado inicial:

- filtro compacto com Ano e Região funcional;
- hero “Selecione uma região funcional”;
- métricas de regiões, municípios, Coredes e ano mais recente;
- lista das nove regiões com código, total de municípios, total/lista de Coredes e CTA “Explorar região”;
- nota orientando a seleção.

Interações:

- selecionar uma região no filtro ou clicar no card navega para `/municipios?ano=...&regiao=...`;
- abrir a rota regional limpa região, Corede, município e query anterior.

Dados usados: `filter_ranking_data(ano)`; a página agrega municípios, Coredes e média de `nota_final` por região.

### 4.3 Municípios (`/municipios`)

Esta rota possui quatro estados principais.

#### A. Nenhuma região selecionada

- visão geral semelhante à seleção regional, permitindo escolher uma das regiões funcionais;
- métricas estaduais e lista de regiões.

#### B. Região selecionada, município não selecionado

- hero “Informações dos municípios” e instrução para selecionar uma linha;
- tabela dos municípios da região, opcionalmente filtrada por Corede;
- total de municípios no recorte;
- colunas: posição geral, município, Corede, desempenho no porte populacional e posições nas seis dimensões;
- clique na linha seleciona município e sincroniza a URL.

#### C. Município selecionado, categoria “Geral”

- identidade do município, região e Corede;
- classificação de desempenho no porte populacional;
- posição geral atual, posição do ano anterior e chip de variação;
- seis cards de dimensão com posição atual, anterior e variação;
- seletor segmentado de dimensão;
- histórico da posição geral (eixo de ranking invertido);
- radar das seis dimensões contra a mediana da região;
- tabela de posições por dimensão ao longo dos anos.

#### D. Município selecionado, dimensão específica

- card da dimensão ativa destacado;
- histórico da posição na dimensão;
- radar das notas dos indicadores da dimensão contra a mediana regional;
- tabela histórica das posições nos indicadores;
- seletor de indicador;
- histórico da posição no indicador;
- evolução do valor observado do indicador versus mediana da região;
- metodologia do indicador;
- orientação semântica “valores mais altos/baixos indicam melhor desempenho”.

Dimensões atuais:

1. Educação;
2. Finanças;
3. Meio ambiente;
4. Saúde;
5. Segurança;
6. Socioeconômico.

## 5. Componentes principais

- `AppShell`: cabeçalho, conteúdo, painel global de filtros e estado da rota.
- `TopNavigation`: logo, links ativos e ações institucionais.
- `GlobalFilters`: selects encadeados, busca de município e limpar filtros.
- `Hero` e variações: home, seleção regional e identidade municipal.
- `MetricCard`: número, rótulo, nota e ícone.
- `RegionList` / `RegionCard`: resumo e navegação para um recorte.
- `MunicipalityRankingTable`: tabela densa, rolável, com linhas selecionáveis.
- `MunicipalitySummary`: identificação, classificação e posição geral.
- `DimensionCards`: seis resumos clicáveis com variação anual.
- `SegmentedSelector`: Geral/dimensões e lista de indicadores.
- `RankBadge`, `ClassificationBadge`, `VariationChip` e `StatusPill`.
- `RankHistoryChart`: linha temporal com eixo de posição invertido.
- `RadarComparisonChart`: município versus mediana regional.
- `IndicatorValueChart`: valor do município versus mediana regional.
- `HistoryTable`: anos nas linhas, dimensões/indicadores nas colunas.
- `EmptyState`, `LoadingState` e `ErrorState`.
- `BackAction`: retorno do detalhe para a seleção municipal.

## 6. Regras de UX importantes

- A URL deve refletir ao menos ano, região, Corede e município; carregar ou recarregar a página deve reconstruir o mesmo contexto.
- Não manter município selecionado quando ele não pertence ao novo recorte.
- Ao escolher uma região na página regional, navegar diretamente ao estado de tabela municipal.
- Ao clicar em município, atualizar filtro e URL sem recarregar a página.
- Ao clicar em um card de dimensão, sincronizar o seletor segmentado.
- Seleção ativa usa dourado e deve possuir também marcador acessível além da cor (`aria-current`, `aria-selected` ou texto).
- Rankings usam eixo invertido: posição 1 deve aparecer no topo do gráfico.
- Variação deve considerar que cair numericamente de 5º para 3º é melhora (“Subiu 2”); aumentar para 7º é piora (“Caiu 2”).
- Tabelas largas devem ter rolagem horizontal em telas menores, cabeçalho legível e primeira coluna útil preservada quando viável.
- Dropdown de município deve suportar busca sem acento e teclado.
- Formatação brasileira: vírgula decimal, ponto de milhar, percentuais e moeda conforme metadado do indicador.
- O sentido do indicador é obrigatório antes de colorir ou qualificar desempenho.
- A mediana regional só deve aparecer quando houver amostra válida; a view atual exige mais de um município.
- Alterações de filtro devem evitar “piscar” dados do recorte anterior; usar loading local ou transição atômica.
- O layout deve funcionar em desktop amplo, notebook e mobile; screenshots atuais representam principalmente desktop amplo.

## 7. Textos, ausência de dados e placeholders

### Padrões de texto

- Usar português do Brasil e acentuação correta.
- Títulos descritivos: “Histórico de posição — Educação”, “Evolução do indicador — Autonomia Fiscal”.
- Contexto sempre explícito: município, região, dimensão/indicador e período.
- “Corede” conforme uso atual; validar com a equipe se a forma institucional deve ser “COREDE”.
- Posições formatadas com ordinal: `1º`, `2º`, `30º`.
- Não chamar nota, valor original, média e mediana pelo mesmo termo.

### Placeholders recomendados

- Select de região: “Selecione uma região funcional”.
- Select de Corede: “Todos”.
- Select de município: “Selecione um município”.
- Valor numérico indisponível: `—` (preferível a `-`, desde que adotado consistentemente).
- Carregamento: skeletons nas dimensões do conteúdo final, sem trocar toda a página por spinner.

### Mensagens de ausência

- Sem dados anuais: “Não há dados disponíveis para o ano selecionado.”
- Sem regiões: “Não há dados regionais para o ano selecionado.”
- Sem municípios: “Não há municípios para os filtros selecionados.”
- Sem histórico: “Não há série histórica suficiente para esta análise.”
- Sem mediana: “A mediana regional não está disponível para este recorte.”
- Erro de arquivo: “Não foi possível carregar os dados. Tente novamente.”, com detalhe apenas em ambiente de desenvolvimento.

Nunca transformar ausência em zero. Gráficos vazios devem conservar título/contexto e exibir mensagem dentro do card.

## 8. Screenshots recomendados para `docs/screenshots/`

Usar nomes estáveis, resolução anotada e, se possível, capturar desktop e mobile.

1. `01-home-desktop.png` — Home completa.
2. `02-regioes-sem-selecao-desktop.png` — `/ranking-regional`, ano preenchido, sem região.
3. `03-municipios-regiao-tabela-desktop.png` — região selecionada, sem município.
4. `04-municipio-geral-desktop.png` — detalhe geral completo.
5. `05-municipio-educacao-desktop.png` — dimensão Educação e indicador selecionado.
6. `06-municipio-financas-desktop.png` — dimensão com maior quantidade de indicadores.
7. `07-municipio-meio-ambiente-desktop.png` — exemplo de indicador em que menor valor é melhor.
8. `08-dropdown-municipio-aberto.png` — busca, foco, item selecionado e rolagem.
9. `09-estados-vazios-e-sem-mediana.png` — ausência de dados/histórico/mediana.
10. `10-loading-e-erro.png` — estados transitório e de falha.
11. `11-tabela-hover-selecao-scroll.png` — hover, foco, linha ativa e extremos da rolagem.
12. `12-mobile-home.png` — Home em aproximadamente 390 px.
13. `13-mobile-filtros.png` — painel de filtros e navegação mobile.
14. `14-mobile-detalhe-municipio.png` — cards, gráficos e tabela empilhados.

Os sete screenshots já fornecidos cobrem os itens 1 a 7 e devem ser preservados como referência visual, se houver autorização para copiá-los para o repositório.
