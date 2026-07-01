#!/usr/bin/env python3
"""
Checker somente leitura — compara Excels oficiais com PostgreSQL local.

Uso:
    set DB_USUARIO=rnbirck & set DB_SENHA=... & set DB_HOST=localhost & set DB_PORT=5432 & set DB_BANCO=cei
    python scripts/check_local_data.py

Nao executa DDL/DML. Nao acessa Supabase. Nao gera JSONs do frontend.
"""

from __future__ import annotations

import hashlib
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Caminhos
# ---------------------------------------------------------------------------

DATA_DIR = Path(
    r"C:\Users\rnbirck\PROJETOS\CEI\cei\ranking_municipios\DB\data"
).resolve()

REPORTS_DIR = Path(__file__).resolve().parent.parent / "reports"

EXPECTED_FILES = [
    "base_final_municipio.xlsx", "base_educacao.xlsx", "base_financas.xlsx",
    "base_meio_ambiente.xlsx", "base_saude.xlsx", "base_seguranca.xlsx",
    "base_socioeconomico.xlsx", "pesos_dimensoes_pca.xlsx",
    "regressao_rf_previsoes.xlsx",
]

EXPECTED_BASE_TABLES = [
    "ranking_municipios", "base_educacao", "base_financas",
    "base_meio_ambiente", "base_saude", "base_seguranca",
    "base_socioeconomico", "pesos_dimensoes_pca", "regressao_rf_previsoes",
]

EXPECTED_DERIVED_TABLES = [
    "dash_municipios_resumo", "dash_municipio_categoria_historico",
    "dash_municipio_indicadores", "mv_municipio_indicador_mediana_regiao",
]

# ---------------------------------------------------------------------------
# Utilitarios
# ---------------------------------------------------------------------------


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def normalize_identifier(value: str) -> str:
    import re, unicodedata
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    identifier = re.sub(r"[^0-9a-zA-Z_]+", "_", ascii_value.strip().lower())
    identifier = re.sub(r"_+", "_", identifier).strip("_")
    if not identifier:
        raise ValueError(f"Identifier vazio: {value!r}")
    if identifier[0].isdigit():
        identifier = f"col_{identifier}"
    return identifier


def read_xlsx(path: Path) -> pd.DataFrame:
    frame = pd.read_excel(path)
    frame.columns = [normalize_identifier(str(c)) for c in frame.columns]
    return frame


# ---------------------------------------------------------------------------
# Secao do relatorio
# ---------------------------------------------------------------------------

REPORT_LINES: list[str] = []


def log(line: str = "") -> None:
    REPORT_LINES.append(line)
    print(line)


def log_header(level: int, title: str) -> None:
    log(f"{'#' * level} {title}")
    log()


def log_table(headers: list[str], rows: list[list[str]]) -> None:
    sep = " | ".join("---" for _ in headers)
    log("| " + " | ".join(headers) + " |")
    log("| " + sep + " |")
    for row in rows:
        log("| " + " | ".join(str(c) for c in row) + " |")
    log()


def fmt_val(v: Any) -> str:
    if v is None or (isinstance(v, float) and v != v):
        return "null"
    return str(v)


# ---------------------------------------------------------------------------
# Main checker
# ---------------------------------------------------------------------------


def main() -> int:
    start_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    log_header(1, "Relatório de verificação — Dados locais vs Excels oficiais")
    log(f"**Gerado em:** {start_ts}")
    log(f"**Fonte Excel:** `{DATA_DIR}`")
    log()

    fail_count = 0

    # ==================================================================
    # 1. Verificar arquivos Excel
    # ==================================================================
    log_header(2, "1. Arquivos Excel")

    excel_info: dict[str, dict[str, Any]] = {}
    for fn in EXPECTED_FILES:
        path = DATA_DIR / fn
        if not path.exists():
            log(f"[FAIL] AUSENTE: {fn}")
            fail_count += 1
            continue
        h = sha256(path)
        log(f"[OK] {fn}  ({path.stat().st_size:,} bytes)  SHA256={h}")

        frame = read_xlsx(path)
        excel_info[fn] = {
            "path": path,
            "hash": h,
            "shape": frame.shape,
            "columns": list(frame.columns),
            "frame": frame,
        }

    log()

    # ==================================================================
    # 2. Conectar e listar tabelas locais
    # ==================================================================
    log_header(2, "2. Tabelas no PostgreSQL local")

    db_user = os.environ.get("DB_USUARIO", "rnbirck")
    db_pwd = os.environ.get("DB_SENHA", "")
    db_host = os.environ.get("DB_HOST", "localhost")
    db_port = os.environ.get("DB_PORT", "5432")
    db_name = os.environ.get("DB_BANCO", "cei")

    if not db_pwd:
        log("[FAIL] DB_SENHA nao definida")
        fail_count += 1
        log()
        _write_report(start_ts)
        return 1

    engine = create_engine(
        f"postgresql+psycopg2://{db_user}:{db_pwd}@{db_host}:{db_port}/{db_name}",
        connect_args={"connect_timeout": 5},
    )

    local_tables: dict[str, int] = {}
    with engine.connect() as conn:
        r = conn.execute(
            text("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name")
        )
        all_local = [t[0] for t in r]

        log(f"Total de tabelas em public: {len(all_local)}")
        log()

        # Esperadas
        for tn in EXPECTED_BASE_TABLES + EXPECTED_DERIVED_TABLES:
            if tn in all_local:
                cnt = conn.execute(text(f'SELECT COUNT(*) FROM public."{tn}"')).scalar()
                local_tables[tn] = cnt
                log(f"[OK] {tn}: {cnt} rows")
            else:
                local_tables[tn] = -1
                log(f"[FAIL] {tn}: AUSENTE")
                fail_count += 1

    log()

    # ==================================================================
    # 3. Comparar ranking_municipios com base_final_municipio.xlsx
    # ==================================================================
    log_header(2, "3. Comparacao: ranking_municipios vs base_final_municipio.xlsx")

    if "base_final_municipio.xlsx" in excel_info and local_tables.get("ranking_municipios", 0) > 0:
        xl = excel_info["base_final_municipio.xlsx"]["frame"]
        xl_rows = len(xl)
        xl_cols = len(xl.columns)
        db_rows = local_tables["ranking_municipios"]

        log(f"Excel: {xl_rows} linhas, {xl_cols} colunas")
        log(f"Local:  {db_rows} linhas")
        log()

        # Comparar colunas
        with engine.connect() as conn:
            col_r = conn.execute(
                text("SELECT column_name FROM information_schema.columns "
                     "WHERE table_schema='public' AND table_name='ranking_municipios' "
                     "ORDER BY ordinal_position")
            )
            db_columns = [c[0] for c in col_r]

        xl_columns = xl.columns.tolist()

        if xl_columns == db_columns:
            log("[OK] Colunas identicas entre Excel e banco local")
        else:
            log("[WARN]  Colunas divergem:")
            log(f"   Excel: {xl_columns}")
            log(f"   Local:  {db_columns}")
            common = [c for c in xl_columns if c in db_columns]
            log(f"   Colunas em comum: {len(common)}")
            log()

        # Comparar dados — amostra total
        if xl_columns == db_columns:
            xl_sorted = xl.sort_values(["id_municipio", "ano"]).reset_index(drop=True)

            db_frame = pd.read_sql_query(
                text("SELECT * FROM public.ranking_municipios ORDER BY id_municipio, ano"),
                engine,
            )

            if len(xl_sorted) != len(db_frame):
                log(f"[WARN]  Tamanhos divergem: Excel={len(xl_sorted)} Local={len(db_frame)}")
            else:
                # Comparar nota_final
                xl_final = xl_sorted["nota_final"].astype(float)
                db_final = db_frame["nota_final"].astype(float)
                final_diff = (xl_final - db_final).abs()
                final_divergentes = (final_diff > 1e-9).sum()

                # Comparar ranking_regiao_funcional
                xl_rank = xl_sorted["ranking_regiao_funcional"].astype(float)
                db_rank = db_frame["ranking_regiao_funcional"].astype(float)
                rank_diff = (xl_rank - db_rank).abs()
                rank_divergentes = (rank_diff > 0).sum()

                log(f"**nota_final:** {final_divergentes:,} divergencias de {len(xl_sorted):,} "
                    f"({final_divergentes/len(xl_sorted)*100:.2f}%)")
                log(f"  Diferenca maxima: {final_diff.max():.8f}")
                log(f"  Diferenca mediana: {final_diff.median():.8f}")
                log()

                log(f"**ranking_regiao_funcional:** {rank_divergentes:,} divergencias de {len(xl_sorted):,} "
                    f"({rank_divergentes/len(xl_sorted)*100:.2f}%)")
                if rank_divergentes > 0:
                    diffs = xl_sorted[xl_rank.ne(db_rank)][
                        ["id_municipio", "municipio", "ano", "regiao_funcional"]
                    ].copy()
                    diffs["excel_rank"] = xl_rank[xl_rank.ne(db_rank)].values
                    diffs["db_rank"] = db_rank[xl_rank.ne(db_rank)].values
                    log()
                    log("Amostra (ate 20 divergencias de ranking):")
                    for _, row in diffs.head(20).iterrows():
                        log(f"  {row['id_municipio']} {row['municipio']} "
                            f"{row['ano']} {row['regiao_funcional']}: "
                            f"Excel={row['excel_rank']} Local={row['db_rank']}")
                    log()

                if rank_divergentes > 0 or final_divergentes > 0:
                    log("[WARN]  VERIFICACAO: Divergencias encontradas — o banco local NAO reflete os Excels.")
                    fail_count += 1
                else:
                    log("[OK] ranking_municipios local e Excel coincidem perfeitamente.")

    else:
        log("[FAIL] Nao foi possivel comparar: Excel ou tabela local ausente.")
        fail_count += 1

    log()

    # ==================================================================
    # 4. Picada Cafe / RF3
    # ==================================================================
    log_header(2, "4. Validacao: Picada Cafe (IBGE 4314423) / RF3")

    PICADA_ID = 4314423

    if "ranking_municipios" in local_tables and local_tables["ranking_municipios"] > 0:
        with engine.connect() as conn:
            pc = conn.execute(
                text("SELECT * FROM public.ranking_municipios WHERE id_municipio = :id ORDER BY ano"),
                {"id": PICADA_ID},
            ).fetchall()
            pc_columns = [desc[0] for desc in conn.execute(
                text("SELECT column_name FROM information_schema.columns "
                     "WHERE table_schema='public' AND table_name='ranking_municipios' "
                     "ORDER BY ordinal_position")
            ).fetchall()]

            if not pc:
                log(f"[FAIL] Picada Cafe (id={PICADA_ID}) NAO ENCONTRADO no banco local!")
                fail_count += 1
            else:
                log(f"[OK] Picada Cafe: {len(pc)} registros encontrados")
                for row in pc:
                    rdict = dict(zip(pc_columns, row))
                    log(f"  {rdict.get('ano')}: rank={rdict.get('ranking_regiao_funcional')}, "
                        f"score={rdict.get('nota_final'):.4f}, "
                        f"corede={rdict.get('corede')}")
                log()

                # RF3 count in 2025
                rf3_2025 = conn.execute(
                    text("SELECT COUNT(DISTINCT id_municipio) FROM public.ranking_municipios "
                         "WHERE ano = 2025 AND regiao_funcional = 'RF3'")
                ).scalar()
                log(f"RF3 municipios em 2025 (banco local): {rf3_2025}")
                if rf3_2025 != 49:
                    log(f"  [WARN]  Esperado: 49. Divergencia!")
                    fail_count += 1
                else:
                    log(f"  [OK] 49 conforme esperado.")
                log()

                # Check rank 2 for 2025
                pc_2025 = conn.execute(
                    text("SELECT ranking_regiao_funcional, nota_final FROM public.ranking_municipios "
                         "WHERE id_municipio = :id AND ano = 2025"),
                    {"id": PICADA_ID},
                ).fetchone()
                if pc_2025:
                    rank_2025 = pc_2025[0]
                    log(f"Picada Cafe rank 2025: {rank_2025}/49")
                    if rank_2025 == 2:
                        log("  [OK] Rank 2 conforme esperado.")
                    else:
                        log(f"  [WARN]  Esperado: 2. Divergencia!")
                        fail_count += 1

    else:
        log("[FAIL] ranking_municipios local ausente — validacao Picada Cafe impossivel.")
        fail_count += 1

    # ==================================================================
    # 5. Tabelas derivadas — existencia
    # ==================================================================
    log_header(2, "5. Tabelas derivadas (dash_*, mv_*)")
    for tn in EXPECTED_DERIVED_TABLES:
        cnt = local_tables.get(tn, -1)
        if cnt >= 0:
            log(f"[OK] {tn}: {cnt} linhas")
        else:
            log(f"[FAIL] {tn}: AUSENTE")
            fail_count += 1
    log()

    # ==================================================================
    # 6. Resumo dos Excels
    # ==================================================================
    log_header(2, "6. Resumo dos Excels")
    log_table(
        ["Arquivo", "Linhas", "Colunas", "SHA256 (primeiros 16)"],
        [
            [fn, str(info["shape"][0]), str(info["shape"][1]), info["hash"][:16]]
            for fn, info in sorted(excel_info.items())
        ],
    )

    log("Cobertura:")
    log(f"  Indicadores (pesos_dimensoes_pca): {excel_info.get('pesos_dimensoes_pca.xlsx', {}).get('shape', (0,))[0]}")
    ind_count = excel_info.get("pesos_dimensoes_pca.xlsx", {}).get("shape", (0,))[0]
    if ind_count == 41:
        log("  [OK] 41 indicadores")
    else:
        log(f"  [WARN]  Esperado 41, obtido {ind_count}")
        fail_count += 1

    # Contagem de indicadores por dimensao nas bases dimensionais
    dims = ["educacao", "financas", "meio_ambiente", "saude", "seguranca", "socioeconomico"]
    dim_indicators = {}
    for dim in dims:
        fn = f"base_{dim}.xlsx"
        if fn in excel_info:
            inds = excel_info[fn]["frame"]["indicador"].unique()
            dim_indicators[dim] = len(inds)
            log(f"  {fn}: {len(inds)} indicadores unicos")
    log()

    # ==================================================================
    # 7. Conclusao
    # ==================================================================
    log_header(2, "7. Conclusao")
    if fail_count == 0:
        log("[OK] **PASS** — todas as verificacoes passaram.")
        log("O banco local esta consistente com os Excels oficiais.")
    else:
        log(f"[FAIL] **FAIL** — {fail_count} verificacao(oes) falharam.")
        log("O banco local NAO reflete os Excels oficiais.")
        log("Nao execute carga enquanto houver falhas.")
    log()

    _write_report(start_ts)
    return 0 if fail_count == 0 else 1


def _write_report(start_ts: str) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS_DIR / "local_data_check.md"
    report_path.write_text("\n".join(REPORT_LINES), encoding="utf-8")
    print(f"\nRelatorio salvo em: {report_path}")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        raise SystemExit(2) from exc
