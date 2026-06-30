# scripts

Geradores e utilitários de dados estáticos do **Radar dos Municípios do RS**.

## export_static_sample.py

Gerador **determinístico** da amostra estática da Fase 1.

### Objetivo (limitado)

Extrair dados reais do banco PostgreSQL local e materializá-los em
`public/data/` para alimentar a interface React/Vite da Fase 1 (Home, Regiões
funcionais, Filtros e resumo municipal). **Este script não é o exportador anual
definitivo.**

### Requisitos

- Projeto antigo em `DASHBOARD-RANKING-MUNICIPIOS` com `.env` configurado.
- PostgreSQL local acessível (credenciais lidas do `.env` do projeto antigo).
- Pacotes Python: `sqlalchemy`, `pandas`, `python-dotenv` (já instalados).

### O que o script faz

1. Importa `src.data.repository` do projeto antigo.
2. Conecta ao PostgreSQL local e carrega `ranking_municipios`.
3. Extrai dados reais de:
   - distribuição de municípios e Coredes por região funcional;
   - ranking e notas do município de referência Picada Café (IBGE 4314423);
   - ranking RF3 completo (49 municípios) com notas finais.
4. Escreve JSONs com envelope versionado.
5. Avisa sobre o que **não** está disponível:
   - dados de indicador-level (nota_indicador, valor_original, medianas) —
     as tabelas base não existem no banco local, então os arrays de
     indicadores nos arquivos de dimensão (`educacao.json`, `financas.json`)
     permanecem vazios;
   - classificação por porte populacional — a tabela `regressao_rf_previsoes`
     não existe, então os campos `classification` usam `"unknown"`.

### Execução

```powershell
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
      └─ financas.json
```

`4314423` é o código IBGE oficial de **Picada Café / RS**, validado via API
oficial do IBGE e confirmado no banco local.

### Regras adotadas

- `schemaVersion`: `"1.0.0"`.
- `dataVersion`: `"v2025-sample"`.
- `generatedAt`: ISO 8601 UTC fixo (`"2026-06-30T12:00:00Z"`).
- JSON em UTF-8 com `ensure_ascii=False`.
- `camelCase` nas chaves; indicadores em `snake_case`.
- IDs são `string`; ID municipal é código IBGE de 7 dígitos.
- Região canônica `"RF3"`; arquivo regional `rf3.json`.
- Ausência é `null`; arrays vazios são `[]`; zero é valor real.
- Não usar `""`, `"N/A"`, `"-"`, `"—"` ou `NaN` nos JSONs.
- Formatação pertence ao frontend.

### Validações realizadas

- Conexão com banco e existência da tabela `ranking_municipios`.
- Presença do ano `2025` e do município `4314423` (Picada Café).
- `schemaVersion`, `dataVersion` e `generatedAt` corretos.
- Totais institucionais (497/9/28) condizentes com os dados extraídos.
- Catálogo sem duplicatas e com IDs consistentes entre entidades.
- RF3 com `municipalityCount` e `coredeCount` reais.
- Rankings sem municípios duplicados e com Picada Café presente.
- Ausência de `NaN`, valores proibidos e `\"\"` em todo o payload.

Se a validação falhar, o script aborta sem escrever nada.

### Sobre os arquivos de dimensão nesta fase

`educacao.json` e `financas.json` têm o `dimensionHistory` preenchido com
notas reais extraídas do banco, mas os arrays de indicadores estão vazios
(os dados de indicador não estão disponíveis nas tabelas locais).