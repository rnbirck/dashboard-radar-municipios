# scripts

Utilitarios de dados estaticos do Radar dos Municipios do RS.

## export_static_from_local.py

Exportador de producao. Le o PostgreSQL local validado, gera `public/data/v2025` e atualiza `public/data/manifest.json`.

### Execucao

```powershell
$env:DB_USUARIO="<usuario>"
$env:DB_SENHA="<senha>"
python scripts/export_static_from_local.py
```

Tambem aceita um schema explicito:

```powershell
python scripts/export_static_from_local.py --schema staging_2025
```

O script valida contagens, rankings, dimensoes, indicadores e arquivos municipais antes de publicar os JSONs em `public/data/v2025`.

## backfill_year_aggregates_from_static.py

Utilitario de manutencao para reconstruir agregados anuais a partir dos JSONs estaticos ja publicados.

## check_local_data.py

Checker somente leitura. Compara os arquivos Excel oficiais com o PostgreSQL local e grava o relatorio em `reports/local_data_check.md`.

### Execucao

```powershell
$env:DB_USUARIO="<usuario>"
$env:DB_SENHA="<senha>"
python scripts/check_local_data.py
```

O checker nao executa DDL/DML e nao gera JSONs do frontend.
