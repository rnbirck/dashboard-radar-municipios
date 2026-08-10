# Auditoria do pipeline de dados — Radar dos Municípios do RS

Data da auditoria: 2026-06-30  
Modo: somente leitura; nenhuma carga, atualização, regeneração ou refresh foi executado.

## 1. Resumo executivo

A origem Excel em `CEI/cei/ranking_municipios/DB/data` está completa para o recorte 2021–2025: 497 municípios, 9 regiões funcionais, 28 Coredes, 6 dimensões e 41 indicadores. Os arquivos não apresentam duplicidades no grão esperado município/ano ou município/ano/indicador.

O Supabase/PostgREST coincide com os Excels na tabela `ranking_municipios`: mesmas 2.485 chaves e nenhuma divergência em ranking, nota final, região ou Corede. As tabelas base e derivadas também possuem cobertura completa e coerente no Supabase.

O PostgreSQL local está desatualizado e incompleto para o dashboard:

- possui `ranking_municipios` com as mesmas 2.485 chaves, mas valores diferentes;
- 2.485/2.485 notas finais divergem dos Excels/Supabase;
- 1.956/2.485 posições regionais divergem, ou 78,71%;
- não contém as tabelas base por dimensão, as tabelas derivadas, a view de medianas nem `regressao_rf_previsoes`.

Para Picada Café, a diferença mais visível ocorre em 2023: Excel e Supabase registram 6º lugar; o PostgreSQL local registra 5º. O JSON estático registra corretamente 6º, pois foi gerado a partir do Supabase.

Conclusão: a fonte operacional mais atual é o conjunto Excel de 28/05/2026, e o Supabase é uma réplica transformada coerente dessa origem. O banco local não deve ser usado como fonte de exportação até ser reconstruído e validado. No curto prazo, recomenda-se manter o Supabase apenas como fonte do exportador estático anual. No médio prazo, o pipeline local deve ser unificado para reproduzir bases, derivadas e medianas antes de eliminar o Supabase.

## 2. Fluxo atual dos dados

```text
Tabelas operacionais do PostgreSQL local
  -> CEI/cei/ranking_municipios/construcao_base.py
  -> arquivos anuais em ranking_municipios/resultados/
  -> processo analítico externo/não centralizado nesta pasta
  -> Excels consolidados em DB/data/
     - base_final_municipio.xlsx
     - seis bases de dimensão
     - pesos PCA
     - regressão/classificação

DB/data/*.xlsx
-> DASHBOARDS/RANKING-MUNICIPIOS/update_data.py
  -> tabelas base no Supabase
  -> tabelas derivadas no Supabase

dash_municipio_indicadores
  -> refresh manual/externo da materialized view
  -> mv_municipio_indicador_mediana_regiao

PostgreSQL local validado
-> DASHBOARDS/RADAR-MUNICIPIOS/scripts/export_static_from_local.py
  -> public/data/v2025/*.json
  -> frontend React/Vite
```

Existe ainda um carregador local independente:

```text
DB/data/*.xlsx
  -> CEI/cei/ranking_municipios/DB/db.py
  -> PostgreSQL local public.* com if_exists="replace"
```

Esse carregador importa as planilhas como tabelas base, mas não constrói tabelas derivadas nem medianas. O estado atual do banco local indica que ele não foi executado com sucesso sobre o conjunto atual completo, ou que o banco foi posteriormente substituído por outro fluxo.

## 3. Arquivos Excel encontrados

Todos os arquivos estão em:

`C:\Users\rnbirck\PROJETOS\CEI\cei\ranking_municipios\DB\data`

Todos possuem uma aba denominada `Sheet 1` e modificação em 28/05/2026.

| Arquivo | Hora de modificação | Linhas | Colunas | Papel |
|---|---:|---:|---:|---|
| `base_final_municipio.xlsx` | 13:27:40 | 2.485 | 13 | Ranking geral e notas das seis dimensões |
| `base_educacao.xlsx` | 13:27:55 | 12.425 | 14 | 5 indicadores de Educação |
| `base_financas.xlsx` | 13:27:58 | 19.880 | 14 | 8 indicadores de Finanças |
| `base_meio_ambiente.xlsx` | 13:27:53 | 14.910 | 14 | 6 indicadores de Meio ambiente |
| `base_saude.xlsx` | 13:27:44 | 17.395 | 14 | 7 indicadores de Saúde |
| `base_seguranca.xlsx` | 13:27:48 | 17.395 | 14 | 7 indicadores de Segurança |
| `base_socioeconomico.xlsx` | 13:27:46 | 19.880 | 14 | 8 indicadores Socioeconômicos |
| `pesos_dimensoes_pca.xlsx` | 13:27:37 | 41 | 3 | Peso PCA por dimensão/indicador |
| `regressao_rf_previsoes.xlsx` | 13:27:35 | 2.485 | 22 | Regressão e classificação por porte |

### Colunas principais

`base_final_municipio.xlsx`:

- `id_municipio`, `municipio`, `ano`, `regiao_funcional`, `corede`;
- `nota_educacao`, `nota_financas`, `nota_meio_ambiente`, `nota_saude`, `nota_seguranca`, `nota_socioeconomico`;
- `nota_final`, `ranking_regiao_funcional`.

Bases de dimensão:

- contexto municipal e temporal;
- `indicador`, `nota_indicador`, `dimensao`, `ranking_indicador`;
- `nota_dimensao`, `ranking_dimensao`;
- `valor_original`, `valor_usado_nota`, `valor_imputado`.

`regressao_rf_previsoes.xlsx`:

- notas e posição oficial;
- população e log da população;
- nota prevista e intervalo de confiança;
- diferença oficial/prevista;
- `classificacao`, `quanto_acima`, `quanto_baixo`.

### Cobertura e qualidade estrutural

| Arquivo/grupo | Anos | Municípios | Regiões | Coredes | Indicadores | Duplicatas no grão esperado |
|---|---:|---:|---:|---:|---:|---:|
| Ranking geral | 2021–2025 | 497 | 9 | 28 | — | 0 |
| Educação | 2021–2025 | 497 | 9 | 28 | 5 | 0 |
| Finanças | 2021–2025 | 497 | 9 | 28 | 8 | 0 |
| Meio ambiente | 2021–2025 | 497 | 9 | 28 | 6 | 0 |
| Saúde | 2021–2025 | 497 | 9 | 28 | 7 | 0 |
| Segurança | 2021–2025 | 497 | 9 | 28 | 7 | 0 |
| Socioeconômico | 2021–2025 | 497 | 9 | 28 | 8 | 0 |
| Regressão | 2021–2025 | 497 | 9 | 28 | — | 0 |

Observação técnica: o modo `read_only` do `openpyxl` reportou dimensões incorretas (`A1:A1`) nesses arquivos. A leitura tabular via pandas recuperou corretamente todos os registros e colunas. Isso sugere metadados de dimensão incomuns no XLSX, não ausência de dados.

## 4. Scripts encontrados e função

### Pipeline CEI

| Script | Função |
|---|---|
| `construcao_base.py` | Consulta tabelas operacionais locais, seleciona anos-fonte por indicador, monta bases anuais e grava `ranking_municipios_rs_<ano>.xlsx` em `resultados/`. |
| `queries.py` | SQL de extração dos indicadores operacionais de saúde, educação, segurança, meio ambiente, finanças e socioeconômico. |
| `arquivos_locais.py` | Tratamentos auxiliares para fontes locais específicas, incluindo SAEB/vacinas. |
| `resumo_indicadores_ranking_municipios_rs.py` | Gera planilha de nomes, período e fonte dos indicadores a partir dos resultados anuais. |
| `DB/db.py` | Importa todos os `.xlsx` de `DB/data` para PostgreSQL local, usando `replace`; renomeia `base_final_municipio` para `ranking_municipios`. |
| `construcao_base_antigo.py`, `utils_antigo.py` | Fluxo legado. |
| `distancia_pop_mun.py`, `exporta_pop_estimada.py`, `indicadores_financeiros.py` | Utilitários/extrações auxiliares. |

Não foram encontrados notebooks, arquivos SQL, batch, PowerShell ou CMD dentro de `DB/`. O único script desse diretório é `db.py`.

### Dashboard Dash

`DASHBOARDS/RANKING-MUNICIPIOS/update_data.py` é o fluxo principal que transforma os Excels consolidados em dados para o dashboard:

1. lê os nove arquivos de `DB/data`;
2. carrega `ranking_municipios`, seis tabelas `base_*`, pesos e regressão;
3. mescla a classificação de regressão;
4. constrói:
   - `dash_municipios_resumo`;
   - `dash_municipio_categoria_historico`;
   - `dash_municipio_indicadores`;
   - quatro tabelas regionais derivadas;
5. grava diretamente no Supabase por conexão PostgreSQL ou pela API REST.

Ele não atualiza o PostgreSQL local e não executa `REFRESH MATERIALIZED VIEW` para `mv_municipio_indicador_mediana_regiao`.

### Exportador React

Fluxo ativo de publicação: `DASHBOARDS/RADAR-MUNICIPIOS/scripts/export_static_from_local.py`:

- usa o PostgreSQL local validado como fonte;
- consulta somente em modo leitura;
- gera `public/data/v2025` completo;
- substitui o exportador de amostra `export_static_sample.py`, removido do repositório;
- não deve receber credenciais no frontend.

## 5. Configuração de bancos e ambientes

### Arquivos `.env` encontrados

- `C:\Users\rnbirck\PROJETOS\DASHBOARDS\RANKING-MUNICIPIOS\.env`
- `C:\Users\rnbirck\PROJETOS\DASHBOARDS\RANKING-MUNICIPIOS\.env.example`

Não foram encontrados `.env` no novo dashboard nem na árvore `CEI` inspecionada.

### Nomes de variáveis identificados

No `.env` do dashboard Dash:

- `DATA_CACHE_TTL_SECONDS`;
- `DB_BANCO`, `DB_HOST`, `DB_PORT`, `DB_SENHA`, `DB_USUARIO`;
- `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_URL`.

Variáveis adicionais documentadas no `.env.example`/código:

- `APP_PERF_LOGS`;
- `DATABASE_URL`, `SUPABASE_DB_URL`, `SUPABASE_DATABASE_URL`;
- `INDICATOR_SUMMARY_FILE`, `RESUMO_INDICADORES_FILE`;
- `RANKING_DATA_DIR`, `SOURCE_DATA_DIR`.

Nenhum valor de `.env` foi incluído nesta auditoria.

### Resolução de ambiente

O repositório de dados do Dash procura, nesta ordem conceitual:

- `.env` do próprio dashboard;
- `.env` sob `queries/`;
- `.env` de projetos vizinhos predefinidos.

Para leitura, ele prioriza uma configuração PostgreSQL direta. Quando uma tabela não existe localmente e há configuração Supabase, faz fallback para a API.

Consequência atual: o dashboard pode combinar `ranking_municipios` do PostgreSQL local, que está desatualizado, com tabelas derivadas lidas do Supabase, que estão atualizadas. Esse comportamento de fonte híbrida é um risco de inconsistência interna.

`update_data.py` lê os Excels e escreve no Supabase; ele não alimenta o banco local.

`DB/db.py` e scripts antigos possuem parâmetros de conexão padrão diretamente no código. Os valores não são reproduzidos aqui. Isso deve ser removido em uma correção futura e substituído por configuração externa obrigatória.

## 6. Comparação PostgreSQL local vs Supabase

Nenhuma das tabelas inspecionadas possui coluna explícita `updated_at` ou equivalente. A atualidade foi inferida por conteúdo, anos e comparação com os Excels.

| Tabela/view | PostgreSQL local | Supabase | Linhas Supabase | Anos | Municípios | Regiões | Coredes | Indicadores |
|---|---|---|---:|---:|---:|---:|---:|---:|
| `ranking_municipios` | Presente, 2.485 linhas | Presente | 2.485 | 2021–2025 | 497 | 9 | 28 | — |
| `dash_municipios_resumo` | Ausente | Presente | 2.485 | 2021–2025 | 497 | 9 | 28 | — |
| `dash_municipio_categoria_historico` | Ausente | Presente | 14.910 | 2021–2025 | 497 | 9 | 28 | — |
| `dash_municipio_indicadores` | Ausente | Presente | 101.885 | 2021–2025 | 497 | 9 | 28 | 41 |
| `mv_municipio_indicador_mediana_regiao` | Ausente | Presente | 1.845 | 2021–2025 | — | 9 | — | 41 |
| `regressao_rf_previsoes` | Ausente | Presente | 2.485 | 2021–2025 | 497 | 9 | 28 | — |

As seis tabelas `base_*` e `pesos_dimensoes_pca` estão ausentes localmente e presentes no Supabase com contagens idênticas às planilhas Excel.

### Campos principais no Supabase

`ranking_municipios`: identificação, ano, região/Corede, seis notas dimensionais, nota final e posição regional.

`dash_municipios_resumo`: ranking geral, classificação, notas e rankings atuais/anteriores das seis dimensões.

`dash_municipio_categoria_historico`: categoria, nota/posição dimensional e total regional.

`dash_municipio_indicadores`: nome/chave do indicador, notas, rankings simples/desempatados, valor original/usado, imputação e médias regionais.

`mv_municipio_indicador_mediana_regiao`: mediana regional da nota, mediana do valor original e tamanho da amostra.

`regressao_rf_previsoes`: população, previsão, intervalo, diferenças, classificação e notas oficiais.

### Divergência global em `ranking_municipios`

Excel versus Supabase:

- chaves exclusivas de um lado: 0;
- divergências de posição: 0;
- divergências de nota final: 0;
- divergências de região/Corede: 0.

Excel versus PostgreSQL local:

- chaves exclusivas de um lado: 0;
- divergências de posição: 1.956/2.485 (78,71%);
- divergências de nota final: 2.485/2.485 (100%);
- divergências de região/Corede: 0;
- diferença absoluta da nota final: mediana 0,0714; máximo 0,4238.

As divergências de ranking local aparecem em todos os anos: 396 em 2021, 388 em 2022, 387 em 2023, 387 em 2024 e 398 em 2025.

## 7. Picada Café / RF3

Identificação esperada:

- IBGE: `4314423`;
- região: RF3;
- Corede: Hortênsias;
- total da RF3 em 2025: 49 municípios.

### Ranking geral

| Ano | Excel/Supabase | PostgreSQL local | Nota Excel/Supabase | Nota local |
|---:|---:|---:|---:|---:|
| 2021 | 1º | 1º | 7,7020875 | 7,8241630 |
| 2022 | 1º | 1º | 7,7722304 | 7,8575543 |
| 2023 | **6º** | **5º** | 7,3552465 | 7,4766188 |
| 2024 | 1º | 1º | 7,7416271 | 7,8327640 |
| 2025 | 2º | 2º | 7,8129966 | 7,8211521 |

### Resumo 2025 no Supabase

- ranking geral: 2º;
- classificação: Acima;
- Educação: nota 7,8432, ranking 3º, anterior 5º;
- Finanças: nota 6,0239, ranking 30º, anterior 30º;
- Meio ambiente: nota 8,3809, ranking 17º, anterior 16º;
- Saúde: nota 7,9468, ranking 3º, anterior 6º;
- Segurança: nota 8,9023, ranking 13º, anterior 6º;
- Socioeconômico: nota 7,7809, ranking 9º, anterior 8º.

### Cobertura derivada

| Fonte | Esperado | Encontrado | Resultado |
|---|---:|---:|---|
| Histórico de dimensão | 5 × 6 = 30 | 30 | OK |
| Indicadores municipais | 5 × 41 = 205 | 205 | OK |
| Medianas RF3 correspondentes | 205 | 205 | OK |
| Classificação/regressão | 5 | 5 | OK; “Acima” em todos os anos |

## 8. JSONs estáticos

A amostra atual está alinhada ao Supabase para Picada Café:

- ranking RF3 2025: 49 municípios;
- Picada Café: 2º, nota 7,8129966;
- histórico geral: 1º, 1º, 6º, 1º, 2º;
- seis arquivos dimensionais;
- 205 observações e 205 medianas preenchidas.

Problemas de contrato ainda observados:

1. No ranking regional, a classificação dos municípios permanece `unknown`, embora a classificação esteja disponível no Supabase.
2. Em `summary.json`, `dimensionScores` e `dimensionRanks` contêm simultaneamente `meioAmbiente` e `meio_ambiente`; o primeiro fica `null` e o segundo contém o valor real. Isso cria duas chaves para a mesma dimensão e pode fazer o frontend ler o campo errado.
3. `generatedAt` é fixo para determinismo e não representa a data real do snapshot. Falta um campo separado como `sourceExtractedAt` ou `sourceVersion`.

## 9. O banco local vem dos Excels?

O código de `DB/db.py` foi desenhado para carregar diretamente todos os Excels de `DB/data` no PostgreSQL local, com caminho relativo ao script e substituição integral das tabelas.

Contudo, o estado atual do banco local não corresponde a esses Excels:

- somente `ranking_municipios` existe entre as tabelas auditadas;
- o conteúdo dessa tabela difere dos Excels;
- as seis tabelas base e a regressão, que o script deveria criar, estão ausentes.

Portanto, o banco local atual não foi produzido integralmente pela execução bem-sucedida do `db.py` sobre o conjunto atual, ou foi posteriormente sobrescrito por outro processo.

### Respostas objetivas

- Todos os Excels consolidados necessários ao dashboard estão em `DB/data`: sim, inclusive seis dimensões, ranking, pesos e regressão.
- O caminho de `db.py` é relativo (`DB/data`); `update_data.py` aceita variável de ambiente e possui fallback absoluto relativo aos projetos.
- `db.py` grava apenas tabelas base, sem derivadas.
- `update_data.py` grava bases e depois calcula/grava derivadas.
- Os rankings já vêm calculados nos Excels; `update_data.py` reaproveita os rankings e calcula estruturas auxiliares/anteriores.
- As medianas regionais não são recalculadas por `update_data.py`; dependem de refresh externo da materialized view.
- A classificação vem pronta de `regressao_rf_previsoes.xlsx` e é mesclada, não reestimada pelo carregador.
- `update_data.py` atualiza Supabase, não o PostgreSQL local.
- Sim, o Supabase pode ter sido atualizado por fluxo distinto do local; é exatamente o que o código e o conteúdo atual indicam.

## 10. Causa provável

### Alta confiança

1. O PostgreSQL local está desatualizado em relação aos Excels atuais.
2. Existem dois fluxos de carga independentes:
   - `DB/db.py` para local;
   - `update_data.py` para Supabase.
3. O fluxo local não gera as tabelas derivadas.
4. O dashboard Dash pode misturar ranking local e derivados remotos por causa do fallback por tabela.

### Confiança média

O local provavelmente foi carregado a partir de uma versão anterior das notas/rankings ou por um script diferente. Não há coluna de atualização, log de execução ou manifest de origem que permita identificar exatamente quando e por qual comando isso ocorreu.

### Materialized view

A view de medianas no Supabase está consistente com os 205 registros de Picada Café/RF3, portanto foi atualizada em algum momento após a carga corrente. Porém, o refresh não está incorporado ao fluxo principal; futuras cargas podem deixá-la obsoleta.

## 11. Riscos para a migração React/Vite

1. Exportar do PostgreSQL local produziria posições e notas incorretas.
2. O Dash atual pode apresentar dados híbridos de versões diferentes.
3. Uma nova carga Supabase sem refresh da view pode combinar indicadores novos com medianas antigas.
4. Não existe metadado confiável de atualização/snapshot nas tabelas.
5. Credenciais padrão permanecem diretamente em scripts legados.
6. O uso de `replace` em `DB/db.py` e de limpeza/inserção em `update_data.py` torna qualquer execução de carga destrutiva e exige backup/ambiente controlado.
7. As regras de metadados de indicadores continuam distribuídas entre planilha, Dash e exportador.
8. O contrato JSON possui inconsistência de nomenclatura em Meio ambiente.
9. A classificação disponível não está sendo incorporada ao ranking regional JSON.

## 12. Recomendação

### Curto prazo

Continuar usando o Supabase somente como fonte read-only do exportador anual estático, porque ele coincide com os Excels e já contém as derivadas necessárias.

Antes de cada exportação:

1. validar Excel versus Supabase em contagem e checksum lógico;
2. confirmar 497 municípios × 5 anos;
3. confirmar 101.885 linhas de indicadores e 1.845 medianas;
4. verificar que a view de medianas foi atualizada após a carga;
5. registrar um identificador/data real de snapshot.

### Médio prazo

Corrigir o pipeline local para tornar o Supabase dispensável:

1. criar um único comando idempotente que leia `DB/data`;
2. grave bases e derivadas em um banco local de staging;
3. calcule medianas como tabela derivada ou view atualizada no mesmo fluxo;
4. execute validações antes da troca/publicação;
5. gere JSONs diretamente desse snapshot validado;
6. publique artefatos de forma atômica.

Não eliminar o Supabase antes de o pipeline local reproduzir exatamente os resultados atuais.

## 13. Próximos passos seguros

### Diagnóstico

- adicionar manifest de carga com data, hash dos nove Excels, versão do código e destino;
- comparar hashes lógicos Excel/Supabase/local;
- identificar o último processo que escreveu o PostgreSQL local;
- verificar dependências/ordem real entre `construcao_base.py`, geração analítica das bases e `update_data.py`.

### Correção do pipeline

- remover credenciais hardcoded dos scripts CEI;
- unificar configurações em `.env.example`, sem valores reais;
- adaptar `update_data.py` para receber explicitamente destino `local|supabase`;
- incorporar a geração/refresh de medianas ao fluxo transacional;
- impedir fallback híbrido no Dash: selecionar uma fonte única por execução.

### Regeneração de dados

Esta etapa é destrutiva e não foi executada nesta auditoria.

- criar backup do PostgreSQL local;
- carregar Excels em schema de staging, não diretamente em `public`;
- construir derivadas no staging;
- executar reconciliação completa;
- somente então promover/trocar as tabelas.

### Exportação estática

- corrigir chaves duplicadas de Meio ambiente;
- incorporar classificação ao ranking regional;
- adicionar `sourceExtractedAt`, `sourceVersion` e hashes;
- validar JSON contra Excel/Supabase antes de ativar o manifest;
- ampliar o exportador para os 497 municípios somente após a amostra passar em regressão numérica.

## 14. Comandos e consultas executados

Todos foram somente leitura:

- listagem de arquivos com `rg --files` e `Get-ChildItem`;
- leitura de scripts com `Get-Content` e busca textual com `rg`;
- enumeração de nomes de variáveis dos `.env`, sem valores;
- inspeção dos Excels com `openpyxl` e pandas em modo de leitura;
- consultas SQL exclusivamente `SELECT` ao PostgreSQL local;
- requisições HTTP exclusivamente `GET` ao Supabase/PostgREST;
- leitura e perfil dos JSONs estáticos existentes;
- comparações em memória entre Excel, local e Supabase.

### Comandos deliberadamente não executados

- `DB/db.py`, pois usa `if_exists="replace"`;
- `update_data.py`, pois limpa/substitui tabelas e insere dados;
- qualquer `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE` ou DDL;
- `REFRESH MATERIALIZED VIEW`;
- scripts de construção que escrevem novos Excels;
- `scripts/export_static_from_local.py`, pois geraria novamente os JSONs de publicação;
- `npm run build`, por não contribuir para a auditoria de dados e poder alterar `dist/`;
- qualquer commit Git.
