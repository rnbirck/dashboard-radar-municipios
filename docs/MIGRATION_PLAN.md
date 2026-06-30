# Plano de migração para React/Vite estático

## 1. Resumo da arquitetura atual

O projeto de referência é uma aplicação multipágina Dash/Python implantada no Railway.

```text
Navegador
  -> Dash (layout + callbacks + Plotly)
     -> src/data_loader.py (fachada)
        -> src/data/repository.py (Pandas, cache TTL, SQLAlchemy/Supabase)
           -> PostgreSQL/Supabase e tabelas derivadas
```

### Camadas e arquivos relevantes

- `app.py`: shell, rotas Dash Pages, navegação, filtros globais e sincronização básica com URL.
- `src/views/home.py`: landing page e métricas gerais.
- `src/views/ranking_regional.py`: visão das regiões e navegação para o recorte municipal.
- `src/views/municipios.py`: tabela regional, detalhe municipal, dimensões, indicadores, gráficos e callbacks.
- `src/data_loader.py`: exporta a API de leitura usada pelas views.
- `src/data/repository.py`: conexão direta ou Supabase API, normalização, fallback, consultas e cache TTL.
- `src/indicator_metadata.py`: metodologia textual dos indicadores.
- `assets/style.css`: todo o sistema visual e responsivo atual.
- `assets/logo_unisinos_white.png`, `assets/logo_unisinos.png`: marcas.
- `queries/*.sql`: tabelas otimizadas, materialized view, manutenção e consulta principal.
- `update_data.py`: pipeline manual de importação de Excel, atualização das bases e tabelas derivadas; fora do runtime web.
- `Procfile`: Gunicorn no Railway.

### Rotas e funções de dados

| Rota | Arquivo | Funções de dados diretamente usadas | Finalidade |
|---|---|---|---|
| `/` | `home.py` | `load_ranking_data`, `filter_ranking_data`, `get_default_year` | Totais, série histórica e links de entrada. |
| `/ranking-regional` | `ranking_regional.py` | `filter_ranking_data` | Agregação anual por região e Corede; navega a `/municipios`. |
| `/municipios` — seleção/tabela | `municipios.py` | `load_ranking_data`, `filter_ranking_data`, `load_category_positions` | Lista regional, classificação e posições por dimensão. |
| `/municipios` — resumo | `municipios.py` | `load_municipio_summary_data`, `load_municipio_category_history_data` | Cabeçalho, posição geral, cards e históricos. |
| `/municipios` — dimensão/indicador | `municipios.py` | `load_category_data`, `load_municipio_indicator_data`, `load_indicator_regional_medians`, `load_indicator_names` | Radar, tabelas, evolução, mediana e rótulos. |

`src/indicator_metadata.py` fornece metodologia, e regras internas de `municipios.py` definem rótulos, direção, multiplicadores e formatação dos indicadores.

### Fontes que precisam ser congeladas em JSON

Fontes de runtime confirmadas:

| Fonte atual | Papel | Destino estático recomendado |
|---|---|---|
| `public.ranking_municipios` | Ranking base, notas, região/Corede e classificação | índices globais e rankings anuais por região |
| `public.dash_municipios_resumo` | Resumo anual do município e posições por dimensão | resumo municipal por ano/região |
| `public.dash_municipio_categoria_historico` | Histórico de nota/posição por dimensão | detalhe histórico por município |
| `public.dash_municipio_indicadores` | Nota, ranking e valor original por indicador | detalhe por município/dimensão |
| `public.mv_municipio_indicador_mediana_regiao` | Medianas regionais de nota e valor | comparativos por região/ano/dimensão |
| `public.base_educacao` | fallback legado por dimensão | somente pipeline, não publicar se as derivadas forem completas |
| `public.base_financas` | fallback legado por dimensão | idem |
| `public.base_meio_ambiente` | fallback legado por dimensão | idem |
| `public.base_saude` | fallback legado por dimensão | idem |
| `public.base_seguranca` | fallback legado por dimensão | idem |
| `public.base_socioeconomico` | fallback legado por dimensão | idem |
| fonte externa `resumo_indicadores...xlsx` | nomes amigáveis | incorporar a catálogo de indicadores |
| `src/indicator_metadata.py` | metodologia | migrar para catálogo JSON/TypeScript validado |

As tabelas `dash_regioes_resumo`, `dash_regiao_ranking`, `dash_regiao_historico` e `dash_regiao_municipio_metricas` existem no SQL de preparação, mas não aparecem como fonte do runtime inspecionado. Antes de gerar JSON, decidir se elas substituem agregações atuais ou se são legado não utilizado.

## 2. Arquitetura proposta

```text
Pipeline anual (privado / CI ou execução local)
  Supabase/PostgreSQL + planilhas + metadados
    -> validação e transformações determinísticas
    -> JSON versionado + manifest + checksums
       -> public/data/<versão>/...

Cloudflare Pages
  React + Vite (arquivos estáticos)
    -> carrega manifest/index pequenos
    -> busca JSON sob demanda por rota/recorte
    -> filtra e agrega no navegador
```

O frontend de produção não deve conter credenciais nem consultar Supabase. A geração anual pode continuar em Python, aproveitando regras já validadas, mas deve ser um processo separado do build web.

### Decisões recomendadas

- React + TypeScript + Vite.
- React Router com rotas `/`, `/ranking-regional` e `/municipios`.
- Estado navegável em `URLSearchParams`; estado efêmero local para hover e UI.
- Biblioteca de gráficos escolhida por capacidade real de radar, linha, acessibilidade e tamanho de bundle; fazer prova de conceito antes de fixar.
- Fetch nativo com uma camada de repositório estático; cache do navegador e lazy loading por recorte.
- Schemas de dados validados na geração e, opcionalmente, na fronteira de leitura do frontend.
- CSS próprio com tokens; não portar seletores específicos do DOM do Dash (`:has(...)` e classes Plotly) sem reavaliação.
- Cloudflare Pages com fallback de SPA (`_redirects`) ou roteamento compatível, além de cabeçalhos de cache por versão.

## 3. Estrutura inicial sugerida

Estrutura futura — não criada nesta etapa:

```text
/
├─ docs/
│  ├─ DESIGN_REFERENCE.md
│  ├─ MIGRATION_PLAN.md
│  └─ screenshots/
├─ public/
│  ├─ brand/
│  ├─ _headers
│  ├─ _redirects
│  └─ data/
│     ├─ manifest.json
│     └─ vYYYY-MM-DD/
│        ├─ catalog.json
│        ├─ regions/{year}.json
│        ├─ rankings/{year}/{region}.json
│        ├─ municipalities/{municipality-id}/summary.json
│        └─ municipalities/{municipality-id}/{dimension}.json
├─ scripts/
│  ├─ export-data/
│  ├─ validate-data/
│  └─ README.md
├─ src/
│  ├─ app/
│  │  ├─ router.tsx
│  │  └─ AppShell.tsx
│  ├─ assets/
│  ├─ components/
│  │  ├─ charts/
│  │  ├─ filters/
│  │  ├─ navigation/
│  │  ├─ tables/
│  │  └─ ui/
│  ├─ data/
│  │  ├─ repository.ts
│  │  ├─ schemas.ts
│  │  └─ formatters.ts
│  ├─ features/
│  │  ├─ home/
│  │  ├─ regions/
│  │  └─ municipalities/
│  ├─ hooks/
│  ├─ pages/
│  ├─ styles/
│  │  ├─ tokens.css
│  │  ├─ global.css
│  │  └─ responsive.css
│  ├─ types/
│  └─ main.tsx
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
└─ vite.config.ts
```

Usar identificador municipal estável (preferencialmente código oficial/`id_municipio`), nunca o nome, nos caminhos dos arquivos e chaves internas.

## 4. Estratégia de JSONs estáticos

### Granularidade

Evitar um único JSON com toda a base e também milhares de arquivos minúsculos.

1. `manifest.json`: versão, data de geração, anos, ano padrão, schema version, contagens e checksums.
2. `catalog.json`: regiões, Coredes, municípios, dimensões, indicadores, nomes, unidades, direção e metodologia.
3. `regions/{year}.json`: cartões e métricas da visão regional.
4. `rankings/{year}/{region}.json`: tabela municipal do recorte, incluindo posições das seis dimensões.
5. `municipalities/{id}/summary.json`: contexto e série geral/dimensões de todos os anos.
6. `municipalities/{id}/{dimension}.json`: indicadores, rankings, valores e medianas de todos os anos.

Essa divisão mantém as páginas iniciais leves e carrega detalhes somente após selecionar um município/dimensão.

### Pipeline anual

1. Ler as fontes com credenciais apenas no ambiente de exportação.
2. Fixar um snapshot transacional ou uma data de corte.
3. Normalizar textos, tipos, nulos, ordens e IDs.
4. Calcular/validar posições, variações, agregações e medianas.
5. Enriquecer indicadores com nome, unidade, casas decimais, multiplicador, direção e metodologia.
6. Gerar em diretório temporário versionado.
7. Validar schemas, integridade referencial e invariantes.
8. Executar testes de regressão contra amostras conhecidas do dashboard antigo.
9. Gerar manifest e checksums.
10. Publicar os arquivos e só então alterar o ponteiro do manifest ativo.

### Contrato mínimo de dados

Cada payload deve informar `schemaVersion`, `dataVersion` e `generatedAt`. Valores ausentes devem ser `null`, nunca strings vazias, `NaN` ou zero artificial. Campos numéricos permanecem números; formatação pertence ao frontend.

O catálogo do indicador deve incluir:

- chave estável;
- nome de exibição;
- dimensão;
- descrição/metodologia;
- unidade;
- tipo de formatação;
- número de casas decimais;
- multiplicador, quando aplicável;
- direção (`higher_is_better`, `lower_is_better` ou `neutral`);
- fonte/período de referência, se disponível.

### Cache e publicação

- JSONs em diretório versionado: cache longo e `immutable`.
- `manifest.json`: cache curto ou revalidação.
- Publicação atômica por nova versão, mantendo a versão anterior para rollback.
- Considerar compressão Brotli/Gzip fornecida pela plataforma e medir tamanhos reais.
- Não versionar segredos, URLs privadas ou dumps brutos no repositório público.

## 5. Fases de migração

### Fase 0 — Baseline documental (esta etapa)

- inventário de rotas, estados, dados e identidade;
- screenshots de referência;
- decisões pendentes registradas.

### Fase 1 — Contrato e exportador de dados

- definir schemas e IDs;
- produzir uma amostra de JSON com dois anos, duas regiões e alguns municípios;
- reconciliar resultados com o app Dash;
- documentar comando anual e logs.

### Fase 2 — Fundação React/Vite

- inicializar React/TypeScript/Vite;
- configurar lint, testes, aliases, router e deploy do Cloudflare Pages;
- implementar tokens, shell, navegação, estados de erro e repositório de JSON.

### Fase 3 — Home e Regiões funcionais

- reproduzir landing page;
- implementar filtros Ano/Região e visão das regiões;
- validar responsividade, teclado e deep link.

### Fase 4 — Lista municipal

- filtros completos e encadeados;
- tabela regional, classificação, posições e seleção por URL;
- virtualização apenas se medições mostrarem necessidade.

### Fase 5 — Detalhe geral do município

- resumo, cards de dimensão, histórico geral, radar e tabela histórica;
- comparação com mediana regional.

### Fase 6 — Dimensões e indicadores

- seletores, radar por dimensão, históricos e valores observados;
- metodologia, unidade, direção e ausência de dados.

### Fase 7 — Paridade, acessibilidade e publicação

- regressão numérica e visual;
- testes mobile, teclado, contraste e leitores de tela;
- orçamento de performance;
- publicação paralela e aceite antes de desligar Railway/Supabase do runtime.

## 6. Riscos e pontos de atenção

| Risco | Tratamento |
|---|---|
| Regras de negócio misturadas com callbacks e construção visual | Extrair e testar contrato antes de implementar componentes. |
| Diferenças entre média e mediana | Nomear explicitamente e validar cada gráfico; o app usa mediana regional em comparativos municipais. |
| Direção/formatação de indicadores mantida em código | Centralizar em catálogo versionado e falhar a geração se faltar metadado. |
| Fallbacks entre tabelas derivadas e bases originais | Escolher uma fonte canônica no exportador; não replicar fallback silencioso no navegador. |
| Classificação depende de dados de regressão/porte | Confirmar origem e fórmula antes de congelar JSON. |
| Deep links incompletos | Definir URL canônica e testes de recarga/voltar/avançar. |
| Volume de JSON e memória em mobile | Particionar por ano/região/município e medir payload comprimido. |
| Nomes municipais como chave | Usar ID estável; nomes só para exibição e busca. |
| Acentuação observada como mojibake em saídas do terminal | Garantir UTF-8 ponta a ponta e teste automatizado de caracteres. |
| Dependência de CDN para ícones/fontes | Hospedar localmente ou oferecer fallback; evitar ponto único externo. |
| CSS legado acoplado ao DOM do Dash/Plotly | Recriar estilos por componentes; portar tokens e comportamento, não seletores. |
| Cloudflare SPA em acesso direto às rotas | Configurar rewrite/fallback e testar refresh em cada rota. |
| Atualização anual parcialmente publicada | Versionamento, validação e troca atômica do manifest. |
| Ajuda e Núcleo CEI sem destino funcional | Definir URLs/diálogo antes do aceite final. |
| Screenshots apenas em desktop amplo | Criar baseline de notebook e mobile antes da implementação final. |

## 7. Critérios de validação

### Dados

- anos, 497 municípios, 9 regiões e 28 Coredes reconciliados para o snapshot de referência;
- nenhuma duplicidade de ID no mesmo ano/recorte;
- município pertence a uma região e Corede válidos;
- posições estão entre 1 e o total do recorte;
- variação anual possui sinal e texto corretos;
- dimensões e indicadores coincidem com o catálogo;
- valores ausentes permanecem ausentes;
- medianas usam o mesmo universo e regra da materialized view atual;
- amostras dos screenshots (por exemplo, Picada Café/RF3) conferem numericamente.

### Funcionalidade

- três rotas acessíveis diretamente e por navegação interna;
- filtros encadeados e limpar filtros funcionam;
- URL restaura ano, região, Corede e município;
- voltar/avançar do navegador restaura estado;
- todos os quatro estados de `/municipios` são alcançáveis;
- seletores de dimensão/indicador atualizam cards, gráficos e tabelas de forma consistente;
- loading, vazio, erro e ausência de mediana são tratados.

### Visual e acessibilidade

- comparação visual aprovada contra screenshots em larguras definidas;
- contraste WCAG AA para texto e controles;
- navegação completa por teclado, foco visível e nomes acessíveis;
- tabelas e gráficos possuem resumo textual ou alternativa acessível;
- cor não é o único meio para comunicar seleção/variação;
- layout sem sobreposição em desktop, notebook e 390 px.

### Performance e operação

- nenhum segredo ou chamada ao Supabase no bundle do navegador;
- páginas iniciais não baixam detalhes de todos os municípios;
- payloads e bundle possuem orçamento definido após a prova de conceito;
- build reproduzível e deploy de preview no Cloudflare Pages;
- pipeline anual documentado, validado e com rollback.

## 8. Decisões pendentes antes da implementação

1. Biblioteca de gráficos e seu impacto no bundle/acessibilidade.
2. Destino funcional de “Ajuda” e “Núcleo CEI”.
3. Fonte oficial e licença/uso dos logos e fontes.
4. Inclusão de dimensão e indicador na query string.
5. Fonte canônica para classificação por porte e tabelas regionais derivadas.
6. Local de execução do exportador anual (máquina local, GitHub Actions ou outro CI).
7. Política de versionamento/retensão dos snapshots.
8. Se os JSONs serão versionados no Git ou publicados como artefatos externos do Pages.

## 9. Próximos passos

1. Adicionar os screenshots listados em `docs/screenshots/`.
2. Confirmar decisões pendentes e aprovar este inventário.
3. Definir os schemas JSON e produzir uma amostra pequena, ainda sem UI.
4. Comparar essa amostra com o projeto Dash e corrigir divergências.
5. Só depois inicializar React/Vite e construir o shell com dados de amostra.

### Prompt recomendado para a próxima etapa

> No projeto `C:\Users\rnbirck\PROJETOS\DASHBOARD-RADAR-MUNICIPIOS`, leia integralmente `docs/DESIGN_REFERENCE.md` e `docs/MIGRATION_PLAN.md`. Inicialize um app React + TypeScript com Vite, sem alterar o projeto antigo. Implemente apenas a fundação: estrutura de pastas proposta, tokens visuais, `AppShell`, cabeçalho responsivo, React Router com as três rotas, estados placeholder acessíveis e uma camada tipada para ler JSON estático. Não implemente ainda gráficos nem o dashboard completo. Configure também o fallback de SPA para Cloudflare Pages, testes básicos de rota e execute build/testes ao final. Preserve a identidade visual documentada e reporte arquivos, decisões e validações.

