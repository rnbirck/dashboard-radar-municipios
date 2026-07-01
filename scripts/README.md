# scripts

Geradores e utilitários de dados estáticos do **Radar dos Municípios do RS**.

## export_static_sample.py

Gerador estático da Fase 1.5 — fonte canônica: **Supabase/PostgREST remoto**.

### Objetivo

Extrair dados reais de Picada Café (IBGE 4314423) / RF3 via API PostgREST
e materializá-los em `public/data/`. **Este script não é o exportador anual
definitivo.** Ele gera apenas a amostra de referência para desenvolvimento.

### Fonte canônica

- Supabase/PostgREST remoto (não PostgreSQL local)
- Acessado exclusivamente pelo script Python de exportação
- O frontend React **não acessa Supabase** — lê apenas JSONs estáticos em
  `public/data/`

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `SUPABASE_URL` | Sim | URL do projeto Supabase (ex.: `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Sim | Chave service_role do Supabase (anônima não funciona) |

Se as variáveis não estiverem definidas, o script aborta sem gerar JSONs.

### Tabelas consultadas

| Tabela | Finalidade |
|---|---|
| `ranking_municipios` | Distribuição regional, anos disponíveis, ranking RF3 |
| `dash_municipios_resumo` | Resumo anual do município (notas, rankings, classificação) |
| `dash_municipio_categoria_historico` | Histórico de nota/posição por dimensão |
| `dash_municipio_indicadores` | Dados de indicador (notas, rankings, valores originais) |
| `mv_municipio_indicador_mediana_regiao` | Medianas regionais de nota e valor original |
| `regressao_rf_previsoes` | Classificação por porte populacional |
| `dash_regioes_resumo` | Resumo por região (médias, Coredes) |

### Escopo da amostra

- Município: **Picada Café** (IBGE 4314423)
- Região funcional: **RF3**
- Corede: **Hortênsias**
- Anos: **2021–2025**
- RF3 em 2025: **49 municípios**
- Dimensões: educação, finanças, meio_ambiente, saúde, segurança, socioeconomico
- Indicadores: **41** no catálogo

### Execução

```powershell
set SUPABASE_URL=https://<projeto>.supabase.co
set SUPABASE_SERVICE_KEY=<service_role_key>
python scripts/export_static_sample.py
```

### Arquivos gerados

```text
public/data/
├─ manifest.json
└─ v2025-sample/
   ├─ catalog.json
   ├─ regions/2025.json
   ├─ rankings/2025/rf3.json
   └─ municipalities/4314423/
      ├─ summary.json
      ├─ educacao.json
      ├─ financas.json
      ├─ meio_ambiente.json
      ├─ saude.json
      ├─ seguranca.json
      └─ socioeconomico.json
```

### Dados gerados

- **205 observações municipais** (5 anos × 41 indicadores)
- **205 medianas regionais** correspondentes (via materialized view)
- **30 registros de histórico de dimensão** (5 anos × 6 dimensões)
- **5 registros de classificação** (regressão por porte populacional)
- **49 municípios** no ranking RF3 2025
- **Picada Café 2025**: ranking geral **2/49**, classificação **Acima do esperado**

### Limitações conhecidas

- Apenas Picada Café (4314423) é detalhado — os demais 496 municípios não
  têm arquivos de dimensão na amostra.
- O script depende de conexão com Supabase — sem credenciais, não gera JSONs.
- O `generatedAt` nos JSONs é fixo (`2026-06-30T12:00:00Z`) para
  reprodutibilidade; o gerador é determinístico com os mesmos dados-fonte.
- A formatação de moeda, percentual, ordinal e ausência (`—`) pertence ao
  frontend; os JSONs usam apenas valores primitivos e `null`.

### Regras dos JSONs

- `camelCase` nas chaves; indicadores em `snake_case`.
- IDs são `string`; ID municipal é código IBGE de 7 dígitos.
- Ausência é `null`; arrays vazios são `[]`.
- Não usar `""`, `N/A`, `-`, `—` ou `NaN` nos JSONs.
- Valores booleanos (`isImputed`) são `true`/`false`/`null`.

### PostgREST client

O script implementa o próprio cliente PostgREST usando apenas `urllib.request`
da biblioteca padrão, com paginação por `Range`/`limit`+`offset` e tratamento
de erros (401, 403, 404, timeout). Nenhuma dependência externa (sem
`supabase-py`, `sqlalchemy` ou `pandas`).


## check_local_data.py

**Checker somente leitura.** Compara os nove arquivos Excel oficiais com o
PostgreSQL local e gera um relatório de diferenças em `reports/local_data_check.md`.

### Objetivo

Validar se o banco local reflete fielmente os Excels antes de qualquer carga.

### Comportamento

- Lê `C:\Users\rnbirck\PROJETOS\CEI\cei\ranking_municipios\DB\data/*.xlsx`
- Conecta ao PostgreSQL local apenas com `SELECT`
- Compara schemas, contagens e valores
- Valida Picada Café / RF3
- **Não executa nenhuma DDL, DML, INSERT, UPDATE, DELETE, CREATE, ALTER ou DROP**
- **Não acessa Supabase**
- **Não gera JSONs do frontend**

### Variáveis de ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DB_USUARIO` | Sim | Usuário PostgreSQL |
| `DB_SENHA` | Sim | Senha PostgreSQL |
| `DB_HOST` | Não | Default `localhost` |
| `DB_PORT` | Não | Default `5432` |
| `DB_BANCO` | Não | Default `cei` |

### Execução

```powershell
set DB_USUARIO=rnbirck
set DB_SENHA=ceiunisinos
python scripts/check_local_data.py
```

### Código de saída

- `0`: todas as verificações passaram
- `1`: uma ou mais verificações falharam
- `2`: erro de execução

### Relatório

Gerado em `reports/local_data_check.md` com:

- hashes SHA-256 dos Excels
- tabelas existentes e ausentes no PostgreSQL local
- divergências de `nota_final` e `ranking_regiao_funcional`
- amostra de divergências
- validação de Picada Café / RF3
- conclusão PASS/FAIL
