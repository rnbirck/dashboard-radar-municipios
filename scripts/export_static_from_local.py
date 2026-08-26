#!/usr/bin/env python3
"""
Exportador estatico real — fonte: PostgreSQL local staging_2025.

Le staging_2025, deriva dados em memoria (medianas, rankings, dimensoes),
gera JSONs em public/data/v2025 e atualiza public/data/manifest.json.

Uso:
    python scripts/export_static_from_local.py
    python scripts/export_static_from_local.py --schema staging_2025
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import sys
import unicodedata
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# DB config (compartilhado com pipeline)
# ---------------------------------------------------------------------------

ALLOWED_HOSTS = {"localhost", "127.0.0.1", "::1"}
_STAGING_PATTERN = re.compile(r"^staging_[12][0-9]{3}$")
DB_PROJECT = Path(r"C:\Users\rnbirck\PROJETOS\CEI\cei\ranking_municipios\DB")
RANKING_RESULTS_DIR = DB_PROJECT.parent / "resultados"
sys.path.insert(0, str(DB_PROJECT))

from shared.config import DbConfig  # noqa: E402

# ---------------------------------------------------------------------------
# Caminhos de saida
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA = PROJECT_ROOT / "public" / "data"
DATA_VERSION = "v2025"
OUTPUT_DIR = PUBLIC_DATA / DATA_VERSION

SCHEMA_VERSION = "1.0.0"
DEFAULT_YEAR = 2025
GENERATED_AT = datetime.now(timezone.utc).replace(microsecond=0).isoformat() + "Z"

# ---------------------------------------------------------------------------
# Constantes
# ---------------------------------------------------------------------------

DIMENSION_IDS = ["educacao", "financas", "meio_ambiente", "saude", "seguranca", "socioeconomico"]
DIMENSION_LABELS: dict[str, str] = {
    "educacao": "Educação", "financas": "Finanças", "meio_ambiente": "Meio ambiente",
    "saude": "Saúde", "seguranca": "Segurança", "socioeconomico": "Socioeconômico",
}
DIM_MAP_PT = dict(zip(DIMENSION_IDS, DIMENSION_IDS))
DIM_COL_MAP = {d: f"nota_{d}" for d in DIMENSION_IDS}

REGION_NAMES: dict[str, str] = {
    "RF1": "Região Funcional 1", "RF2": "Região Funcional 2",
    "RF3": "Região Funcional 3", "RF4": "Região Funcional 4",
    "RF5": "Região Funcional 5", "RF6": "Região Funcional 6",
    "RF7": "Região Funcional 7", "RF8": "Região Funcional 8",
    "RF9": "Região Funcional 9",
}

YEARS = [2021, 2022, 2023, 2024, 2025]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _s(v: Any) -> float | None:
    if v is None or (isinstance(v, float) and (math.isnan(v) or math.isinf(v))):
        return None
    try:
        f = float(v)
        if math.isnan(f) or math.isinf(f):
            return None
        return f
    except (TypeError, ValueError, OverflowError):
        return None


def _si(v: Any) -> int | None:
    f = _s(v)
    return int(f) if f is not None else None


def _slugify(value: str) -> str:
    ascii_val = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_val.strip().lower())
    return re.sub(r"_+", "_", slug).strip("_")


def _norm_bool(v: Any) -> bool | None:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    s = str(v).strip().lower()
    if s in ("s", "sim", "true", "1", "yes"):
        return True
    if s in ("n", "nao", "não", "false", "0", "no"):
        return False
    return None


def _norm_name(val: str) -> str:
    return unicodedata.normalize("NFKD", val).encode("ascii", "ignore").decode("ascii").strip().lower()


def _classification_code(raw: Any) -> dict[str, str]:
    if raw is None or (isinstance(raw, float) and math.isnan(raw)):
        return {"code": "unknown", "label": "Sem classificação"}
    s = unicodedata.normalize("NFKD", str(raw)).encode("ascii", "ignore").decode("ascii").strip().lower()
    if "acima" in s or "above" in s:
        return {"code": "above", "label": "Acima do esperado"}
    if "abaixo" in s or "baixo" in s:
        return {"code": "below", "label": "Abaixo do esperado"}
    if "dentro" in s or "intervalo" in s or "esperado" in s:
        return {"code": "expected", "label": "Dentro do esperado"}
    return {"code": "unknown", "label": str(raw).strip() if str(raw).strip() else "Sem classificação"}


def _empty_dim_map() -> dict[str, int | None]:
    return {d: None for d in ("educacao", "financas", "meioAmbiente", "saude", "seguranca", "socioeconomico")}


# Load js-side dim key names
_JS_DIM_KEYS = list(_empty_dim_map().keys())
_JS_DIM_MAP = dict(zip(DIMENSION_IDS, _JS_DIM_KEYS))


def _dim_js(dim_pt: str) -> str:
    return _JS_DIM_MAP.get(dim_pt, dim_pt)


def _build_dimension_rank_lookup(
    dim_frames: dict[str, pd.DataFrame],
) -> dict[tuple[int, int, str], int | None]:
    """Replica o Dash: ranking_dimensao por município/ano/Região Funcional."""
    lookup: dict[tuple[int, int, str], int | None] = {}
    for dim, frame in dim_frames.items():
        required = {"id_municipio", "ano", "ranking_dimensao"}
        missing = required.difference(frame.columns)
        if missing:
            raise RuntimeError(f"base_{dim}: colunas ausentes para ranking dimensional: {sorted(missing)}")

        ranked = frame.dropna(subset=["id_municipio", "ano", "ranking_dimensao"])
        conflicts = ranked.groupby(["id_municipio", "ano"])["ranking_dimensao"].nunique()
        conflicting_keys = conflicts[conflicts > 1]
        if not conflicting_keys.empty:
            sample = list(conflicting_keys.index[:5])
            raise RuntimeError(f"base_{dim}: ranking_dimensao inconsistente em {sample}")

        unique_rows = ranked.drop_duplicates(["id_municipio", "ano"])
        for _, row in unique_rows.iterrows():
            lookup[(int(row["id_municipio"]), int(row["ano"]), dim)] = _si(row["ranking_dimensao"])
    return lookup


# ---------------------------------------------------------------------------
# Conexao
# ---------------------------------------------------------------------------


def _get_engine(schema: str) -> Any:
    cfg = DbConfig.from_env()
    if cfg.host.lower() not in ALLOWED_HOSTS:
        raise RuntimeError(f"Host {cfg.host} nao permitido para exportacao local")
    url = cfg.url
    return create_engine(url, connect_args={"connect_timeout": 10})


# ---------------------------------------------------------------------------
# Leitura das tabelas
# ---------------------------------------------------------------------------


def _read_table(engine: Any, schema: str, table: str) -> pd.DataFrame:
    return pd.read_sql_query(
        text(f'SELECT * FROM "{schema}"."{table}"'),
        engine,
    )


def _read_municipal_profile(engine: Any) -> dict[int, dict[str, Any]]:
    """Le contexto municipal complementar de tabelas publicas do CEI."""
    population = pd.read_sql_query(
        text("""
            SELECT
                id_municipio::text AS id_municipio,
                ano::int AS ano,
                SUM(pop_estimada)::double precision AS population
            FROM public.populacao_rs
            GROUP BY id_municipio::text, ano::int
        """),
        engine,
    )
    gdp = pd.read_sql_query(
        text("""
            SELECT
                id_municipio::text AS id_municipio,
                ano::int AS ano,
                (MAX(pib_mil)::double precision * 1000.0) AS gdp_brl
            FROM public.pib_mun_rs
            WHERE pib_mil IS NOT NULL
            GROUP BY id_municipio::text, ano::int
        """),
        engine,
    )
    area = pd.read_sql_query(
        text("""
            SELECT DISTINCT ON (id_municipio::text)
                id_municipio::text AS id_municipio,
                area::double precision AS area_km2
            FROM public.populacao
            WHERE sigla_uf = 'RS'
              AND area IS NOT NULL
            ORDER BY id_municipio::text, ano DESC
        """),
        engine,
    )

    profile: dict[int, dict[str, Any]] = {}

    for mid, rows in population.sort_values(["id_municipio", "ano"]).groupby("id_municipio"):
        profile.setdefault(int(mid), {})["populationEstimates"] = [
            {"year": int(row["ano"]), "value": _si(row["population"])}
            for _, row in rows.iterrows()
        ]

    for mid, rows in gdp.sort_values(["id_municipio", "ano"]).groupby("id_municipio"):
        profile.setdefault(int(mid), {})["gdpValues"] = [
            {"year": int(row["ano"]), "valueBrl": _s(row["gdp_brl"])}
            for _, row in rows.iterrows()
        ]

    for _, row in area.iterrows():
        profile.setdefault(int(row["id_municipio"]), {})["areaKm2"] = _s(row["area_km2"])

    for item in profile.values():
        item.setdefault("populationEstimates", [])
        item.setdefault("gdpValues", [])
        item.setdefault("areaKm2", None)

    return profile


# ---------------------------------------------------------------------------
# Indicadores — metadados curados do projeto
# ---------------------------------------------------------------------------


def _indicator_name(iid: str) -> str:
    names: dict[str, str] = {
        "adequacao_formacao_docente": "Adequação da Formação Docente",
        "saeb_ensino_fundamental": "Nota do SAEB — Ensino Fundamental",
        "taxa_cobertura_creche": "Taxa de Cobertura de Creche",
        "taxa_distorcao_fundamental": "Taxa de Distorção Idade-Série — Ensino Fundamental",
        "qt_acesso_infor": "Acesso à Informação",
        "exec_orc_corrente": "Execução Orçamentária Corrente",
        "autonomia_fiscal": "Autonomia Fiscal",
        "endividamento": "Endividamento",
        "despesas_pessoal": "Despesas com Pessoal",
        "investimento": "Investimento",
        "disponibilidade_caixa": "Disponibilidade de Caixa",
        "geracao_de_caixa": "Geração de Caixa",
        "restos_a_pagar": "Restos a Pagar",
        "desmatamento_por_area": "Desmatamento por Área",
        "emissao_gases_per_capita": "Emissão de Gases per Capita",
        "incidencia_coliformes": "Incidência de Coliformes na Água",
        "indice_perdas_distribuicao": "Índice de Perdas na Distribuição",
        "prop_atendimento_agua": "Proporção de Atendimento de Água",
        "prop_coleta_residuos": "Proporção de Coleta de Resíduos",
        "obitos_causas_evitaveis_mil_habitantes": "Óbitos por Causas Evitáveis por Mil Habitantes",
        "proporcao_consultas_pre_natal": "Proporção de Consultas de Pré-natal",
        "proporcao_gravidez_adolescencia": "Proporção de Gravidez na Adolescência",
        "medicos_por_mil_habitantes": "Médicos por Mil Habitantes",
        "cobertura_aps": "Cobertura de Atenção Primária à Saúde",
        "cobertura_acs": "Cobertura de Agentes Comunitários de Saúde",
        "cobertura_vacinal_penta_polio_media": "Cobertura Vacinal Média — Pentavalente e Poliomielite",
        "delitos_com_armas_por_10mil_hab": "Delitos com Armas por 10 Mil Habitantes",
        "furtos_por_10mil_hab": "Furtos por 10 Mil Habitantes",
        "homicidio_doloso_por_10mil_hab": "Homicídios Dolosos por 10 Mil Habitantes",
        "roubos_por_10mil_hab": "Roubos por 10 Mil Habitantes",
        "roubos_furtos_veiculos_por_10mil_veiculos": "Roubos e Furtos de Veículos por 10 Mil Veículos",
        "estupro_por_10mil_mulheres": "Estupros por 10 Mil Mulheres",
        "ameaca_por_10mil_mulheres": "Ameaças por 10 Mil Mulheres",
        "pib_per_capita": "PIB per Capita",
        "mulheres_empregadas_ensino_medio_ou_mais_por_1000_mulheres": "Mulheres Empregadas com Ensino Médio ou Mais por 1.000 Mulheres",
        "renda_media": "Renda Média",
        "vinculos_per_capita": "Vínculos Formais per Capita",
        "formalidade_mercado_trabalho": "Formalidade do Mercado de Trabalho",
        "geracao_emprego_per_capita": "Geração de Emprego por 1.000 Habitantes",
        "vulnerabilidade_social": "Vulnerabilidade Social",
        "proporcao_pessoas_baixa_renda": "Proporção de Pessoas de Baixa Renda",
    }
    return names.get(iid, iid.replace("_", " ").title())


def _indicator_short(iid: str) -> str | None:
    sn: dict[str, str | None] = {
        "adequacao_formacao_docente": "Formação docente", "saeb_ensino_fundamental": "SAEB fundamental",
        "taxa_cobertura_creche": "Cobertura creche", "taxa_distorcao_fundamental": "Distorção fundamental",
        "qt_acesso_infor": "Acesso à informação", "exec_orc_corrente": "Execução orçamentária",
        "autonomia_fiscal": "Autonomia fiscal", "endividamento": None,
        "despesas_pessoal": "Despesas pessoal", "investimento": None,
        "disponibilidade_caixa": "Disponibilidade caixa", "geracao_de_caixa": "Geração de caixa",
        "restos_a_pagar": "Restos a pagar", "desmatamento_por_area": "Desmatamento",
        "emissao_gases_per_capita": "Emissão gases", "incidencia_coliformes": "Coliformes",
        "indice_perdas_distribuicao": "Perdas distribuição", "prop_atendimento_agua": "Atendimento água",
        "prop_coleta_residuos": "Coleta resíduos",
        "obitos_causas_evitaveis_mil_habitantes": "Óbitos evitáveis",
        "proporcao_consultas_pre_natal": "Pré-natal",
        "proporcao_gravidez_adolescencia": "Gravidez adolescência",
        "medicos_por_mil_habitantes": "Médicos/mil hab", "cobertura_aps": "Cobertura APS",
        "cobertura_acs": "Cobertura ACS", "cobertura_vacinal_penta_polio_media": "Vacinal penta/pólio",
        "delitos_com_armas_por_10mil_hab": "Armas/10 mil hab",
        "furtos_por_10mil_hab": "Furtos/10 mil hab",
        "homicidio_doloso_por_10mil_hab": "Homicídios/10 mil hab",
        "roubos_por_10mil_hab": "Roubos/10 mil hab",
        "roubos_furtos_veiculos_por_10mil_veiculos": "Roubos/furtos veíc.",
        "estupro_por_10mil_mulheres": "Estupros/10 mil mulh.",
        "ameaca_por_10mil_mulheres": "Ameaças/10 mil mulh.",
        "pib_per_capita": "PIB per capita",
        "mulheres_empregadas_ensino_medio_ou_mais_por_1000_mulheres": "Mulheres empregadas ensino médio+",
        "renda_media": "Renda média", "vinculos_per_capita": "Vínculos per capita",
        "formalidade_mercado_trabalho": "Formalidade", "geracao_emprego_per_capita": "Geração empregos/1.000 hab",
        "vulnerabilidade_social": "Vulnerabilidade social", "proporcao_pessoas_baixa_renda": "Baixa renda",
    }
    return sn.get(iid)


def _indicator_desc(iid: str) -> str:
    return {
        "adequacao_formacao_docente": "Considera a proporção de docentes do ensino fundamental com formação adequada à área em que atuam.",
        "saeb_ensino_fundamental": "Sintetiza o desempenho em Português e Matemática no SAEB.",
        "taxa_cobertura_creche": "Expressa a cobertura de matrículas em creche na rede municipal.",
        "taxa_distorcao_fundamental": "Indica a proporção de estudantes do ensino fundamental com idade acima da esperada.",
        "qt_acesso_infor": "Considera a disponibilidade de recursos de acesso à informação nas escolas.",
        "exec_orc_corrente": "Relaciona as despesas correntes às receitas correntes.",
        "autonomia_fiscal": "Avalia a capacidade do município de financiar suas atividades com receitas próprias.",
        "endividamento": "Expressa o peso da dívida consolidada líquida sobre a receita corrente líquida.",
        "despesas_pessoal": "Indica a participação das despesas com pessoal na receita corrente líquida.",
        "investimento": "Representa a parcela da receita corrente líquida destinada a investimentos.",
        "disponibilidade_caixa": "Compara a disponibilidade líquida de caixa com a receita corrente líquida.",
        "geracao_de_caixa": "Mostra a variação da disponibilidade líquida de caixa em relação ao ano anterior.",
        "restos_a_pagar": "Relaciona o saldo de restos a pagar à receita corrente líquida.",
        "desmatamento_por_area": "Expressa a parcela da área municipal afetada pelo desmatamento.",
        "emissao_gases_per_capita": "Relaciona as emissões de gases de efeito estufa ao tamanho da população.",
        "incidencia_coliformes": "Indica a presença de coliformes nas análises da água distribuída.",
        "indice_perdas_distribuicao": "Representa a parcela da água produzida que se perde durante a distribuição.",
        "prop_atendimento_agua": "Expressa a proporção da população atendida pelo abastecimento de água.",
        "prop_coleta_residuos": "Indica a proporção da população atendida pela coleta de resíduos.",
        "obitos_causas_evitaveis_mil_habitantes": "Relaciona os óbitos por causas evitáveis ao tamanho da população.",
        "proporcao_consultas_pre_natal": "Indica a proporção de nascidos vivos cujas mães realizaram 7+ consultas de pré-natal.",
        "proporcao_gravidez_adolescencia": "Expressa a participação de mães adolescentes no total de nascidos vivos.",
        "medicos_por_mil_habitantes": "Relaciona o número de médicos disponíveis ao tamanho da população.",
        "cobertura_aps": "Representa a cobertura potencial da Atenção Primária à Saúde.",
        "cobertura_acs": "Indica a cobertura estimada dos agentes comunitários de saúde.",
        "cobertura_vacinal_penta_polio_media": "Sintetiza a cobertura das vacinas pentavalente e poliomielite.",
        "delitos_com_armas_por_10mil_hab": "Relaciona as ocorrências de delitos com armas ao tamanho da população.",
        "furtos_por_10mil_hab": "Expressa as ocorrências de furto em relação ao tamanho da população.",
        "homicidio_doloso_por_10mil_hab": "Indica a incidência de homicídios dolosos em relação ao tamanho da população.",
        "roubos_por_10mil_hab": "Relaciona as ocorrências de roubo ao tamanho da população.",
        "roubos_furtos_veiculos_por_10mil_veiculos": "Compara os roubos e furtos de veículos com o tamanho da frota.",
        "estupro_por_10mil_mulheres": "Relaciona as ocorrências de estupro à população feminina.",
        "ameaca_por_10mil_mulheres": "Relaciona as ocorrências de ameaça à população feminina.",
        "pib_per_capita": "Relaciona o valor do PIB municipal ao número de habitantes.",
        "mulheres_empregadas_ensino_medio_ou_mais_por_1000_mulheres": "Expressa os vínculos formais de mulheres com ensino médio+.",
        "renda_media": "Representa a remuneração média dos vínculos formais em dezembro.",
        "vinculos_per_capita": "Relaciona o número de vínculos formais ativos à população.",
        "formalidade_mercado_trabalho": "Compara os vínculos formais ativos com a população de 15 a 69 anos.",
        "geracao_emprego_per_capita": "Relaciona o saldo de empregos formais gerados ao tamanho da população.",
        "vulnerabilidade_social": "Indica a proporção da população registrada no Cadastro Único.",
        "proporcao_pessoas_baixa_renda": "Expressa a proporção de pessoas em famílias de baixa renda.",
    }.get(iid, "")


_INDICATOR_SOURCES: dict[str, str] = {
    "adequacao_formacao_docente": "INEP",
    "saeb_ensino_fundamental": "INEP",
    "taxa_cobertura_creche": "INEP",
    "taxa_distorcao_fundamental": "INEP",
    "qt_acesso_infor": "INEP",
    "exec_orc_corrente": "Siconfi / STN",
    "autonomia_fiscal": "Siconfi / STN",
    "endividamento": "Siconfi / STN",
    "despesas_pessoal": "Siconfi / STN",
    "investimento": "Siconfi / STN",
    "disponibilidade_caixa": "Siconfi / STN",
    "geracao_de_caixa": "Siconfi / STN",
    "restos_a_pagar": "Siconfi / STN",
    "desmatamento_por_area": "MapBiomas",
    "emissao_gases_per_capita": "SEEG",
    "incidencia_coliformes": "SNIS",
    "indice_perdas_distribuicao": "SNIS",
    "prop_atendimento_agua": "SNIS",
    "prop_coleta_residuos": "SNIS",
    "obitos_causas_evitaveis_mil_habitantes": "Ministério da Saúde / DATASUS",
    "proporcao_consultas_pre_natal": "Ministério da Saúde / DATASUS",
    "proporcao_gravidez_adolescencia": "Ministério da Saúde / DATASUS",
    "medicos_por_mil_habitantes": "Ministério da Saúde / CNES",
    "cobertura_aps": "Ministério da Saúde / CNES",
    "cobertura_acs": "Ministério da Saúde / CNES",
    "cobertura_vacinal_penta_polio_media": "Ministério da Saúde / SI-PNI",
    "delitos_com_armas_por_10mil_hab": "SSP-RS",
    "furtos_por_10mil_hab": "SSP-RS",
    "homicidio_doloso_por_10mil_hab": "SSP-RS",
    "roubos_por_10mil_hab": "SSP-RS",
    "roubos_furtos_veiculos_por_10mil_veiculos": "SSP-RS",
    "estupro_por_10mil_mulheres": "SSP-RS",
    "ameaca_por_10mil_mulheres": "SSP-RS",
    "pib_per_capita": "IBGE",
    "mulheres_empregadas_ensino_medio_ou_mais_por_1000_mulheres": "RAIS / IBGE",
    "renda_media": "RAIS",
    "vinculos_per_capita": "RAIS",
    "formalidade_mercado_trabalho": "RAIS",
    "geracao_emprego_per_capita": "Novo Caged",
    "vulnerabilidade_social": "Cadastro Único",
    "proporcao_pessoas_baixa_renda": "Cadastro Único",
}


def _indicator_source(iid: str) -> str:
    try:
        return _INDICATOR_SOURCES[iid]
    except KeyError as error:
        raise RuntimeError(f"Fonte não cadastrada para o indicador: {iid}") from error


def _indicator_direction(iid: str) -> str:
    higher = {"adequacao_formacao_docente", "saeb_ensino_fundamental", "taxa_cobertura_creche",
              "qt_acesso_infor", "autonomia_fiscal", "investimento", "disponibilidade_caixa",
              "geracao_de_caixa", "prop_atendimento_agua", "prop_coleta_residuos",
              "proporcao_consultas_pre_natal", "medicos_por_mil_habitantes", "cobertura_aps",
              "cobertura_acs", "cobertura_vacinal_penta_polio_media", "pib_per_capita",
              "mulheres_empregadas_ensino_medio_ou_mais_por_1000_mulheres", "renda_media",
              "vinculos_per_capita", "formalidade_mercado_trabalho", "geracao_emprego_per_capita"}
    lower = {"taxa_distorcao_fundamental", "exec_orc_corrente", "endividamento", "despesas_pessoal",
             "restos_a_pagar", "desmatamento_por_area", "emissao_gases_per_capita",
             "incidencia_coliformes", "indice_perdas_distribuicao",
             "obitos_causas_evitaveis_mil_habitantes", "proporcao_gravidez_adolescencia",
             "delitos_com_armas_por_10mil_hab", "furtos_por_10mil_hab",
             "homicidio_doloso_por_10mil_hab", "roubos_por_10mil_hab",
             "roubos_furtos_veiculos_por_10mil_veiculos", "estupro_por_10mil_mulheres",
             "ameaca_por_10mil_mulheres", "vulnerabilidade_social", "proporcao_pessoas_baixa_renda"}
    if iid in higher:
        return "higher_is_better"
    if iid in lower:
        return "lower_is_better"
    return "neutral"


def _indicator_unit(iid: str) -> str | None:
    units: dict[str, str] = {
        "adequacao_formacao_docente": "%", "saeb_ensino_fundamental": "pontos",
        "taxa_cobertura_creche": "%", "taxa_distorcao_fundamental": "%",
        "qt_acesso_infor": "%", "exec_orc_corrente": "%", "autonomia_fiscal": "%",
        "endividamento": "%", "despesas_pessoal": "%", "investimento": "%",
        "disponibilidade_caixa": "%", "geracao_de_caixa": "%", "restos_a_pagar": "%",
        "desmatamento_por_area": "%", "emissao_gases_per_capita": "MtCO₂",
        "incidencia_coliformes": "%", "indice_perdas_distribuicao": "%",
        "prop_atendimento_agua": "%", "prop_coleta_residuos": "%",
        "proporcao_consultas_pre_natal": "%", "proporcao_gravidez_adolescencia": "%",
        "cobertura_aps": "%", "cobertura_acs": "%",
        "cobertura_vacinal_penta_polio_media": "%", "formalidade_mercado_trabalho": "%",
        "vulnerabilidade_social": "%", "proporcao_pessoas_baixa_renda": "%",
        "pib_per_capita": "R$", "renda_media": "R$",
        "vinculos_per_capita": "vínculos/hab", "geracao_emprego_per_capita": "empregos/1.000 hab",
        "mulheres_empregadas_ensino_medio_ou_mais_por_1000_mulheres": "por mil mulheres",
        "medicos_por_mil_habitantes": "médicos/mil hab",
        "obitos_causas_evitaveis_mil_habitantes": "óbitos/mil hab",
        "delitos_com_armas_por_10mil_hab": "ocorrências/10 mil hab",
        "furtos_por_10mil_hab": "ocorrências/10 mil hab",
        "homicidio_doloso_por_10mil_hab": "ocorrências/10 mil hab",
        "roubos_por_10mil_hab": "ocorrências/10 mil hab",
        "roubos_furtos_veiculos_por_10mil_veiculos": "ocorrências/10 mil veíc.",
        "estupro_por_10mil_mulheres": "ocorrências/10 mil mulheres",
        "ameaca_por_10mil_mulheres": "ocorrências/10 mil mulheres",
    }
    return units.get(iid)


def _indicator_format(iid: str) -> str:
    unit = _indicator_unit(iid)
    if unit == "R$":
        return "currency"
    if unit == "pontos":
        return "number"
    if unit == "%":
        return "percent"
    return "number"


def _indicator_decimal(iid: str) -> int:
    if _indicator_format(iid) == "currency":
        return 2
    if iid == "vinculos_per_capita":
        return 2
    return 1


def _indicator_mult(iid: str) -> int:
    return {
        "qt_acesso_infor": 100,
        "formalidade_mercado_trabalho": 100,
        "geracao_emprego_per_capita": 1000,
    }.get(iid, 1)


# Indicadores por dimensao (ordem curada)
_INDICATOR_IDS: dict[str, list[str]] = {
    "educacao": ["adequacao_formacao_docente", "saeb_ensino_fundamental",
                  "taxa_cobertura_creche", "taxa_distorcao_fundamental", "qt_acesso_infor"],
    "financas": ["exec_orc_corrente", "autonomia_fiscal", "endividamento",
                  "despesas_pessoal", "investimento", "disponibilidade_caixa",
                  "geracao_de_caixa", "restos_a_pagar"],
    "meio_ambiente": ["desmatamento_por_area", "emissao_gases_per_capita",
                       "incidencia_coliformes", "indice_perdas_distribuicao",
                       "prop_atendimento_agua", "prop_coleta_residuos"],
    "saude": ["obitos_causas_evitaveis_mil_habitantes", "proporcao_consultas_pre_natal",
              "proporcao_gravidez_adolescencia", "medicos_por_mil_habitantes",
              "cobertura_aps", "cobertura_acs", "cobertura_vacinal_penta_polio_media"],
    "seguranca": ["delitos_com_armas_por_10mil_hab", "furtos_por_10mil_hab",
                  "homicidio_doloso_por_10mil_hab", "roubos_por_10mil_hab",
                  "roubos_furtos_veiculos_por_10mil_veiculos",
                  "estupro_por_10mil_mulheres", "ameaca_por_10mil_mulheres"],
    "socioeconomico": ["pib_per_capita", "mulheres_empregadas_ensino_medio_ou_mais_por_1000_mulheres",
                        "renda_media", "vinculos_per_capita", "formalidade_mercado_trabalho",
                        "geracao_emprego_per_capita", "vulnerabilidade_social",
                        "proporcao_pessoas_baixa_renda"],
}

_INDICATOR_SOURCE_YEAR_ALIASES: dict[str, tuple[str, ...]] = {
    "qt_acesso_infor": (
        "qtd_desktops_alunos",
        "qtd_computadores_portateis_alunos",
        "qtd_tablets_alunos",
    ),
}


def _load_indicator_data_years(results_dir: Path) -> dict[str, dict[int, int]]:
    """Le o ano-fonte real nos sufixos das colunas dos rankings oficiais."""
    indicator_ids = [iid for dim in DIMENSION_IDS for iid in _INDICATOR_IDS[dim]]
    result: dict[str, dict[int, int]] = {iid: {} for iid in indicator_ids}

    for reference_year in YEARS:
        ranking_file = results_dir / f"ranking_municipios_rs_{reference_year}.xlsx"
        if not ranking_file.is_file():
            raise FileNotFoundError(f"Arquivo de ranking nao encontrado: {ranking_file}")

        columns = [str(column) for column in pd.read_excel(ranking_file, nrows=0).columns]
        years_by_source: dict[str, set[int]] = {}
        for column in columns:
            match = re.fullmatch(r"(.+)_(\d{2})", column)
            if match is None:
                continue
            source_name, short_year = match.groups()
            years_by_source.setdefault(source_name, set()).add(2000 + int(short_year))

        for indicator_id in indicator_ids:
            source_names = _INDICATOR_SOURCE_YEAR_ALIASES.get(indicator_id, (indicator_id,))
            data_years = {
                data_year
                for source_name in source_names
                for data_year in years_by_source.get(source_name, set())
            }
            if len(data_years) != 1:
                raise RuntimeError(
                    f"{ranking_file.name}: ano-fonte de {indicator_id} ambiguo ou ausente: "
                    f"{sorted(data_years)}"
                )

            data_year = next(iter(data_years))
            if data_year > reference_year:
                raise RuntimeError(
                    f"{ranking_file.name}: ano-fonte futuro para {indicator_id}: {data_year}"
                )
            result[indicator_id][reference_year] = data_year

    return result


def _build_indicator_catalog(
    data_years_by_indicator: dict[str, dict[int, int]] | None = None,
) -> list[dict[str, Any]]:
    result = []
    for dim in DIMENSION_IDS:
        ord_base = list(_INDICATOR_IDS.keys()).index(dim) * 100
        for i, iid in enumerate(_INDICATOR_IDS.get(dim, [])):
            indicator = {
                "id": iid,
                "dimensionId": dim,
                "name": _indicator_name(iid),
                "shortName": _indicator_short(iid),
                "description": _indicator_desc(iid),
                "source": _indicator_source(iid),
                "unit": _indicator_unit(iid),
                "format": _indicator_format(iid),
                "decimalPlaces": _indicator_decimal(iid),
                "multiplier": _indicator_mult(iid),
                "direction": _indicator_direction(iid),
                "order": ord_base + i + 1,
            }
            data_years = (data_years_by_indicator or {}).get(iid, {})
            shifted_years = {
                str(reference_year): data_year
                for reference_year, data_year in sorted(data_years.items())
                if data_year != reference_year
            }
            if shifted_years:
                indicator["dataYearByReferenceYear"] = shifted_years
            result.append(indicator)
    return result


# ---------------------------------------------------------------------------
# Sync: indicadores staging vs metadata
# ---------------------------------------------------------------------------


def _sync_indicators(
    db_indicators: set[str],
    data_years_by_indicator: dict[str, dict[int, int]],
) -> list[dict[str, Any]]:
    catalog = _build_indicator_catalog(data_years_by_indicator)
    cat_ids = {i["id"] for i in catalog}
    missing_in_cat = db_indicators - cat_ids
    missing_in_db = cat_ids - db_indicators
    if missing_in_cat:
        raise RuntimeError(f"Indicadores no staging sem metadado curado: {sorted(missing_in_cat)}")
    if missing_in_db:
        raise RuntimeError(f"Metadados sem indicador correspondente no staging: {sorted(missing_in_db)}")
    return catalog


# ---------------------------------------------------------------------------
# Medianas regionais (calculadas em memoria)
# ---------------------------------------------------------------------------


def _calc_medians(dim_frames: dict[str, pd.DataFrame]) -> dict[tuple[int, str, str, str], dict[str, float | None]]:
    """Calcula mediana por (ano, regiao_funcional, dimensao, indicador)."""
    all_rows = []
    for dim, df in dim_frames.items():
        if df.empty:
            continue
        df2 = df.copy()
        df2["dimensao"] = dim
        all_rows.append(df2)
    if not all_rows:
        return {}
    combined = pd.concat(all_rows, ignore_index=True)

    groups = combined.groupby(
        ["ano", "regiao_funcional", "dimensao", "indicador"], dropna=False
    )
    result: dict[tuple[int, str, str, str], dict[str, float | None]] = {}
    for (ano, regiao, dimensao, indicador), grp in groups:
        result[(int(ano), str(regiao), str(dimensao), str(indicador))] = {
            "mediana_nota_indicador_regiao": _s(grp["nota_indicador"].median()),
            "mediana_valor_original_regiao": _s(grp["valor_original"].median()),
            "total_municipios_mediana": int(grp["id_municipio"].nunique()),
        }
    return result


def _calc_state_medians(
    dim_frames: dict[str, pd.DataFrame],
) -> dict[tuple[int, str, str], float | None]:
    """Calcula a mediana estadual por (ano, dimensao, indicador)."""
    result: dict[tuple[int, str, str], float | None] = {}
    for dim, frame in dim_frames.items():
        groups = frame.groupby(["ano", "indicador"], dropna=False)
        for (year, indicator), group in groups:
            result[(int(year), dim, str(indicator))] = _s(group["valor_original"].median())
    return result


def _attach_state_medians(
    indicator_catalog: list[dict[str, Any]],
    state_medians: dict[tuple[int, str, str], float | None],
    regional_medians: dict[tuple[int, str, str, str], dict[str, float | None]],
) -> None:
    """Publica as medianas estaduais e regionais no catalogo compacto."""
    for indicator in indicator_catalog:
        dimension_id = str(indicator["dimensionId"])
        indicator_id = str(indicator["id"])
        indicator["stateMedianOriginalValueByReferenceYear"] = {
            str(year): state_medians.get((year, dimension_id, indicator_id))
            for year in YEARS
        }
        indicator["regionalMedianOriginalValueByRegionAndReferenceYear"] = {
            region_id: {
                str(year): _s(
                    regional_medians
                    .get((year, region_id, dimension_id, indicator_id), {})
                    .get("mediana_valor_original_regiao")
                )
                for year in YEARS
            }
            for region_id in REGION_NAMES
        }


def _calc_dim_medians(dim_frames: dict[str, pd.DataFrame]) -> dict[tuple[int, str, str], dict[str, float | None]]:
    """Calcula mediana por (ano, regiao_funcional, dimensao) da nota_dimensao."""
    all_rows = []
    for dim, df in dim_frames.items():
        if df.empty:
            continue
        df2 = df.copy()
        df2["dimensao"] = dim
        all_rows.append(df2)
    if not all_rows:
        return {}
    combined = pd.concat(all_rows, ignore_index=True)

    groups = combined.groupby(["ano", "regiao_funcional", "dimensao"], dropna=False)
    result: dict[tuple[int, str, str], dict[str, float | None]] = {}
    for (ano, regiao, dimensao), grp in groups:
        result[(int(ano), str(regiao), str(dimensao))] = {
            "mediana_nota_dimensao_regiao": _s(grp["nota_dimensao"].median()),
        }
    return result


# ---------------------------------------------------------------------------
# Builders
# ---------------------------------------------------------------------------


def build_manifest(segments: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "activeDataVersion": DATA_VERSION,
        "generatedAt": GENERATED_AT,
        "defaultYear": DEFAULT_YEAR,
        "availableYears": YEARS,
        "yearRange": {"start": YEARS[0], "end": YEARS[-1]},
        "totals": {
            "municipalities": segments["total_municipios"],
            "regions": len(segments["region_ids"]),
            "coredes": len(segments["corede_ids"]),
        },
        "files": {
            "catalog": "catalog.json",
            "regionsPattern": "regions/{year}.json",
            "regionalRankingPattern": "rankings/{year}/{region}.json",
            "municipalitySummaryPattern": "municipalities/{municipalityId}/summary.json",
            "municipalityDimensionPattern": "municipalities/{municipalityId}/{dimension}.json",
        },
    }


def build_catalog(
    ranking_2025: pd.DataFrame,
    segments: dict[str, Any],
    indicator_catalog: list[dict[str, Any]],
    municipal_profile: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    region_ids_sorted = sorted(segments["region_ids"], key=lambda r: int(r[2:]))
    regions_cat = [
        {"id": rid, "slug": rid.lower(), "name": REGION_NAMES.get(rid, rid), "order": int(rid[2:])}
        for rid in region_ids_sorted
    ]

    corede_info: dict[str, tuple[str, str]] = {}
    for _, r in ranking_2025.iterrows():
        cname = str(r["corede"]).strip()
        rid = str(r["regiao_funcional"]).strip()
        slug = _slugify(cname)
        if slug not in corede_info:
            corede_info[slug] = (rid, cname)

    coredes_cat = [
        {"id": slug, "name": name, "regionId": rid}
        for slug, (rid, name) in sorted(corede_info.items(), key=lambda x: (x[1][0], x[1][1]))
    ]

    municipalities_cat = []
    for _, r in ranking_2025.iterrows():
        mid = str(int(r["id_municipio"]))
        mname = str(r["municipio"]).strip()
        rid = str(r["regiao_funcional"]).strip()
        cname = str(r["corede"]).strip()
        population_by_year = {
            str(entry["year"]): entry["value"]
            for entry in municipal_profile.get(int(mid), {}).get("populationEstimates", [])
            if int(entry["year"]) in YEARS
        }
        municipalities_cat.append({
            "id": mid,
            "name": mname,
            "searchName": _norm_name(mname),
            "regionId": rid,
            "coredeId": _slugify(cname),
            "populationByYear": population_by_year,
        })

    dimensions_cat = [
        {"id": dim, "name": DIMENSION_LABELS[dim], "order": i + 1}
        for i, dim in enumerate(DIMENSION_IDS)
    ]

    return {
        "regions": regions_cat,
        "coredes": coredes_cat,
        "municipalities": municipalities_cat,
        "dimensions": dimensions_cat,
        "indicators": indicator_catalog,
    }


def build_regions_year(ranking_year: pd.DataFrame, year: int) -> dict[str, Any]:
    regions_list = []
    for rid in sorted(ranking_year["regiao_funcional"].unique(), key=lambda x: int(x[2:])):
        rf = ranking_year[ranking_year["regiao_funcional"] == rid]
        mids = rf["id_municipio"].nunique()
        coredes_in_region = sorted(rf["corede"].str.strip().unique())
        avg_score = _s(rf["nota_final"].mean())

        regions_list.append({
            "id": rid,
            "name": REGION_NAMES.get(rid, rid),
            "order": int(rid[2:]),
            "municipalityCount": mids,
            "coredeCount": len(coredes_in_region),
            "coredeIds": [_slugify(c) for c in coredes_in_region],
            "coredeNames": [c for c in coredes_in_region],
            "averageFinalScore": avg_score,
        })

    return {
        "year": year,
        "totals": {
            "municipalities": ranking_year["id_municipio"].nunique(),
            "regions": len(regions_list),
            "coredes": ranking_year["corede"].str.strip().nunique(),
        },
        "regions": regions_list,
    }


def build_ranking_rf(
    ranking_year: pd.DataFrame,
    reg_rf: pd.DataFrame,
    region_id: str,
    classification_year: pd.DataFrame,
    dimension_rank_lookup: dict[tuple[int, int, str], int | None],
    year: int,
) -> dict[str, Any]:
    rf_rows = ranking_year[ranking_year["regiao_funcional"] == region_id].copy()
    rf_rows = rf_rows.sort_values("ranking_regiao_funcional")

    # Previous year ranks.
    ranking_previous = reg_rf[reg_rf["ano"] == year - 1]
    prev_map = {}
    for _, r in ranking_previous.iterrows():
        prev_map[int(r["id_municipio"])] = int(r["ranking_regiao_funcional"])

    class_map = {}
    if not classification_year.empty:
        for _, r in classification_year.iterrows():
            class_map[int(r["id_municipio"])] = str(r.get("classificacao", ""))

    entries = []
    for _, row in rf_rows.iterrows():
        mid = int(row["id_municipio"])
        rank = _si(row["ranking_regiao_funcional"])
        prev_rank = prev_map.get(mid)
        classification = _classification_code(class_map.get(mid))

        dim_ranks = _empty_dim_map()
        for d, js_key in _JS_DIM_MAP.items():
            dim_ranks[js_key] = dimension_rank_lookup.get((mid, year, d))

        entries.append({
            "municipalityId": str(mid),
            "municipalityName": str(row["municipio"]).strip(),
            "coredeId": _slugify(str(row["corede"]).strip()),
            "coredeName": str(row["corede"]).strip(),
            "overallRank": rank,
            "previousOverallRank": prev_rank,
            "rankChange": (prev_rank - rank) if prev_rank is not None and rank is not None else None,
            "populationPerformance": classification,
            "finalScore": _s(row["nota_final"]),
            "dimensionRanks": {k: v for k, v in dim_ranks.items()},
        })

    return {
        "year": year,
        "regionId": region_id,
        "regionName": REGION_NAMES.get(region_id, region_id),
        "municipalityCount": len(entries),
        "municipalities": entries,
    }


def build_municipality_summary(
    mun_id: int,
    ranking_all: pd.DataFrame,
    classification_all: pd.DataFrame,
    dimension_rank_lookup: dict[tuple[int, int, str], int | None],
    municipal_profile: dict[int, dict[str, Any]],
) -> dict[str, Any]:
    mun_rows = ranking_all[ranking_all["id_municipio"] == mun_id].sort_values("ano")

    if mun_rows.empty:
        raise RuntimeError(f"Municipio {mun_id} nao encontrado")

    last = mun_rows.iloc[-1]
    region_id = str(last["regiao_funcional"])

    class_map = {}
    for _, r in classification_all.iterrows():
        class_map[(int(r["id_municipio"]), int(r["ano"]))] = str(r.get("classificacao", ""))

    sum_rows_prev: dict[int, int | None] = {}
    for _, r in mun_rows.iterrows():
        yr = int(r["ano"])
        rf = ranking_all[(ranking_all["regiao_funcional"] == region_id) & (ranking_all["ano"] == yr)]
        prev_rf = ranking_all[(ranking_all["regiao_funcional"] == region_id) & (ranking_all["ano"] == yr - 1)]
        prev_mun = prev_rf[prev_rf["id_municipio"] == mun_id]
        sum_rows_prev[yr] = _si(prev_mun.iloc[0]["ranking_regiao_funcional"]) if not prev_mun.empty else None

    yearly = []
    for _, row in mun_rows.iterrows():
        yr = int(row["ano"])
        rank = _si(row["ranking_regiao_funcional"])
        prev_rank = sum_rows_prev.get(yr)
        total_reg = _si(row.get("total_municipios_regiao"))
        if total_reg is None:
            rf = ranking_all[(ranking_all["regiao_funcional"] == region_id) & (ranking_all["ano"] == yr)]
            total_reg = int(rf["id_municipio"].nunique())

        cl = class_map.get((mun_id, yr), "")
        class_info = _classification_code(cl if cl else "")

        dim_scores = _empty_dim_map()
        dim_ranks = _empty_dim_map()
        for d, js_key in _JS_DIM_MAP.items():
            dim_scores[js_key] = _s(row.get(f"nota_{d}"))
            dim_ranks[js_key] = dimension_rank_lookup.get((mun_id, yr, d))

        yearly.append({
            "year": yr,
            "overallRank": rank,
            "previousOverallRank": prev_rank,
            "rankChange": (prev_rank - rank) if prev_rank is not None and rank is not None else None,
            "totalMunicipalitiesInRegion": total_reg,
            "classification": class_info,
            "finalScore": _s(row["nota_final"]),
            "dimensionScores": {k: v for k, v in dim_scores.items()},
            "dimensionRanks": {k: v for k, v in dim_ranks.items()},
        })

    dim_history = []
    for dim in DIMENSION_IDS:
        values = []
        for _, row in mun_rows.iterrows():
            yr = int(row["ano"])
            rf = ranking_all[(ranking_all["regiao_funcional"] == region_id) & (ranking_all["ano"] == yr)]
            total_reg = int(rf["id_municipio"].nunique())
            values.append({
                "year": yr,
                "score": _s(row.get(f"nota_{dim}")),
                "rank": dimension_rank_lookup.get((mun_id, yr, dim)),
                "totalMunicipalitiesInRegion": total_reg,
            })
        dim_history.append({"dimensionId": dim, "values": values})

    return {
        "municipality": {
            "id": str(mun_id),
            "name": str(last["municipio"]).strip(),
            "regionId": region_id,
            "regionName": REGION_NAMES.get(region_id, region_id),
            "coredeId": _slugify(str(last["corede"]).strip()),
            "coredeName": str(last["corede"]).strip(),
        },
        "availableYears": sorted(mun_rows["ano"].unique().tolist()),
        "latestYear": DEFAULT_YEAR,
        "municipalProfile": municipal_profile.get(mun_id, {
            "populationEstimates": [],
            "gdpValues": [],
            "areaKm2": None,
        }),
        "yearlySummaries": yearly,
        "dimensionHistory": dim_history,
    }


def build_dimension_file(
    mun_id: int,
    dim: str,
    dim_frame: pd.DataFrame,
    ranking_all: pd.DataFrame,
    medians: dict[tuple[int, str, str, str], dict[str, float | None]],
) -> dict[str, Any]:
    mun_rows = dim_frame[dim_frame["id_municipio"] == mun_id].sort_values(["ano", "indicador"])

    region_id = str(ranking_all[ranking_all["id_municipio"] == mun_id].iloc[-1]["regiao_funcional"])

    dim_history = []
    for yr in YEARS:
        rf = ranking_all[(ranking_all["regiao_funcional"] == region_id) & (ranking_all["ano"] == yr)]
        total_reg = int(rf["id_municipio"].nunique())

        yr_rows = mun_rows[mun_rows["ano"] == yr]
        if not yr_rows.empty:
            score = _s(yr_rows.iloc[0]["nota_dimensao"])
            rank = _si(yr_rows.iloc[0]["ranking_dimensao"])
        else:
            score = None
            rank = None
        dim_history.append({
            "year": yr,
            "score": score,
            "rank": rank,
            "totalMunicipalitiesInRegion": total_reg,
        })

    indicator_series = []
    for iid in _INDICATOR_IDS.get(dim, []):
        rows = mun_rows[mun_rows["indicador"] == iid].sort_values("ano")
        values = []
        for _, row in rows.iterrows():
            yr = int(row["ano"])
            md = medians.get((yr, region_id, dim, iid), {})
            values.append({
                "year": yr,
                "score": _s(row.get("nota_indicador")),
                "rank": _si(row.get("ranking_indicador")),
                "untiedRank": None,  # nao temos no staging
                "originalValue": _s(row.get("valor_original")),
                "valueUsedForScore": _s(row.get("valor_usado_nota")),
                "isImputed": _norm_bool(row.get("valor_imputado")),
                "regionalMedianScore": _s(md.get("mediana_nota_indicador_regiao")),
                "regionalMedianOriginalValue": _s(md.get("mediana_valor_original_regiao")),
                "regionalMedianSampleSize": _si(md.get("total_municipios_mediana")),
            })
        indicator_series.append({"indicatorId": iid, "values": values})

    return {
        "municipalityId": str(mun_id),
        "municipalityName": str(ranking_all[ranking_all["id_municipio"] == mun_id].iloc[-1]["municipio"]).strip(),
        "regionId": region_id,
        "regionName": REGION_NAMES.get(region_id, region_id),
        "corede": str(ranking_all[ranking_all["id_municipio"] == mun_id].iloc[-1]["corede"]).strip(),
        "dimensionId": dim,
        "dimensionName": DIMENSION_LABELS[dim],
        "availableYears": YEARS,
        "dimensionHistory": dim_history,
        "indicators": indicator_series,
    }


# ---------------------------------------------------------------------------
# Serializacao
# ---------------------------------------------------------------------------


def _envelope(data: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "dataVersion": DATA_VERSION,
        "generatedAt": GENERATED_AT,
        "data": data,
    }


def _write_json(path: Path, content: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(content, f, ensure_ascii=False, indent=2, allow_nan=False)
        f.write("\n")


def _read_json(path: Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Validacao
# ---------------------------------------------------------------------------


class ValidationError(RuntimeError):
    pass


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        raise ValidationError(msg)


_BANNED = ("", "-", "\u2014", "N/A", "n/a", "null", "NULL", "nan", "NaN", "None", "none")


def _check_banned(value: Any, path: str = "") -> None:
    if isinstance(value, dict):
        for k, v in value.items():
            _check_banned(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _check_banned(v, f"{path}[{i}]")
    elif isinstance(value, str):
        _assert(value not in _BANNED, f"{path}: sentinela {value!r}")


def _check_nan(value: Any, path: str = "") -> None:
    if isinstance(value, dict):
        for k, v in value.items():
            _check_nan(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _check_nan(v, f"{path}[{i}]")
    elif isinstance(value, float):
        _assert(not math.isnan(value), f"NaN em {path}")


def validate_output(manifest: dict[str, Any], catalog: dict[str, Any],
                    regions_data: dict[str, Any],
                    rankings: dict[str, dict[str, Any]],
                    municipio_summaries: dict[int, dict[str, Any]],
                    municipio_dimensions: dict[int, dict[str, dict[str, Any]]]) -> None:
    print("  Validando saida...")
    _assert(manifest["activeDataVersion"] == DATA_VERSION, "manifest.activeDataVersion")
    _assert(manifest["defaultYear"] == DEFAULT_YEAR, "manifest.defaultYear")
    _assert(len(manifest["availableYears"]) == 5, "manifest.availableYears")

    _assert(len(catalog["regions"]) == 9, "catalog: 9 regioes")
    _assert(len(catalog["coredes"]) == 28, "catalog: 28 Coredes")
    _assert(len(catalog["municipalities"]) == 497, "catalog: 497 municipios")
    for municipality in catalog["municipalities"]:
        _assert(
            set(municipality["populationByYear"]) == {str(year) for year in YEARS},
            f"catalog: populacao incompleta para {municipality['id']}",
        )
    _assert(len(catalog["dimensions"]) == 6, "catalog: 6 dimensoes")
    _assert(len(catalog["indicators"]) == 41, f"catalog: 41 indicadores ({len(catalog['indicators'])})")
    for indicator in catalog["indicators"]:
        for reference_year, data_year in indicator.get("dataYearByReferenceYear", {}).items():
            _assert(int(reference_year) in YEARS, f"{indicator['id']}: ano de referencia invalido")
            _assert(data_year < int(reference_year), f"{indicator['id']}: ano-fonte nao defasado")

    _assert(len(regions_data["regions"]) == 9, "regions: 9 regioes")
    _assert(regions_data["totals"]["municipalities"] == 497, "regions: 497 municipios")

    _assert(len(rankings) == 9, "rankings: 9 regionais")
    total_mun = sum(r["municipalityCount"] for r in rankings.values())
    _assert(total_mun == 497, f"rankings: total municipios = {total_mun}")

    # Validar totais municipais
    n_summaries = len(municipio_summaries)
    n_dims = sum(len(d) for d in municipio_dimensions.values())
    _assert(n_summaries == 497, f"summaries: {n_summaries} (esperado 497)")
    _assert(n_dims == 497 * 6, f"dimensionais: {n_dims} (esperado {497 * 6})")

    # Cada municipio do ranking deve ter detalhe
    cat_ids = {m["id"] for m in catalog["municipalities"]}
    detail_ids = {str(mid) for mid in municipio_summaries}
    _assert(cat_ids == detail_ids, "IDs do catalog batem com IDs dos detalhes municipais")

    # Cada municipio tem 6 dimensoes
    for mid, dims in municipio_dimensions.items():
        _assert(len(dims) == 6, f"municipio {mid}: {len(dims)} dimensoes (esperado 6)")

    # Ranking regional, summary e arquivos dimensionais devem concordar.
    for rid, regional in rankings.items():
        for entry in regional["municipalities"]:
            mid = int(entry["municipalityId"])
            summary = municipio_summaries[mid]
            latest = next(row for row in summary["yearlySummaries"] if row["year"] == DEFAULT_YEAR)
            for dim, js_key in _JS_DIM_MAP.items():
                dimensional = municipio_dimensions[mid][dim]
                dim_2025 = next(row for row in dimensional["dimensionHistory"] if row["year"] == DEFAULT_YEAR)
                expected_rank = dim_2025["rank"]
                _assert(
                    entry["dimensionRanks"][js_key] == expected_rank,
                    f"{rid}/{mid}/{dim}: ranking regional diverge do dimensional",
                )
                _assert(
                    latest["dimensionRanks"][js_key] == expected_rank,
                    f"{rid}/{mid}/{dim}: summary diverge do dimensional",
                )

    # Validar Picada Cafe (4314423)
    print("  [Picada Cafe] validando...")
    pc = municipio_summaries.get(4314423)
    _assert(pc is not None, "Picada Cafe: summary existe")
    _assert(pc["municipality"]["id"] == "4314423", "Picada Cafe: ID")
    _assert(pc["municipality"]["name"] == "Picada Café", "Picada Cafe: nome")
    _assert(pc["municipality"]["regionId"] == "RF3", "Picada Cafe: RF3")
    _assert("Hort" in pc["municipality"]["coredeName"], "Picada Cafe: corede Hortensias")
    _assert(len(pc["yearlySummaries"]) == 5, f"Picada Cafe: {len(pc['yearlySummaries'])} anos (esperado 5)")
    _assert(len(pc["dimensionHistory"]) == 6, f"Picada Cafe: {len(pc['dimensionHistory'])} dimensoes (esperado 6)")

    pc_profile = pc.get("municipalProfile", {})
    _assert(pc_profile.get("areaKm2") is not None, "Picada Cafe: area no perfil municipal")
    _assert(len(pc_profile.get("populationEstimates", [])) >= 5, "Picada Cafe: populacao no perfil municipal")
    _assert(len(pc_profile.get("gdpValues", [])) >= 1, "Picada Cafe: PIB no perfil municipal")

    pc_dims = municipio_dimensions.get(4314423, {})
    _assert(len(pc_dims) == 6, f"Picada Cafe: {len(pc_dims)} dims (esperado 6)")
    for dim in DIMENSION_IDS:
        _assert(dim in pc_dims, f"Picada Cafe: dimensao {dim} existe")
        _assert(len(pc_dims[dim]["dimensionHistory"]) == 5, f"Picada Cafe {dim}: 5 anos de historico")

    total_pc_obs = sum(
        len(ind["values"])
        for f in pc_dims.values()
        for ind in f["indicators"]
    )
    _assert(total_pc_obs == 41 * 5, f"Picada Cafe: {total_pc_obs} obs (esperado {41 * 5})")

    # Ranking 2025 Picada Cafe = 2/49
    rf3_ranking = rankings.get("RF3", {})
    rf3_muns = [m for m in rf3_ranking.get("municipalities", []) if m["municipalityId"] == "4314423"]
    _assert(len(rf3_muns) == 1, "Picada Cafe no ranking RF3")
    _assert(rf3_muns[0]["overallRank"] == 2, f"Picada Cafe rank: {rf3_muns[0]['overallRank']} (esperado 2)")
    _assert(rf3_ranking["municipalityCount"] == 49, f"RF3: {rf3_ranking['municipalityCount']} municipios (esperado 49)")

    # Historico geral: 1, 1, 6, 1, 2
    ranks = [ys["overallRank"] for ys in pc["yearlySummaries"]]
    expected_ranks = [1, 1, 6, 1, 2]
    _assert(ranks == expected_ranks, f"Picada Cafe historico: {ranks} (esperado {expected_ranks})")

    print("  [Picada Cafe] OK")

    # Validacao cruzada: 1 municipio de cada RF1, RF2, RF9
    print("  [Validacao cruzada] RF1, RF2, RF9...")
    cross_ids: dict[str, int] = {}
    for rid_target in ["RF1", "RF2", "RF9"]:
        ranking_muns = rankings.get(rid_target, {}).get("municipalities", [])
        if ranking_muns:
            cross_ids[rid_target] = int(ranking_muns[0]["municipalityId"])

    for rid, mid in cross_ids.items():
        sm = municipio_summaries.get(mid)
        _assert(sm is not None, f"{rid}: summary de {mid} existe")
        _assert(sm["municipality"]["regionId"] == rid, f"{rid}: municipio {mid} pertence a {rid} (nao {sm['municipality']['regionId']})")
        _assert(len(sm["yearlySummaries"]) >= 1, f"{rid}/{mid}: historico geral existe")
        dims = municipio_dimensions.get(mid, {})
        _assert(len(dims) == 6, f"{rid}/{mid}: {len(dims)} dimensoes (esperado 6)")
        for dim in DIMENSION_IDS:
            _assert(dim in dims, f"{rid}/{mid}: dimensao {dim} existe")
            _assert(len(dims[dim]["indicators"]) > 0, f"{rid}/{mid}/{dim}: indicadores carregam")
        cat_match = [m for m in catalog["municipalities"] if m["id"] == str(mid)]
        _assert(len(cat_match) == 1, f"{rid}/{mid}: presente no catalog")
        _assert(cat_match[0]["regionId"] == rid, f"{rid}/{mid}: catalog RF bate")
        _assert(cat_match[0]["coredeId"] == sm["municipality"]["coredeId"], f"{rid}/{mid}: catalog corede bate com summary")
        print(f"    {rid}: {sm['municipality']['name']} ({mid}) OK")
    print("  [Validacao cruzada] OK")

    # Verificar NaN/Infinity/sentinelas nos JSONs gerados via releitura
    print("  Verificando NaN e sentinelas nos arquivos...")

    def _check_mem_data(data: dict[str, Any], label: str) -> None:
        json_str = json.dumps(data, ensure_ascii=False, allow_nan=False)
        reloaded = json.loads(json_str)
        _check_banned(reloaded, label)
        _check_nan(reloaded, label)

    _check_mem_data(manifest, "manifest")
    _check_mem_data(_envelope(catalog), "catalog")
    _check_mem_data(_envelope(regions_data), "regions")
    for rid, r in rankings.items():
        _check_mem_data(_envelope(r), f"rankings/{rid}")
    for mid, sm in municipio_summaries.items():
        _check_mem_data(_envelope(sm), f"municipality/{mid}/summary")
    for mid, dims in municipio_dimensions.items():
        for dim, content in dims.items():
            _check_mem_data(_envelope(content), f"municipality/{mid}/{dim}")

    print("  [OK] Nenhum NaN, Infinity ou sentinela encontrado.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Exportador estatico — staging local")
    parser.add_argument("--schema", default="staging_2025",
                        help="Schema PostgreSQL (padrao: staging_2025)")
    parser.add_argument(
        "--ranking-results-dir",
        type=Path,
        default=RANKING_RESULTS_DIR,
        help="Pasta com ranking_municipios_rs_YYYY.xlsx usados para recuperar o ano-fonte",
    )
    args = parser.parse_args()

    schema = args.schema

    # Validar schema
    if not _STAGING_PATTERN.match(schema):
        print(f"[FAIL] Schema '{schema}' fora do padrao staging_YYYY")
        return 1
    if schema == "public":
        print("[FAIL] public nao pode ser fonte do exportador")
        return 1

    # Confingurar ambiente DB
    for var in ["DB_USUARIO", "DB_SENHA"]:
        if not os.environ.get(var):
            print(f"[FAIL] Variavel {var} nao definida")
            return 1

    engine = _get_engine(schema)

    print(f"Exportador estatico — schema: {schema}")
    print(f"Destino: {OUTPUT_DIR}")
    print()

    # Ler tabelas base
    print("Lendo tabelas do staging...")
    ranking_all = _read_table(engine, schema, "ranking_municipios")
    dim_frames = {}
    for d in DIMENSION_IDS:
        table = f"base_{d}"
        dim_frames[d] = _read_table(engine, schema, table)
        print(f"  base_{d}: {len(dim_frames[d])} linhas")

    regressao = _read_table(engine, schema, "regressao_rf_previsoes")
    pesos_pca = _read_table(engine, schema, "pesos_dimensoes_pca")
    print(f"  regressao_rf_previsoes: {len(regressao)} linhas")
    print(f"  pesos_dimensoes_pca: {len(pesos_pca)} linhas")
    print()

    print("Lendo contexto municipal complementar...")
    municipal_profile = _read_municipal_profile(engine)
    print(f"  contexto municipal: {len(municipal_profile)} municipios")
    print()

    # Validar indicadores
    all_db_indicators = set()
    for d, df in dim_frames.items():
        for iid in df["indicador"].dropna().unique():
            all_db_indicators.add(str(iid))
    print("Lendo anos-fonte dos indicadores...")
    indicator_data_years = _load_indicator_data_years(args.ranking_results_dir)
    indicator_catalog = _sync_indicators(all_db_indicators, indicator_data_years)
    print(f"[OK] {len(indicator_catalog)} indicadores sincronizados com staging")

    # Segmentos
    ranking_2025 = ranking_all[ranking_all["ano"] == DEFAULT_YEAR]
    region_ids = sorted(ranking_2025["regiao_funcional"].unique(), key=lambda x: int(x[2:]))
    corede_ids = sorted(ranking_2025["corede"].str.strip().unique())
    total_municipios = ranking_2025["id_municipio"].nunique()

    segments = {
        "region_ids": region_ids,
        "corede_ids": sorted(list({_slugify(c) for c in corede_ids})),
        "total_municipios": total_municipios,
    }

    # Calcular medianas em memoria
    print("Calculando medianas regionais...")
    medians = _calc_medians(dim_frames)
    print(f"  {len(medians)} grupos de mediana calculados")

    print("Calculando medianas estaduais...")
    state_medians = _calc_state_medians(dim_frames)
    _attach_state_medians(indicator_catalog, state_medians, medians)
    print(f"  {len(state_medians)} grupos de mediana estadual calculados")

    print("Indexando rankings dimensionais...")
    dimension_rank_lookup = _build_dimension_rank_lookup(dim_frames)
    print(f"  {len(dimension_rank_lookup)} rankings dimensionais indexados")

    # Construir catalog
    print("Construindo catalog...")
    catalog = build_catalog(ranking_2025, segments, indicator_catalog, municipal_profile)

    # Construir regions e rankings RF1-RF9 para todos os anos publicados.
    print("Construindo regions e rankings regionais...")
    regions_by_year = {}
    rankings_by_year = {}
    for year in YEARS:
        ranking_year = ranking_all[ranking_all["ano"] == year]
        classification_year = regressao[regressao["ano"] == year]
        regions_by_year[year] = build_regions_year(ranking_year, year)
        rankings_by_year[year] = {}
        for rid in region_ids:
            rankings_by_year[year][rid] = build_ranking_rf(
                ranking_year,
                ranking_all,
                rid,
                classification_year,
                dimension_rank_lookup,
                year,
            )

    # Construir manifest
    manifest = build_manifest(segments)

    # Construir todos os municipios
    print("Construindo detalhes municipais...")
    municipio_ids = sorted(ranking_2025["id_municipio"].unique())
    municipio_summaries: dict[int, dict[str, Any]] = OrderedDict()
    municipio_dimensions: dict[int, dict[str, dict[str, Any]]] = OrderedDict()

    for i, mid in enumerate(municipio_ids):
        mid_int = int(mid)
        municipio_summaries[mid_int] = build_municipality_summary(
            mid_int,
            ranking_all,
            regressao,
            dimension_rank_lookup,
            municipal_profile,
        )
        municipio_dimensions[mid_int] = OrderedDict()
        for dim in DIMENSION_IDS:
            municipio_dimensions[mid_int][dim] = build_dimension_file(
                mid_int, dim, dim_frames[dim], ranking_all, medians
            )
        if (i + 1) % 50 == 0 or (i + 1) == len(municipio_ids):
            print(f"  {i + 1}/{len(municipio_ids)} municipios...")

    print(f"  [OK] {len(municipio_summaries)} summaries, {sum(len(d) for d in municipio_dimensions.values())} dimensionais")

    # Escrever em diretorio temporario
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        tmp_v2025 = tmp / DATA_VERSION

        print()
        print("Escrevendo JSONs em temp...")

        _write_json(tmp_v2025 / "catalog.json", _envelope(catalog))
        for year, regions_data in regions_by_year.items():
            _write_json(tmp_v2025 / "regions" / f"{year}.json", _envelope(regions_data))

        for year, rankings in rankings_by_year.items():
            for rid, ranking in rankings.items():
                rf = rid.lower()
                _write_json(tmp_v2025 / "rankings" / str(year) / f"{rf}.json", _envelope(ranking))

        for mid_int, summary in municipio_summaries.items():
            mun_dir = tmp_v2025 / "municipalities" / str(mid_int)
            _write_json(mun_dir / "summary.json", _envelope(summary))
            for dim in DIMENSION_IDS:
                _write_json(mun_dir / f"{dim}.json", _envelope(municipio_dimensions[mid_int][dim]))

        # Manifest raiz (sem envelope)
        _write_json(tmp / "manifest.json", manifest)

        print(f"  catalog.json")
        for year in YEARS:
            print(f"  regions/{year}.json")
        for year in YEARS:
            for rid in region_ids:
                print(f"  rankings/{year}/{rid.lower()}.json")
        print(f"  {len(municipio_summaries)} municipios escritos")
        print(f"  manifest.json")
        print()

        # Validar tudo (sobre arquivos em temp)
        print("Validando JSONs...")
        validate_output(
            manifest,
            catalog,
            regions_by_year[DEFAULT_YEAR],
            rankings_by_year[DEFAULT_YEAR],
            municipio_summaries,
            municipio_dimensions,
        )

        # Publicar
        print()
        print("Publicando em public/data/v2025...")
        if OUTPUT_DIR.exists():
            shutil.rmtree(OUTPUT_DIR)

        # Copiar conteudo de v2025
        dest = PUBLIC_DATA
        tmp_manifest = tmp / "manifest.json"
        shutil.copy2(tmp_manifest, dest / "manifest.json")
        print(f"  {dest / 'manifest.json'}")

        tmp_v = tmp / DATA_VERSION
        shutil.copytree(tmp_v, OUTPUT_DIR)
        print(f"  {OUTPUT_DIR}")

    n_summaries = len(municipio_summaries)
    n_dims = sum(len(d) for d in municipio_dimensions.values())
    n_total = n_summaries + n_dims

    print()
    print("=" * 60)
    print("EXPORTACAO CONCLUIDA")
    print("=" * 60)
    print()
    print("Arquivos gerados:")
    print(f"  manifest.json")
    print(f"  v2025/catalog.json")
    for year in YEARS:
        print(f"  v2025/regions/{year}.json")
    for year in YEARS:
        for rid in region_ids:
            print(f"  v2025/rankings/{year}/{rid.lower()}.json")
    print(f"  v2025/municipalities/ — {len(municipio_summaries)} diretorios")
    print(f"     {n_summaries} summaries")
    print(f"     {n_dims} arquivos dimensionais")
    print(f"     {n_total} arquivos municipais no total")
    print()
    print(f"  Total geral: 1 + 1 + 1 + 9 + {n_total} = {12 + n_total} JSONs")
    print()
    print("Fontes lidas:")
    print(f"  Rankings oficiais: {args.ranking_results_dir}")
    print(f"  staging_2025.ranking_municipios: {len(ranking_all)} linhas")
    for d in DIMENSION_IDS:
        print(f"  staging_2025.base_{d}: {len(dim_frames[d])} linhas")
    print(f"  staging_2025.regressao_rf_previsoes: {len(regressao)} linhas")
    print()
    print("Confirmacoes:")
    print("  Supabase: NAO usado")
    print("  DDL/DML: NAO executado")
    print("  Banco: NAO alterado (somente SELECT)")
    print("  UI React: NAO alterada pelo exportador")
    print("  public/data/v2025: atualizado apos validacao")
    print("  497 municipios em 2025: OK")
    print("  9 regioes funcionais: OK")
    print("  28 Coredes: OK")
    print("  6 dimensoes: OK")
    print("  41 indicadores: OK")
    print("  Picada Cafe (4314423): OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
