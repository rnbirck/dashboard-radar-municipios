#!/usr/bin/env python3
"""
Gerador da amostra estatica da Fase 1 — extrai dados reais do ranking_municipios.

Este script tenta conectar ao banco PostgreSQL local (via ``src.data.repository``
do projeto antigo em ``DASHBOARD-RANKING-MUNICIPIOS``) e extrair dados reais de
ranking, notas e distribuicoes. Dados de indicadores (nota_indicador, valor_original,
medianas) nao estao disponiveis nas tabelas existentes e permanecem como ``[]``.

Uso:
    python scripts/export_static_sample.py

Requisitos:
    - Projeto antigo em C:/Users/rnbirck/PROJETOS/DASHBOARD-RANKING-MUNICIPIOS
    - PostgreSQL local acessivel com as credenciais do .env do projeto antigo
    - Pacotes: sqlalchemy, pandas, python-dotenv (ja instalados no ambiente)

Se a conexao falhar, o script aborta com erro — nao fabrica dados ficticios.
"""

from __future__ import annotations

import json
import math
import re
import shutil
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _is_valid_number(val: Any) -> bool:
    """Retorna True se val for um numero finito (nao None, nao NaN)."""
    if val is None:
        return False
    try:
        f = float(val)
        return not math.isnan(f)
    except (TypeError, ValueError, OverflowError):
        return False


def _to_float(val: Any) -> float | None:
    """Converte para float ou None."""
    try:
        f = float(val)
        return None if math.isnan(f) else f
    except (TypeError, ValueError, OverflowError):
        return None

# ---------------------------------------------------------------------------
# Caminhos absolutos dos projetos
# ---------------------------------------------------------------------------

OLD_PROJECT = Path(
    "C:/Users/rnbirck/PROJETOS/DASHBOARD-RANKING-MUNICIPIOS"
).resolve()
NEW_PROJECT = Path(__file__).resolve().parent.parent

PUBLIC_DATA_DIR = NEW_PROJECT / "public" / "data"

# ---------------------------------------------------------------------------
# Constantes do contrato
# ---------------------------------------------------------------------------

SCHEMA_VERSION = "1.0.0"
DATA_VERSION = "v2025-sample"
SAMPLE_YEAR = 2025

GENERATED_AT = datetime(2026, 6, 30, 12, 0, 0, tzinfo=timezone.utc).strftime(
    "%Y-%m-%dT%H:%M:%SZ"
)

# ID IBGE do municipio de referencia — validado via API oficial do IBGE
# em 2026-06-30: https://servicodados.ibge.gov.br/api/v1/localidades/municipios/4314423
PICADA_CAFE_ID = "4314423"
PICADA_CAFE_REGION_ID = "RF3"

DIMENSION_IDS = (
    "educacao",
    "financas",
    "meio_ambiente",
    "saude",
    "seguranca",
    "socioeconomico",
)
DIMENSION_COLUMNS = (
    "nota_educacao",
    "nota_financas",
    "nota_meio_ambiente",
    "nota_saude",
    "nota_seguranca",
    "nota_socioeconomico",
)
DIMENSION_MAP = dict(zip(DIMENSION_COLUMNS, DIMENSION_IDS))

# ---------------------------------------------------------------------------
# Indicadores (metadata fixa, extraida do indicador_metadata.py do projeto antigo)
# ---------------------------------------------------------------------------

INDICATORS: list[dict[str, Any]] = [
    # --- Educacao ---
    {"id": "adequacao_formacao_docente", "dimensionId": "educacao",
     "name": "Adequação da Formação Docente", "shortName": "Formação docente",
     "description": "Considera a proporção de docentes do ensino fundamental com formação adequada à área em que atuam.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "higher_is_better", "order": 1},
    {"id": "saeb_ensino_fundamental", "dimensionId": "educacao",
     "name": "Nota do SAEB — Ensino Fundamental", "shortName": "SAEB fundamental",
     "description": "Sintetiza o desempenho em Português e Matemática no SAEB, considerando os anos iniciais e finais do ensino fundamental.",
     "unit": "pontos", "format": "number", "decimalPlaces": 1, "multiplier": 1,
     "direction": "higher_is_better", "order": 2},
    {"id": "taxa_cobertura_creche", "dimensionId": "educacao",
     "name": "Taxa de Cobertura de Creche", "shortName": "Cobertura creche",
     "description": "Expressa a cobertura de matrículas em creche na rede municipal.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "higher_is_better", "order": 3},
    {"id": "taxa_distorcao_fundamental", "dimensionId": "educacao",
     "name": "Taxa de Distorção Idade-Série — Ensino Fundamental", "shortName": "Distorção fundamental",
     "description": "Indica a proporção de estudantes do ensino fundamental com idade acima da esperada para a série.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "lower_is_better", "order": 4},
    {"id": "qt_acesso_infor", "dimensionId": "educacao",
     "name": "Acesso à Informação", "shortName": "Acesso à informação",
     "description": "Considera a disponibilidade de recursos de acesso à informação nas escolas, como infraestrutura associada à conectividade e ao uso de tecnologias.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "higher_is_better", "order": 5},
    # --- Financas ---
    {"id": "exec_orc_corrente", "dimensionId": "financas",
     "name": "Execução Orçamentária Corrente", "shortName": "Execução orçamentária",
     "description": "Relaciona as despesas correntes às receitas correntes, indicando o nível de comprometimento do orçamento.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "lower_is_better", "order": 1},
    {"id": "autonomia_fiscal", "dimensionId": "financas",
     "name": "Autonomia Fiscal", "shortName": "Autonomia fiscal",
     "description": "Avalia a capacidade do município de financiar suas atividades com receitas próprias.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "higher_is_better", "order": 2},
    {"id": "endividamento", "dimensionId": "financas",
     "name": "Endividamento", "shortName": "Endividamento",
     "description": "Expressa o peso da dívida consolidada líquida sobre a receita corrente líquida.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "lower_is_better", "order": 3},
    {"id": "despesas_pessoal", "dimensionId": "financas",
     "name": "Despesas com Pessoal", "shortName": "Despesas pessoal",
     "description": "Indica a participação das despesas com pessoal na receita corrente líquida do município.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "lower_is_better", "order": 4},
    {"id": "investimento", "dimensionId": "financas",
     "name": "Investimento", "shortName": "Investimento",
     "description": "Representa a parcela da receita corrente líquida destinada a investimentos e despesas de capital.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "higher_is_better", "order": 5},
    {"id": "disponibilidade_caixa", "dimensionId": "financas",
     "name": "Disponibilidade de Caixa", "shortName": "Disponibilidade caixa",
     "description": "Compara a disponibilidade líquida de caixa com a receita corrente líquida.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "higher_is_better", "order": 6},
    {"id": "geracao_de_caixa", "dimensionId": "financas",
     "name": "Geração de Caixa", "shortName": "Geração de caixa",
     "description": "Mostra a variação da disponibilidade líquida de caixa em relação ao ano anterior.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "higher_is_better", "order": 7},
    {"id": "restos_a_pagar", "dimensionId": "financas",
     "name": "Restos a Pagar", "shortName": "Restos a pagar",
     "description": "Relaciona o saldo de restos a pagar à receita corrente líquida.",
     "unit": "%", "format": "percent", "decimalPlaces": 1, "multiplier": 1,
     "direction": "lower_is_better", "order": 8},
]

# ---------------------------------------------------------------------------
# Extracao de dados reais do banco
# ---------------------------------------------------------------------------


class DatabaseAccessError(RuntimeError):
    pass


def _resolve_data() -> dict[str, Any]:
    """
    Tenta conectar ao banco local e extrair os dados reais.
    Retorna dicionario estruturado com tudo que o gerador precisa.
    """
    import sys as _sys

    _sys.path.insert(0, str(OLD_PROJECT))

    try:
        from src.data.repository import filter_ranking_data, get_local_postgres_engine
        from sqlalchemy import text
    except ImportError as exc:
        raise DatabaseAccessError(
            f"Nao foi possivel importar modulos do projeto antigo em {OLD_PROJECT}: {exc}"
        ) from exc

    # Verifica conexao
    try:
        engine = get_local_postgres_engine()
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        raise DatabaseAccessError(
            f"Conexao com banco PostgreSQL local falhou: {exc}"
        ) from exc

    # Carrega ranking completo
    try:
        ranking = filter_ranking_data()
    except Exception as exc:
        raise DatabaseAccessError(
            f"Nao foi possivel carregar ranking_municipios: {exc}"
        ) from exc

    if ranking.empty:
        raise DatabaseAccessError("Tabela ranking_municipios vazia")

    # Verifica ano sample
    available_years = sorted(ranking["ano"].dropna().astype(int).unique().tolist())
    if SAMPLE_YEAR not in available_years:
        raise DatabaseAccessError(
            f"Ano {SAMPLE_YEAR} nao encontrado no banco. Anos: {available_years}"
        )

    # Verifica Picada Cafe
    pc = ranking[
        ranking["id_municipio"].astype(str) == PICADA_CAFE_ID
    ]
    if pc.empty:
        raise DatabaseAccessError(
            f"Municipio {PICADA_CAFE_ID} (Picada Cafe) nao encontrado no banco"
        )

    # Verifica regiao RF3
    if PICADA_CAFE_REGION_ID not in ranking["regiao_funcional"].unique().tolist():
        raise DatabaseAccessError(f"Regiao {PICADA_CAFE_REGION_ID} nao encontrada no banco")

    # --- Agrega informacao por regiao (ano sample) ---
    ranking_year = ranking[ranking["ano"] == SAMPLE_YEAR].copy()
    region_info = {}
    for reg_id in sorted(ranking_year["regiao_funcional"].unique()):
        sub = ranking_year[ranking_year["regiao_funcional"] == reg_id]
        coredes = sorted(sub["corede"].dropna().unique().tolist())
        region_info[reg_id] = {
            "municipality_count": sub["municipio"].nunique(),
            "corede_ids": [_slugify_corede(c) for c in coredes],
            "corede_names": coredes,
            "corede_count": len(coredes),
            "avg_score": float(round(sub["nota_final"].mean(), 4)),
        }

    total_municipalities = sum(r["municipality_count"] for r in region_info.values())
    total_coredes = sum(r["corede_count"] for r in region_info.values())

    # --- Dados do Picada Cafe ---
    pc_all = ranking[
        ranking["id_municipio"].astype(str) == PICADA_CAFE_ID
    ].sort_values("ano")

    pc_2025 = pc_all[pc_all["ano"] == SAMPLE_YEAR]
    if pc_2025.empty:
        raise DatabaseAccessError("Picada Cafe sem dados para 2025")
    pc_row = pc_2025.iloc[0]

    pc_corede_name = str(pc_row["corede"]).strip()
    pc_region_name = str(pc_row["regiao_funcional"]).strip()

    # Ranking anterior (2024) para calcular rankChange
    pc_2024 = pc_all[pc_all["ano"] == SAMPLE_YEAR - 1]
    prev_rank = int(pc_2024["ranking_regiao_funcional"].iloc[0]) if not pc_2024.empty else None

    # --- Constroi catalogo de Coredes ---
    corede_registry: dict[str, tuple[str, str]] = {}  # slug -> (region_id, name)
    for reg_id, info in region_info.items():
        for slug, name in zip(info["corede_ids"], info["corede_names"]):
            corede_registry[slug] = (reg_id, name)

    # --- Constroi catalogo de municipios (RF3, 2025) ---
    rf3_2025 = ranking_year[ranking_year["regiao_funcional"] == PICADA_CAFE_REGION_ID]

    return {
        "available_years": available_years,
        "total_municipalities": total_municipalities,
        "total_coredes": total_coredes,
        "total_regions": len(region_info),
        "region_info": region_info,
        "corede_registry": corede_registry,
        "pc_all": pc_all,
        "pc_row": pc_row,
        "pc_corede_name": pc_corede_name,
        "pc_region_name": pc_region_name,
        "prev_rank": prev_rank,
        "rf3_2025": rf3_2025,
        "ranking_year": ranking_year,
    }


def _slugify_corede(name: str) -> str:
    ascii_name = (
        unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    )
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_name.strip().lower())
    return re.sub(r"_+", "_", slug).strip("_")


# ---------------------------------------------------------------------------
# Normalizacao de texto
# ---------------------------------------------------------------------------


def normalize_search_name(value: str) -> str:
    ascii_value = (
        unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    )
    return ascii_value.strip().lower()


def region_slug(region_id: str) -> str:
    return region_id.lower()


def region_name(region_id: str) -> str:
    return f"Região Funcional {region_id[2:]}"


# ---------------------------------------------------------------------------
# Builders de conteudo
# ---------------------------------------------------------------------------


def empty_dimension_map() -> dict[str, Any]:
    return {dim: None for dim in ("educacao", "financas", "meioAmbiente", "saude", "seguranca", "socioeconomico")}


def build_manifest(data: dict[str, Any], detailed_ids: list[str]) -> dict[str, Any]:
    years = data["available_years"]
    return {
        "schemaVersion": SCHEMA_VERSION,
        "activeDataVersion": DATA_VERSION,
        "generatedAt": GENERATED_AT,
        "defaultYear": SAMPLE_YEAR,
        "availableYears": years,
        "yearRange": {"start": min(years), "end": max(years)},
        "totals": {
            "municipalities": data["total_municipalities"],
            "regions": data["total_regions"],
            "coredes": data["total_coredes"],
        },
        "files": {
            "catalog": "catalog.json",
            "regionsPattern": "regions/{year}.json",
            "regionalRankingPattern": "rankings/{year}/{region}.json",
            "municipalitySummaryPattern": "municipalities/{municipalityId}/summary.json",
            "municipalityDimensionPattern": "municipalities/{municipalityId}/{dimension}.json",
        },
        "sample": {
            "isSample": True,
            "coveredRegionIds": sorted(data["region_info"].keys()),
            "detailedMunicipalityIds": detailed_ids,
        },
    }


def build_catalog(data: dict[str, Any]) -> dict[str, Any]:
    regions = []
    for order, reg_id in enumerate(sorted(data["region_info"].keys()), start=1):
        regions.append({
            "id": reg_id,
            "slug": region_slug(reg_id),
            "name": region_name(reg_id),
            "order": order,
        })

    coredes = []
    for slug, (reg_id, name) in sorted(data["corede_registry"].items()):
        coredes.append({"id": slug, "name": name, "regionId": reg_id})

    pc_row = data["pc_row"]
    municipalities = [
        {
            "id": PICADA_CAFE_ID,
            "name": str(pc_row["municipio"]).strip(),
            "searchName": normalize_search_name(str(pc_row["municipio"]).strip()),
            "regionId": data["pc_region_name"],
            "coredeId": _slugify_corede(data["pc_corede_name"]),
        }
    ]

    dimensions = [
        {"id": dim, "name": DIMENSION_LABELS[dim], "order": i + 1}
        for i, dim in enumerate(DIMENSION_IDS)
    ]

    return {
        "regions": regions,
        "coredes": coredes,
        "municipalities": municipalities,
        "dimensions": dimensions,
        "indicators": INDICATORS,
    }


DIMENSION_LABELS = {
    "educacao": "Educação",
    "financas": "Finanças",
    "meio_ambiente": "Meio ambiente",
    "saude": "Saúde",
    "seguranca": "Segurança",
    "socioeconomico": "Socioeconômico",
}


def _dim_scores_from_row(row: Any) -> dict[str, float | None]:
    scores = empty_dimension_map()
    for col, dim_id in DIMENSION_MAP.items():
        raw = row.get(col) if hasattr(row, "get") else None
        scores[dim_id] = _to_float(raw)
    return scores


def build_regions(data: dict[str, Any]) -> dict[str, Any]:
    summaries = []
    for order, reg_id in enumerate(sorted(data["region_info"].keys()), start=1):
        info = data["region_info"][reg_id]
        summaries.append({
            "id": reg_id,
            "name": region_name(reg_id),
            "order": order,
            "municipalityCount": info["municipality_count"],
            "coredeCount": info["corede_count"],
            "coredeIds": info["corede_ids"],
            "coredeNames": info["corede_names"],
            "averageFinalScore": info["avg_score"],
        })

    return {
        "year": SAMPLE_YEAR,
        "totals": {
            "municipalities": data["total_municipalities"],
            "regions": data["total_regions"],
            "coredes": data["total_coredes"],
        },
        "regions": summaries,
    }


def build_regional_ranking(data: dict[str, Any]) -> dict[str, Any]:
    rf3 = data["rf3_2025"]

    entries = []
    for _, row in rf3.iterrows():
        mid = str(row["id_municipio"])
        name = str(row["municipio"]).strip()
        corede_name = str(row["corede"]).strip()
        corede_slug = _slugify_corede(corede_name)

        rank_val = int(row["ranking_regiao_funcional"]) if _is_valid_number(row.get("ranking_regiao_funcional")) else None
        score_val = float(row["nota_final"]) if _is_valid_number(row.get("nota_final")) else None

        # Dimension ranks not available in base table
        entry = {
            "municipalityId": mid,
            "municipalityName": name,
            "coredeId": corede_slug,
            "coredeName": corede_name,
            "overallRank": rank_val,
            "previousOverallRank": None,
            "rankChange": None,
            "populationPerformance": {"code": "unknown", "label": "Sem classificação"},
            "finalScore": score_val,
            "dimensionRanks": empty_dimension_map(),
        }
        entries.append(entry)

    return {
        "year": SAMPLE_YEAR,
        "regionId": PICADA_CAFE_REGION_ID,
        "regionName": region_name(PICADA_CAFE_REGION_ID),
        "municipalityCount": len(entries),
        "municipalities": entries,
    }


def build_municipality_summary(data: dict[str, Any]) -> dict[str, Any]:
    pc_all = data["pc_all"]
    pc_row = data["pc_row"]
    rf3_info = data["region_info"]["RF3"]

    summary_pc = pc_all[pc_all["id_municipio"].astype(str) == PICADA_CAFE_ID].sort_values("ano").copy()

    yearly_summaries = []
    dimension_history: dict[str, list[dict[str, Any]]] = {dim: [] for dim in DIMENSION_IDS}

    for _, row in summary_pc.iterrows():
        year = int(row["ano"])
        rank = int(row["ranking_regiao_funcional"]) if _is_valid_number(row.get("ranking_regiao_funcional")) else None
        score = _to_float(row.get("nota_final"))

        # Find previous year rank for rankChange
        prev = None
        if year > min(data["available_years"]):
            prev_row = summary_pc[summary_pc["ano"] == year - 1]
            if not prev_row.empty:
                prev_val = prev_row["ranking_regiao_funcional"].iloc[0]
                prev = int(prev_val) if _is_valid_number(prev_val) else None

        rank_change = (prev - rank) if (prev is not None and rank is not None) else None

        dim_scores = _dim_scores_from_row(row)
        dim_ranks = empty_dimension_map()  # Not available in base data

        yearly_summaries.append({
            "year": year,
            "overallRank": rank,
            "previousOverallRank": prev,
            "rankChange": rank_change,
            "totalMunicipalitiesInRegion": rf3_info["municipality_count"],
            "classification": {"code": "unknown", "label": "Sem classificação"},
            "finalScore": score,
            "dimensionScores": dim_scores,
            "dimensionRanks": dim_ranks,
        })

        # Populate dimension history per dimension
        for col, dim_id in DIMENSION_MAP.items():
            dim_score_val = _to_float(row.get(col))
            dim_history_entry = {
                "year": year,
                "score": dim_score_val,
                "rank": None,
                "totalMunicipalitiesInRegion": rf3_info["municipality_count"],
            }
            dimension_history[dim_id].append(dim_history_entry)

    all_dim_history = [
        {"dimensionId": dim_id, "values": values}
        for dim_id, values in dimension_history.items()
        if values
    ]

    return {
        "municipality": {
            "id": PICADA_CAFE_ID,
            "name": str(pc_row["municipio"]).strip(),
            "regionId": data["pc_region_name"],
            "regionName": region_name(data["pc_region_name"]),
            "coredeId": _slugify_corede(data["pc_corede_name"]),
            "coredeName": data["pc_corede_name"],
        },
        "availableYears": summary_pc["ano"].astype(int).tolist(),
        "latestYear": int(summary_pc["ano"].max()),
        "yearlySummaries": yearly_summaries,
        "dimensionHistory": all_dim_history,
    }


def build_dimension_file(data: dict[str, Any], dimension_id: str) -> dict[str, Any]:
    summary_pc = data["pc_all"][data["pc_all"]["id_municipio"].astype(str) == PICADA_CAFE_ID].sort_values("ano")
    rf3_info = data["region_info"]["RF3"]

    dim_history = []
    for _, row in summary_pc.iterrows():
        year = int(row["ano"])
        col = "nota_" + dimension_id
        score_val = _to_float(row.get(col))
        dim_history.append({
            "year": year,
            "score": score_val,
            "rank": None,
            "totalMunicipalitiesInRegion": rf3_info["municipality_count"],
        })

    # No indicator-level data available from base tables
    indicator_ids = [ind["id"] for ind in INDICATORS if ind["dimensionId"] == dimension_id]
    series = [{"indicatorId": lid, "values": []} for lid in indicator_ids]

    return {
        "municipalityId": PICADA_CAFE_ID,
        "regionId": data["pc_region_name"],
        "dimensionId": dimension_id,
        "availableYears": data["available_years"],
        "dimensionHistory": dim_history,
        "indicators": series,
    }


# ---------------------------------------------------------------------------
# Serializacao
# ---------------------------------------------------------------------------


def envelope(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "dataVersion": DATA_VERSION,
        "generatedAt": GENERATED_AT,
        "data": payload,
    }


def write_json(path: Path, content: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(content, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


# ---------------------------------------------------------------------------
# Validacao
# ---------------------------------------------------------------------------


class ValidationError(RuntimeError):
    pass


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise ValidationError(message)


def _assert_no_banned(value: Any, path: str = "") -> None:
    banned = ("", "N/A", "-", "—", "NaN")
    if isinstance(value, dict):
        for k, v in value.items():
            _assert_no_banned(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _assert_no_banned(v, f"{path}[{i}]")
    elif isinstance(value, str):
        _assert(value not in banned, f"{path}: proibido {value!r}")


def _assert_no_nan(value: Any, path: str = "") -> None:
    if isinstance(value, dict):
        for k, v in value.items():
            _assert_no_nan(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _assert_no_nan(v, f"{path}[{i}]")
    elif isinstance(value, float):
        _assert(not math.isnan(value), f"NaN em {path}")


def validate_manifest(m: dict[str, Any], data: dict[str, Any]) -> None:
    _assert(m["schemaVersion"] == SCHEMA_VERSION, "schemaVersion")
    _assert(m["activeDataVersion"] == DATA_VERSION, "activeDataVersion")
    _assert(m["defaultYear"] == SAMPLE_YEAR, "defaultYear")
    _assert(m["availableYears"] == data["available_years"], "availableYears")
    _assert(m["totals"]["municipalities"] == data["total_municipalities"], "totals.municipios")
    _assert(m["totals"]["coredes"] == data["total_coredes"], "totals.coredes")
    _assert(m["totals"]["regions"] == data["total_regions"], "totals.regioes")
    _assert(isinstance(m["sample"], dict), "sample metadata")


def validate_catalog(cat: dict[str, Any], data: dict[str, Any]) -> None:
    _assert(len(cat["regions"]) == data["total_regions"], "regioes no catalogo")
    _assert(len(cat["coredes"]) == data["total_coredes"], "coredes no catalogo")
    _assert(len(cat["municipalities"]) >= 1, "municipios no catalogo")
    _assert(len(cat["dimensions"]) == 6, "dimensoes")
    _assert(len(cat["indicators"]) >= 2, "indicadores")

    seen = set()
    for m in cat["municipalities"]:
        _assert(m["id"] not in seen, f"municipio duplicado {m['id']}")
        seen.add(m["id"])
        _assert(re.fullmatch(r"\d{7}", m["id"]), f"id invalido {m['id']}")
        _assert(m["regionId"] in data["region_info"], f"regiao invalida {m['regionId']}")
        corede_ids = {r for reg in data["region_info"].values() for r in reg["corede_ids"]}
        _assert(m["coredeId"] in corede_ids, f"corede invalido {m['coredeId']}")


def validate_envelope(p: dict[str, Any], label: str) -> None:
    _assert(p.get("schemaVersion") == SCHEMA_VERSION, f"{label}.schemaVersion")
    _assert(p.get("dataVersion") == DATA_VERSION, f"{label}.dataVersion")
    _assert(isinstance(p.get("data"), dict), f"{label}.data")


def validate_ranking(r: dict[str, Any], data: dict[str, Any]) -> None:
    _assert(r["regionId"] == "RF3", "ranking regionId")
    _assert(isinstance(r["municipalities"], list) and len(r["municipalities"]) >= 1, "ranking entries")
    _assert(r["municipalityCount"] == len(r["municipalities"]), "municipalityCount")
    seen = set()
    for e in r["municipalities"]:
        _assert(e["municipalityId"] not in seen, f"duplicado {e['municipalityId']}")
        seen.add(e["municipalityId"])
        _assert(e["populationPerformance"]["code"] in ("above", "expected", "below", "unknown"), "code")
        for key in ("educacao", "financas", "meioAmbiente", "saude", "seguranca", "socioeconomico"):
            _assert(key in e["dimensionRanks"], f"dimensionRank {key}")
    _assert(any(e["municipalityId"] == PICADA_CAFE_ID for e in r["municipalities"]), "picada no ranking")


def validate_dim_file(d: dict[str, Any], dim_id: str) -> None:
    _assert(d["dimensionId"] == dim_id, "dimensionId")
    _assert(d["municipalityId"] == PICADA_CAFE_ID, "municipalityId")
    _assert(isinstance(d["indicators"], list), "indicators")
    for s in d["indicators"]:
        _assert(isinstance(s.get("indicatorId"), str), "indicatorId")
        _assert(isinstance(s.get("values"), list), "values")


# ---------------------------------------------------------------------------
# Orquestracao
# ---------------------------------------------------------------------------


def clean_sample_dir() -> None:
    sample_dir = PUBLIC_DATA_DIR / DATA_VERSION
    if sample_dir.exists():
        shutil.rmtree(sample_dir)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)


def main() -> int:
    print("Conectando ao banco de dados do projeto antigo...")
    data = _resolve_data()
    print(f"  Anos: {data['available_years']}")
    print(f"  Total municipios: {data['total_municipalities']}")
    print(f"  Picada Cafe (2025): rank={int(data['pc_row']['ranking_regiao_funcional'])}, "
          f"score={float(data['pc_row']['nota_final']):.4f}, "
          f"corede={data['pc_corede_name']}")
    print(f"  Regioes: {len(data['region_info'])}")
    for reg_id, info in sorted(data["region_info"].items()):
        print(f"    {reg_id}: {info['municipality_count']} mun, "
              f"{info['corede_count']} coredes, media={info['avg_score']:.2f}")

    clean_sample_dir()
    sample_dir = PUBLIC_DATA_DIR / DATA_VERSION

    catalog_data = build_catalog(data)
    regions_data = build_regions(data)
    ranking_data = build_regional_ranking(data)
    summary_data = build_municipality_summary(data)
    educacao_data = build_dimension_file(data, "educacao")
    financas_data = build_dimension_file(data, "financas")

    manifest = build_manifest(data, [PICADA_CAFE_ID])

    # Validacao pre-escrita
    validate_manifest(manifest, data)
    validate_catalog(catalog_data, data)
    validate_envelope({"schemaVersion": SCHEMA_VERSION, "dataVersion": DATA_VERSION, "data": regions_data}, "regions")
    validate_ranking(ranking_data, data)
    validate_dim_file(educacao_data, "educacao")
    validate_dim_file(financas_data, "financas")

    # Escrita
    write_json(PUBLIC_DATA_DIR / "manifest.json", manifest)
    write_json(sample_dir / "catalog.json", envelope(catalog_data))
    write_json(sample_dir / "regions" / f"{SAMPLE_YEAR}.json", envelope(regions_data))
    write_json(
        sample_dir / "rankings" / str(SAMPLE_YEAR) / f"{region_slug(PICADA_CAFE_REGION_ID)}.json",
        envelope(ranking_data),
    )
    mun_dir = sample_dir / "municipalities" / PICADA_CAFE_ID
    write_json(mun_dir / "summary.json", envelope(summary_data))
    write_json(mun_dir / "educacao.json", envelope(educacao_data))
    write_json(mun_dir / "financas.json", envelope(financas_data))

    # Pos-escrita
    written = [
        PUBLIC_DATA_DIR / "manifest.json",
        sample_dir / "catalog.json",
        sample_dir / "regions" / f"{SAMPLE_YEAR}.json",
        sample_dir / "rankings" / str(SAMPLE_YEAR) / f"{region_slug(PICADA_CAFE_REGION_ID)}.json",
        mun_dir / "summary.json",
        mun_dir / "educacao.json",
        mun_dir / "financas.json",
    ]
    for p in written:
        _assert(p.exists(), f"nao gerado: {p}")
        with p.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        _assert_no_banned(payload)
        _assert_no_nan(payload)

    print(f"Amostra gerada em {sample_dir}. Arquivos:")
    for p in written:
        print(f"  {p.relative_to(NEW_PROJECT)}")

    # Aviso sobre dados ausentes no indicador
    print()
    print("ATENCAO: Nao ha dados de indicadores (nota_indicador, valor_original,")
    print("medianas) nas tabelas existentes do banco. Os arquivos de dimensao")
    print("contem dimensionHistory real mas arrays de indicadores vazios.")
    print("Classificacao por porte populacional indisponivel: code='unknown'.")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except DatabaseAccessError as exc:
        print(f"ERRO DE ACESSO AO BANCO: {exc}", file=sys.stderr)
        print("Nao foi possivel extrair dados reais. Nenhum JSON foi gerado.", file=sys.stderr)
        raise SystemExit(1) from exc
    except ValidationError as exc:
        print(f"ERRO DE VALIDACAO: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc