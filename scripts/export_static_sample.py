#!/usr/bin/env python3
"""
Exportador estatico Fase 1.5 — fonte canonica: Supabase/PostgREST.

Extrai dados reais de Picada Cafe (IBGE 4314423) / RF3 via API PostgREST,
sem dependencias externas (urllib.request, json padrao).

Uso:
    set SUPABASE_URL=https://...supabase.co
    set SUPABASE_SERVICE_KEY=<key>
    python scripts/export_static_sample.py

Se as credenciais nao estiverem definidas, o script aborta sem gerar JSONs.
O frontend React NAO acessa Supabase.
"""

from __future__ import annotations

import json
import math
import os
import re
import shutil
import unicodedata
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# ---------------------------------------------------------------------------
# Caminhos
# ---------------------------------------------------------------------------

PUBLIC_DATA_DIR = Path(__file__).resolve().parent.parent / "public" / "data"
DATA_VERSION = "v2025-sample"
SAMPLE_DIR = PUBLIC_DATA_DIR / DATA_VERSION

# ---------------------------------------------------------------------------
# Constantes do contrato
# ---------------------------------------------------------------------------

SCHEMA_VERSION = "1.0.0"
SAMPLE_YEAR = 2025
GENERATED_AT = datetime(2026, 6, 30, 12, 0, 0, tzinfo=timezone.utc).strftime(
    "%Y-%m-%dT%H:%M:%SZ"
)

PICADA_CAFE_ID = "4314423"
PICADA_CAFE_NAME = "Picada Café"
PICADA_CAFE_REGION_ID = "RF3"
PICADA_CAFE_COREDE_ID = "hortensias"
PICADA_CAFE_COREDE_NAME = "Hortênsias"

REGION_NAMES = {
    "RF1": "Região Funcional 1", "RF2": "Região Funcional 2",
    "RF3": "Região Funcional 3", "RF4": "Região Funcional 4",
    "RF5": "Região Funcional 5", "RF6": "Região Funcional 6",
    "RF7": "Região Funcional 7", "RF8": "Região Funcional 8",
    "RF9": "Região Funcional 9",
}

DIMENSION_IDS = ("educacao","financas","meio_ambiente","saude","seguranca","socioeconomico")
DIMENSION_LABELS = {
    "educacao": "Educação", "financas": "Finanças", "meio_ambiente": "Meio ambiente",
    "saude": "Saúde", "seguranca": "Segurança", "socioeconomico": "Socioeconômico",
}
DIMENSION_DB_MAP = dict(zip(DIMENSION_IDS, DIMENSION_IDS))

MAX_PAGE_SIZE = 1000

# ---------------------------------------------------------------------------
# PostgREST client
# ---------------------------------------------------------------------------


class SupabaseClient:
    """Cliente PostgREST usando urlib.request + paginacao Range."""

    def __init__(self) -> None:
        self.base_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
        self.key = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY", "")
        if not self.base_url or not self.key:
            raise RuntimeError(
                "Variaveis SUPABASE_URL e SUPABASE_SERVICE_KEY (ou SUPABASE_KEY) "
                "obrigatorias. Defina-as antes de executar."
            )
        self._headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def _request(self, url: str) -> bytes:
        req = Request(url, headers=self._headers, method="GET")
        try:
            resp = urlopen(req, timeout=30)
        except HTTPError as exc:
            status = exc.code
            if status == 401:
                raise RuntimeError("Supabase 401 — chave invalida ou sem permissao")
            if status == 403:
                raise RuntimeError("Supabase 403 — acesso proibido a tabela")
            if status == 404:
                raise RuntimeError(f"Supabase 404 — tabela/rota nao encontrada: {exc.url}")
            raise RuntimeError(f"Supabase HTTP {status}: {exc}")
        except URLError as exc:
            raise RuntimeError(f"Falha de conexao Supabase: {exc.reason}")
        return resp.read()

    def fetch_all(self, table: str, params: dict[str, str] | None = None,
                  filters: str | None = None) -> list[dict[str, Any]]:
        """Busca todas as linhas de uma tabela, com paginacao Range."""
        qs = "&".join(f"{k}={v}" for k, v in (params or {}).items())
        if filters:
            qs = f"{qs}&{filters}" if qs else filters
        url = f"{self.base_url}/rest/v1/{table}?{'select=*' if not qs else qs}"

        rows: list[dict[str, Any]] = []
        start = 0
        while True:
            range_url = url
            if "?" not in url:
                range_url = f"{url}?"
            page_url = f"{range_url}&limit={MAX_PAGE_SIZE}&offset={start}"

            raw = self._request(page_url)
            chunk = json.loads(raw.decode())
            if not chunk:
                break
            rows.extend(chunk)
            if len(chunk) < MAX_PAGE_SIZE:
                break
            start += MAX_PAGE_SIZE
        return rows

    def fetch_eq(self, table: str, column: str, value: Any,
                 select: str = "*",
                 order: str | None = None) -> list[dict[str, Any]]:
        """Busca linhas com filtro de igualdade."""
        params: dict[str, str] = {"select": select}
        if order:
            params["order"] = order
        escaped = str(value).replace("'", "''")
        return self.fetch_all(
            table, params=params,
            filters=f"{column}=eq.{escaped}"
        )

    def fetch_eq_extra(self, table: str, filters: list[tuple[str, Any]],
                       select: str = "*", order: str | None = None) -> list[dict[str, Any]]:
        """Busca com multiplos filtros de igualdade."""
        fq = "&".join(f"{col}=eq.{str(val).replace(chr(39), chr(39)+chr(39))}"
                      for col, val in filters)
        params: dict[str, str] = {"select": select}
        if order:
            params["order"] = order
        return self.fetch_all(table, params=params, filters=fq)


# ---------------------------------------------------------------------------
# Utilitarios
# ---------------------------------------------------------------------------


def _safe_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        f = float(val)
        return None if math.isnan(f) else f
    except (TypeError, ValueError, OverflowError):
        return None


def _safe_int(val: Any) -> int | None:
    f = _safe_float(val)
    return int(f) if f is not None else None


def _normalize_bool(val: Any) -> bool | None:
    if val is None:
        return None
    s = str(val).strip().lower()
    if s in ("s", "sim", "true", "1", "yes"):
        return True
    if s in ("n", "nao", "não", "false", "0", "no"):
        return False
    return None


def _slugify(value: str) -> str:
    ascii_val = (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore").decode("ascii")
    )
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_val.strip().lower())
    return re.sub(r"_+", "_", slug).strip("_")


def normalize_search_name(value: str) -> str:
    return (
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore").decode("ascii")
        .strip().lower()
    )


def region_slug(region_id: str) -> str:
    return region_id.lower()


def region_name(region_id: str) -> str:
    return REGION_NAMES.get(region_id, region_id)


def empty_dim_map() -> dict[str, Any]:
    return {d: None for d in ("educacao", "financas", "meioAmbiente", "saude", "seguranca", "socioeconomico")}


def dim_col(dim: str) -> str:
    return f"nota_{dim}"


# ---------------------------------------------------------------------------
# Camada de extracao
# ---------------------------------------------------------------------------


def extract_all() -> dict[str, Any]:
    client = SupabaseClient()

    # 1. ranking_municipios — anos disponiveis e distribuicao regional
    ranking_2025 = client.fetch_eq("ranking_municipios", "ano", 2025,
                                   order="regiao_funcional.asc,ranking_regiao_funcional.asc")

    regions: dict[str, dict[str, Any]] = {}
    for row in ranking_2025:
        reg = str(row.get("regiao_funcional", ""))
        if reg not in regions:
            regions[reg] = {"coredes": OrderedDict(), "municipios": 0, "scores": []}
        corede = str(row.get("corede", "")).strip()
        if corede:
            regions[reg]["coredes"][corede] = True
        regions[reg]["municipios"] += 1
        sc = _safe_float(row.get("nota_final"))
        if sc is not None:
            regions[reg]["scores"].append(sc)

    # Garantir contagem unica de municipios por regiao
    # Recalcular com distinct para precisao
    for reg in regions:
        all_mun = set()
        scores = []
        for row in ranking_2025:
            if str(row.get("regiao_funcional", "")) == reg:
                all_mun.add(str(row.get("id_municipio")))
                sc = _safe_float(row.get("nota_final"))
                if sc is not None:
                    scores.append(sc)
        regions[reg]["municipios"] = len(all_mun)
        regions[reg]["scores"] = scores

    all_coredes_registry: dict[str, tuple[str, str]] = {}  # slug -> (regionId, name)

    # 2. dash_regioes_resumo — resumo por regiao (dados de averageFinalScore)
    reg_summary_raw = client.fetch_all("dash_regioes_resumo",
                                       params={"select": "*"},
                                       filters=f"ano=eq.{SAMPLE_YEAR}&order=regiao_funcional.asc")
    reg_summary_map: dict[str, dict[str, Any]] = {}
    for row in reg_summary_raw:
        reg = str(row.get("regiao_funcional", ""))
        reg_summary_map[reg] = row

    # Extrair coredes_txt e processar
    for reg, data in regions.items():
        corede_names_ordered = list(data["coredes"].keys())
        # Verificar se ha coredes_txt em reg_summary para nomes mais limpos
        if reg in reg_summary_map:
            coredes_txt = reg_summary_map[reg].get("coredes_txt", "")
            if coredes_txt:
                parsed = [c.strip() for c in str(coredes_txt).split(",") if c.strip()]
                if parsed:
                    corede_names_ordered = parsed
        data["corede_names"] = corede_names_ordered
        data["corede_slugs"] = [_slugify(c) for c in corede_names_ordered]
        for slug, cname in zip(data["corede_slugs"], corede_names_ordered):
            all_coredes_registry[slug] = (reg, cname)

    # 3. Municipios — via ranking_municipios para catalog
    all_municipalities: dict[str, dict[str, Any]] = {}
    for row in ranking_2025:
        mid = str(row.get("id_municipio"))
        if mid not in all_municipalities:
            all_municipalities[mid] = {
                "id": mid,
                "name": str(row.get("municipio", "")).strip(),
                "regionId": str(row.get("regiao_funcional", "")),
                "coredeId": _slugify(str(row.get("corede", "")).strip()),
                "coredeName": str(row.get("corede", "")).strip(),
            }

    years = sorted(set(int(r["ano"]) for r in client.fetch_eq("ranking_municipios", "ano", 2025, select="ano") + []))
    # Buscar todos os anos disponiveis
    anos_raw = client.fetch_all("ranking_municipios", params={"select": "ano"}, filters="order=ano.asc")
    all_years = sorted(set(int(r["ano"]) for r in anos_raw if r.get("ano") is not None))

    # 4. Picada Cafe — resumo
    pc_summary = client.fetch_eq_extra(
        "dash_municipios_resumo",
        [("ano", SAMPLE_YEAR), ("id_municipio", PICADA_CAFE_ID)]
    )
    pc_all_summary = client.fetch_eq(
        "dash_municipios_resumo", "id_municipio", PICADA_CAFE_ID,
        order="ano.asc"
    )

    # 5. Picada Cafe — categoria historico (todas as dimensoes, todos os anos)
    pc_cat_hist = client.fetch_eq(
        "dash_municipio_categoria_historico", "id_municipio", PICADA_CAFE_ID,
        order="ano.asc,categoria.asc"
    )

    # 6. Picada Cafe — indicadores
    pc_indicators = client.fetch_eq(
        "dash_municipio_indicadores", "id_municipio", PICADA_CAFE_ID,
        order="ano.asc,categoria.asc,indicador.asc"
    )

    # 7. Indicadores — nomes distintos do banco
    indicator_names_raw = client.fetch_all(
        "dash_municipio_indicadores",
        params={"select": "indicador,indicador_nome"},
        filters="order=indicador.asc"
    )
    indicator_meta: dict[str, str] = {}
    for row in indicator_names_raw:
        ind = str(row.get("indicador", "")).strip()
        name = str(row.get("indicador_nome", "")).strip()
        if ind and name and ind not in indicator_meta:
            indicator_meta[ind] = name

    # 8. Medianas regionais para RF3
    medians = client.fetch_eq(
        "mv_municipio_indicador_mediana_regiao", "regiao_funcional", PICADA_CAFE_REGION_ID,
        order="ano.asc,categoria.asc,indicador.asc"
    )
    median_lookup: dict[tuple[int, str, str], dict[str, Any]] = {}
    for row in medians:
        key = (int(row["ano"]), str(row["categoria"]), str(row["indicador"]))
        median_lookup[key] = row

    # 9. Classificacao populacional
    pc_classification = client.fetch_eq(
        "regressao_rf_previsoes", "id_municipio", PICADA_CAFE_ID,
        order="ano.asc"
    )
    class_lookup: dict[int, dict[str, Any]] = {}
    for row in pc_classification:
        class_lookup[int(row["ano"])] = row

    return {
        "client": client,
        "ranking_2025": ranking_2025,
        "regions": regions,
        "all_coredes_registry": all_coredes_registry,
        "reg_summary_map": reg_summary_map,
        "municipalities": all_municipalities,
        "all_years": all_years,
        "pc_summary": pc_summary,
        "pc_all_summary": pc_all_summary,
        "pc_cat_hist": pc_cat_hist,
        "pc_indicators": pc_indicators,
        "indicator_meta": indicator_meta,
        "medians": medians,
        "median_lookup": median_lookup,
        "pc_classification": pc_classification,
        "class_lookup": class_lookup,
    }


# ---------------------------------------------------------------------------
# Builders
# ---------------------------------------------------------------------------


def build_manifest(data: dict[str, Any]) -> dict[str, Any]:
    years = data["all_years"]
    regs = data["regions"]
    total_mun = sum(r["municipios"] for r in regs.values())
    total_coredes = len(data["all_coredes_registry"])
    return {
        "schemaVersion": SCHEMA_VERSION,
        "activeDataVersion": DATA_VERSION,
        "generatedAt": GENERATED_AT,
        "defaultYear": SAMPLE_YEAR,
        "availableYears": years,
        "yearRange": {"start": min(years), "end": max(years)},
        "totals": {
            "municipalities": total_mun,
            "regions": len(regs),
            "coredes": total_coredes,
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
            "coveredRegionIds": sorted(regs.keys()),
            "detailedMunicipalityIds": [PICADA_CAFE_ID],
        },
    }


def build_catalog(data: dict[str, Any]) -> dict[str, Any]:
    regs = data["regions"]
    ordered = sorted(regs.keys(), key=lambda r: int(r[2:]))
    regions_cat = [
        {"id": rid, "slug": region_slug(rid), "name": region_name(rid), "order": i+1}
        for i, rid in enumerate(ordered)
    ]

    corede_registry = data["all_coredes_registry"]
    coredes_cat = sorted(
        [{"id": slug, "name": name, "regionId": rid}
         for slug, (rid, name) in corede_registry.items()],
        key=lambda c: (c["regionId"], c["name"])
    )

    municipalities_cat = [
        {
            "id": PICADA_CAFE_ID,
            "name": PICADA_CAFE_NAME,
            "searchName": normalize_search_name(PICADA_CAFE_NAME),
            "regionId": PICADA_CAFE_REGION_ID,
            "coredeId": PICADA_CAFE_COREDE_ID,
        }
    ]

    dimensions_cat = [
        {"id": dim, "name": DIMENSION_LABELS[dim], "order": i+1}
        for i, dim in enumerate(DIMENSION_IDS)
    ]

    indicators_cat = _build_indicator_catalog(data)

    return {
        "regions": regions_cat,
        "coredes": coredes_cat,
        "municipalities": municipalities_cat,
        "dimensions": dimensions_cat,
        "indicators": indicators_cat,
    }


# ---------------------------------------------------------------------------
# Catalogo de indicadores (41 entries, metadata do projeto antigo)
# ---------------------------------------------------------------------------


def _indicator_desc(indicator_id: str) -> str:
    descs = {
        "adequacao_formacao_docente": "Considera a proporção de docentes do ensino fundamental com formação adequada à área em que atuam.",
        "saeb_ensino_fundamental": "Sintetiza o desempenho em Português e Matemática no SAEB, considerando os anos iniciais e finais do ensino fundamental.",
        "taxa_cobertura_creche": "Expressa a cobertura de matrículas em creche na rede municipal.",
        "taxa_distorcao_fundamental": "Indica a proporção de estudantes do ensino fundamental com idade acima da esperada para a série.",
        "qt_acesso_infor": "Considera a disponibilidade de recursos de acesso à informação nas escolas, como infraestrutura associada à conectividade e ao uso de tecnologias.",
        "exec_orc_corrente": "Relaciona as despesas correntes às receitas correntes, indicando o nível de comprometimento do orçamento.",
        "autonomia_fiscal": "Avalia a capacidade do município de financiar suas atividades com receitas próprias.",
        "endividamento": "Expressa o peso da dívida consolidada líquida sobre a receita corrente líquida.",
        "despesas_pessoal": "Indica a participação das despesas com pessoal na receita corrente líquida do município.",
        "investimento": "Representa a parcela da receita corrente líquida destinada a investimentos e despesas de capital.",
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
        "proporcao_consultas_pre_natal": "Indica a proporção de nascidos vivos cujas mães realizaram sete ou mais consultas de pré-natal.",
        "proporcao_gravidez_adolescencia": "Expressa a participação de mães adolescentes no total de nascidos vivos do município.",
        "medicos_por_mil_habitantes": "Relaciona o número de médicos disponíveis ao tamanho da população.",
        "cobertura_aps": "Representa a cobertura potencial da Atenção Primária à Saúde no município.",
        "cobertura_acs": "Indica a cobertura estimada dos agentes comunitários de saúde.",
        "cobertura_vacinal_penta_polio_media": "Sintetiza a cobertura das vacinas pentavalente e poliomielite.",
        "delitos_com_armas_por_10mil_hab": "Relaciona as ocorrências de delitos com armas e munições ao tamanho da população.",
        "furtos_por_10mil_hab": "Expressa as ocorrências de furto em relação ao tamanho da população.",
        "homicidio_doloso_por_10mil_hab": "Indica a incidência de homicídios dolosos em relação ao tamanho da população.",
        "roubos_por_10mil_hab": "Relaciona as ocorrências de roubo ao tamanho da população.",
        "roubos_furtos_veiculos_por_10mil_veiculos": "Compara os roubos e furtos de veículos com o tamanho da frota municipal.",
        "estupro_por_10mil_mulheres": "Relaciona as ocorrências de estupro à população feminina do município.",
        "ameaca_por_10mil_mulheres": "Relaciona as ocorrências de ameaça à população feminina do município.",
        "pib_per_capita": "Relaciona o valor do PIB municipal ao número de habitantes.",
        "mulheres_empregadas_ensino_medio_ou_mais_por_1000_mulheres": "Expressa os vínculos formais de mulheres com ensino médio ou mais em relação à população feminina.",
        "renda_media": "Representa a remuneração média dos vínculos formais no mês de dezembro.",
        "vinculos_per_capita": "Relaciona o número de vínculos formais ativos à população do município.",
        "formalidade_mercado_trabalho": "Compara os vínculos formais ativos com a população de 15 a 69 anos.",
        "geracao_emprego_per_capita": "Relaciona o saldo de empregos formais gerados ao tamanho da população.",
        "vulnerabilidade_social": "Indica a proporção da população registrada no Cadastro Único.",
        "proporcao_pessoas_baixa_renda": "Expressa a proporção de pessoas em famílias de baixa renda no município.",
    }
    return descs.get(indicator_id, "")


def _indicator_direction(indicator_id: str) -> str:
    directions = {
        "adequacao_formacao_docente": "higher_is_better",
        "saeb_ensino_fundamental": "higher_is_better",
        "taxa_cobertura_creche": "higher_is_better",
        "taxa_distorcao_fundamental": "lower_is_better",
        "qt_acesso_infor": "higher_is_better",
        "exec_orc_corrente": "lower_is_better",
        "autonomia_fiscal": "higher_is_better",
        "endividamento": "lower_is_better",
        "despesas_pessoal": "lower_is_better",
        "investimento": "higher_is_better",
        "disponibilidade_caixa": "higher_is_better",
        "geracao_de_caixa": "higher_is_better",
        "restos_a_pagar": "lower_is_better",
        "desmatamento_por_area": "lower_is_better",
        "emissao_gases_per_capita": "lower_is_better",
        "incidencia_coliformes": "lower_is_better",
        "indice_perdas_distribuicao": "lower_is_better",
        "prop_atendimento_agua": "higher_is_better",
        "prop_coleta_residuos": "higher_is_better",
        "obitos_causas_evitaveis_mil_habitantes": "lower_is_better",
        "proporcao_consultas_pre_natal": "higher_is_better",
        "proporcao_gravidez_adolescencia": "lower_is_better",
        "medicos_por_mil_habitantes": "higher_is_better",
        "cobertura_aps": "higher_is_better",
        "cobertura_acs": "higher_is_better",
        "cobertura_vacinal_penta_polio_media": "higher_is_better",
        "delitos_com_armas_por_10mil_hab": "lower_is_better",
        "furtos_por_10mil_hab": "lower_is_better",
        "homicidio_doloso_por_10mil_hab": "lower_is_better",
        "roubos_por_10mil_hab": "lower_is_better",
        "roubos_furtos_veiculos_por_10mil_veiculos": "lower_is_better",
        "estupro_por_10mil_mulheres": "lower_is_better",
        "ameaca_por_10mil_mulheres": "lower_is_better",
        "pib_per_capita": "higher_is_better",
        "mulheres_empregadas_ensino_medio_ou_mais_por_1000_mulheres": "higher_is_better",
        "renda_media": "higher_is_better",
        "vinculos_per_capita": "higher_is_better",
        "formalidade_mercado_trabalho": "higher_is_better",
        "geracao_emprego_per_capita": "higher_is_better",
        "vulnerabilidade_social": "lower_is_better",
        "proporcao_pessoas_baixa_renda": "lower_is_better",
    }
    return directions.get(indicator_id, "neutral")


def _indicator_unit(indicator_id: str) -> str | None:
    units = {
        "adequacao_formacao_docente": "%",
        "saeb_ensino_fundamental": "pontos",
        "taxa_cobertura_creche": "%",
        "taxa_distorcao_fundamental": "%",
        "qt_acesso_infor": "%",
        "prop_atendimento_agua": "%",
        "prop_coleta_residuos": "%",
        "indice_perdas_distribuicao": "%",
        "desmatamento_por_area": "%",
        "incidencia_coliformes": "%",
        "proporcao_consultas_pre_natal": "%",
        "proporcao_gravidez_adolescencia": "%",
        "cobertura_aps": "%",
        "cobertura_acs": "%",
        "cobertura_vacinal_penta_polio_media": "%",
        "formalidade_mercado_trabalho": "%",
        "vulnerabilidade_social": "%",
        "proporcao_pessoas_baixa_renda": "%",
        "exec_orc_corrente": "%",
        "autonomia_fiscal": "%",
        "endividamento": "%",
        "despesas_pessoal": "%",
        "investimento": "%",
        "disponibilidade_caixa": "%",
        "geracao_de_caixa": "%",
        "restos_a_pagar": "%",
        "pib_per_capita": "R$",
        "renda_media": "R$",
        "vinculos_per_capita": "vínculos/hab",
        "geracao_emprego_per_capita": "empregos/1.000 hab",
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
        "emissao_gases_per_capita": "MtCO₂",
        "taxa_cobertura_creche": "%",
        "taxa_distorcao_fundamental": "%",
    }
    return units.get(indicator_id)


def _indicator_format(indicator_id: str) -> str:
    if _indicator_unit(indicator_id) == "R$":
        return "currency"
    if _indicator_unit(indicator_id) == "pontos":
        return "number"
    if _safe_int(_indicator_multiplier(indicator_id)) == 100 and _indicator_unit(indicator_id) == "%":
        return "percent"
    unit = _indicator_unit(indicator_id)
    if unit == "%":
        return "percent"
    if indicator_id in ("vinculos_per_capita",):
        return "number"
    return "number"


def _indicator_multiplier(indicator_id: str) -> int:
    multipliers = {
        "formalidade_mercado_trabalho": 100,
        "geracao_emprego_per_capita": 1000,
    }
    return multipliers.get(indicator_id, 1)


def _indicator_decimal_places(indicator_id: str) -> int:
    if _indicator_format(indicator_id) == "currency":
        return 2
    if indicator_id == "vinculos_per_capita":
        return 2
    unit = _indicator_unit(indicator_id)
    if unit == "pontos":
        return 1
    return 1


def _indicator_short_name(indicator_id: str) -> str | None:
    short_names = {
        "adequacao_formacao_docente": "Formação docente",
        "saeb_ensino_fundamental": "SAEB fundamental",
        "taxa_cobertura_creche": "Cobertura creche",
        "taxa_distorcao_fundamental": "Distorção fundamental",
        "qt_acesso_infor": "Acesso à informação",
        "exec_orc_corrente": "Execução orçamentária",
        "autonomia_fiscal": "Autonomia fiscal",
        "endividamento": None,
        "despesas_pessoal": "Despesas pessoal",
        "investimento": None,
        "disponibilidade_caixa": "Disponibilidade caixa",
        "geracao_de_caixa": "Geração de caixa",
        "restos_a_pagar": "Restos a pagar",
        "desmatamento_por_area": "Desmatamento",
        "emissao_gases_per_capita": "Emissão gases",
        "incidencia_coliformes": "Coliformes",
        "indice_perdas_distribuicao": "Perdas distribuição",
        "prop_atendimento_agua": "Atendimento água",
        "prop_coleta_residuos": "Coleta resíduos",
        "obitos_causas_evitaveis_mil_habitantes": "Óbitos evitáveis",
        "proporcao_consultas_pre_natal": "Pré-natal",
        "proporcao_gravidez_adolescencia": "Gravidez adolescência",
        "medicos_por_mil_habitantes": "Médicos/mil hab",
        "cobertura_aps": "Cobertura APS",
        "cobertura_acs": "Cobertura ACS",
        "cobertura_vacinal_penta_polio_media": "Vacinal penta/pólio",
        "delitos_com_armas_por_10mil_hab": "Armas/10 mil hab",
        "furtos_por_10mil_hab": "Furtos/10 mil hab",
        "homicidio_doloso_por_10mil_hab": "Homicídios/10 mil hab",
        "roubos_por_10mil_hab": "Roubos/10 mil hab",
        "roubos_furtos_veiculos_por_10mil_veiculos": "Roubos/furtos veíc.",
        "estupro_por_10mil_mulheres": "Estupros/10 mil mulh.",
        "ameaca_por_10mil_mulheres": "Ameaças/10 mil mulh.",
        "pib_per_capita": "PIB per capita",
        "mulheres_empregadas_ensino_medio_ou_mais_por_1000_mulheres": "Mulheres empregadas ensino médio+",
        "renda_media": "Renda média",
        "vinculos_per_capita": "Vínculos per capita",
        "formalidade_mercado_trabalho": "Formalidade",
        "geracao_emprego_per_capita": "Geração empregos/1.000 hab",
        "vulnerabilidade_social": "Vulnerabilidade social",
        "proporcao_pessoas_baixa_renda": "Baixa renda",
    }
    return short_names.get(indicator_id)


def _indicator_name(indicator_id: str, data: dict[str, Any]) -> str:
    meta = data.get("indicator_meta", {})
    db_name = meta.get(indicator_id)
    if db_name:
        return db_name
    fallback = {
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
    return fallback.get(indicator_id, indicator_id.replace("_", " ").title())


def _indicator_order(indicator_id: str, dim: str) -> int:
    dim_order = {
        "educacao": {"adequacao_formacao_docente": 1, "saeb_ensino_fundamental": 2,
                     "taxa_cobertura_creche": 3, "taxa_distorcao_fundamental": 4, "qt_acesso_infor": 5},
        "financas": {"exec_orc_corrente": 1, "autonomia_fiscal": 2, "endividamento": 3,
                     "despesas_pessoal": 4, "investimento": 5, "disponibilidade_caixa": 6,
                     "geracao_de_caixa": 7, "restos_a_pagar": 8},
        "meio_ambiente": {"desmatamento_por_area": 1, "emissao_gases_per_capita": 2,
                          "incidencia_coliformes": 3, "indice_perdas_distribuicao": 4,
                          "prop_atendimento_agua": 5, "prop_coleta_residuos": 6},
        "saude": {"obitos_causas_evitaveis_mil_habitantes": 1, "proporcao_consultas_pre_natal": 2,
                  "proporcao_gravidez_adolescencia": 3, "medicos_por_mil_habitantes": 4,
                  "cobertura_aps": 5, "cobertura_acs": 6, "cobertura_vacinal_penta_polio_media": 7},
        "seguranca": {"delitos_com_armas_por_10mil_hab": 1, "furtos_por_10mil_hab": 2,
                      "homicidio_doloso_por_10mil_hab": 3, "roubos_por_10mil_hab": 4,
                      "roubos_furtos_veiculos_por_10mil_veiculos": 5,
                      "estupro_por_10mil_mulheres": 6, "ameaca_por_10mil_mulheres": 7},
        "socioeconomico": {"pib_per_capita": 1,
                           "mulheres_empregadas_ensino_medio_ou_mais_por_1000_mulheres": 2,
                           "renda_media": 3, "vinculos_per_capita": 4,
                           "formalidade_mercado_trabalho": 5, "geracao_emprego_per_capita": 6,
                           "vulnerabilidade_social": 7, "proporcao_pessoas_baixa_renda": 8},
    }
    return dim_order.get(dim, {}).get(indicator_id, 99)


def _build_indicator_catalog(data: dict[str, Any]) -> list[dict[str, Any]]:
    indicator_ids_by_dim: dict[str, list[str]] = {
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

    result = []
    for dim in DIMENSION_IDS:
        for iid in indicator_ids_by_dim.get(dim, []):
            result.append({
                "id": iid,
                "dimensionId": dim,
                "name": _indicator_name(iid, data),
                "shortName": _indicator_short_name(iid),
                "description": _indicator_desc(iid),
                "unit": _indicator_unit(iid),
                "format": _indicator_format(iid),
                "decimalPlaces": _indicator_decimal_places(iid),
                "multiplier": _indicator_multiplier(iid),
                "direction": _indicator_direction(iid),
                "order": _indicator_order(iid, dim),
            })
    return result


# ---------------------------------------------------------------------------
# Builders de dados regionais
# ---------------------------------------------------------------------------


def build_regions(data: dict[str, Any]) -> dict[str, Any]:
    regs = data["regions"]
    reg_summary = data["reg_summary_map"]
    ordered = sorted(regs.keys(), key=lambda r: int(r[2:]))

    summaries = []
    for rid in ordered:
        info = regs[rid]
        avg_score = reg_summary[rid].get("nota_final_media") if rid in reg_summary else None
        summaries.append({
            "id": rid,
            "name": region_name(rid),
            "order": int(rid[2:]),
            "municipalityCount": info["municipios"],
            "coredeCount": len(info["corede_names"]),
            "coredeIds": info["corede_slugs"],
            "coredeNames": info["corede_names"],
            "averageFinalScore": _safe_float(avg_score),
        })

    total_mun = sum(r["municipios"] for r in regs.values())
    total_coredes = len(data["all_coredes_registry"])
    return {
        "year": SAMPLE_YEAR,
        "totals": {"municipalities": total_mun, "regions": len(regs), "coredes": total_coredes},
        "regions": summaries,
    }


def build_regional_ranking(data: dict[str, Any]) -> dict[str, Any]:
    ranking_2025 = data["ranking_2025"]
    # Filtra RF3
    rf3_rows = [r for r in ranking_2025 if str(r.get("regiao_funcional")) == PICADA_CAFE_REGION_ID]
    rf3_rows.sort(key=lambda r: int(r.get("ranking_regiao_funcional", 99999)))

    # Funcao auxiliar para mapear dimensao
    def _dims(row: dict) -> dict[str, Any]:
        m = empty_dim_map()
        for col in ["nota_educacao", "nota_financas", "nota_meio_ambiente", "nota_saude", "nota_seguranca", "nota_socioeconomico"]:
            pass  # dimensao ranks nao disponiveis na tabela base
        return m

    entries = []
    seen = set()
    for row in rf3_rows:
        mid = str(row.get("id_municipio", ""))
        if mid in seen:
            continue
        seen.add(mid)
        rank = _safe_int(row.get("ranking_regiao_funcional"))
        score = _safe_float(row.get("nota_final"))
        corede_name = str(row.get("corede", "")).strip()
        entries.append({
            "municipalityId": mid,
            "municipalityName": str(row.get("municipio", "")).strip(),
            "coredeId": _slugify(corede_name),
            "coredeName": corede_name,
            "overallRank": rank,
            "previousOverallRank": None,
            "rankChange": None,
            "populationPerformance": {"code": "unknown", "label": "Sem classificação"},
            "finalScore": score,
            "dimensionRanks": empty_dim_map(),
        })

    return {
        "year": SAMPLE_YEAR,
        "regionId": PICADA_CAFE_REGION_ID,
        "regionName": region_name(PICADA_CAFE_REGION_ID),
        "municipalityCount": len(entries),
        "municipalities": entries,
    }


# ---------------------------------------------------------------------------
# Builders municipais
# ---------------------------------------------------------------------------


def _classification_code(raw: str | None) -> tuple[str, str]:
    """Normaliza classificacao textual para contrato."""
    if raw is None:
        return ("unknown", "Sem classificação")
    s = unicodedata.normalize("NFKD", str(raw)).encode("ascii", "ignore").decode("ascii").strip().lower()
    if "acima" in s or "above" in s:
        return ("above", "Acima do esperado")
    if "abaixo" in s or "baixo" in s:
        return ("below", "Abaixo do esperado")
    if "dentro" in s or "intervalo" in s or "esperado" in s:
        return ("expected", "Dentro do esperado")
    return ("unknown", str(raw).strip() if str(raw).strip() else "Sem classificação")


def _rank_change(prev: int | None, curr: int | None) -> int | None:
    if prev is None or curr is None:
        return None
    return prev - curr  # positivo = melhora


def build_municipality_summary(data: dict[str, Any]) -> dict[str, Any]:
    pc_all = data["pc_all_summary"]
    pc_cat = data["pc_cat_hist"]
    cat_lookup: dict[int, dict[str, dict]] = {}
    for row in pc_cat:
        yr = int(row["ano"])
        cat = str(row["categoria"]).strip()
        if yr not in cat_lookup:
            cat_lookup[yr] = {}
        cat_lookup[yr][cat] = row

    class_lookup = data["class_lookup"]

    # Constroi yearlySummaries
    yearly = []
    dim_history_list: dict[str, list[dict[str, Any]]] = {dim: [] for dim in DIMENSION_IDS}
    summary_pc = sorted(pc_all, key=lambda r: int(r["ano"]))

    for row in summary_pc:
        yr = int(row["ano"])
        overall_rank = _safe_int(row.get("ranking_regiao_funcional"))
        total_in_reg = _safe_int(row.get("total_municipios_regiao"))

        # Encontrar ano anterior para rankChange
        prev_year_data = [r for r in summary_pc if int(r["ano"]) == yr - 1]
        prev_rank = _safe_int(prev_year_data[0].get("ranking_regiao_funcional")) if prev_year_data else None

        # Classificacao
        cl = class_lookup.get(yr, {})
        classification = _classification_code(cl.get("classificacao") if cl else None)

        dim_scores = empty_dim_map()
        for dim in DIMENSION_IDS:
            dim_scores[dim] = _safe_float(row.get(f"nota_{dim}"))

        dim_ranks = empty_dim_map()
        for dim in DIMENSION_IDS:
            dim_ranks[dim] = _safe_int(row.get(f"ranking_{dim}"))

        final_score = _safe_float(row.get("nota_final"))

        yearly.append({
            "year": yr,
            "overallRank": overall_rank,
            "previousOverallRank": prev_rank,
            "rankChange": _rank_change(prev_rank, overall_rank),
            "totalMunicipalitiesInRegion": total_in_reg,
            "classification": {"code": classification[0], "label": classification[1]},
            "finalScore": final_score,
            "dimensionScores": dim_scores,
            "dimensionRanks": dim_ranks,
        })

        # Dimension history
        for dim in DIMENSION_IDS:
            dim_row = cat_lookup.get(yr, {}).get(dim, {})
            cat_score = _safe_float(dim_row.get("nota_dimensao")) if dim_row else _safe_float(row.get(f"nota_{dim}"))
            cat_rank = _safe_int(dim_row.get("ranking_dimensao")) if dim_row else None
            cat_total = _safe_int(dim_row.get("total_municipios_regiao")) if dim_row else total_in_reg
            dim_history_list[dim].append({
                "year": yr,
                "score": cat_score,
                "rank": cat_rank,
                "totalMunicipalitiesInRegion": cat_total if cat_total else total_in_reg,
            })

    dim_history = [
        {"dimensionId": dim, "values": dim_history_list[dim]}
        for dim in DIMENSION_IDS
        if dim_history_list[dim]
    ]

    return {
        "municipality": {
            "id": PICADA_CAFE_ID,
            "name": PICADA_CAFE_NAME,
            "regionId": PICADA_CAFE_REGION_ID,
            "regionName": region_name(PICADA_CAFE_REGION_ID),
            "coredeId": PICADA_CAFE_COREDE_ID,
            "coredeName": PICADA_CAFE_COREDE_NAME,
        },
        "availableYears": [int(r["ano"]) for r in summary_pc],
        "latestYear": max(int(r["ano"]) for r in summary_pc),
        "yearlySummaries": yearly,
        "dimensionHistory": dim_history,
    }


def build_dimension_file(data: dict[str, Any], dimension_id: str) -> dict[str, Any]:
    pc_all = data["pc_all_summary"]  # resumo para dimension scores fallback
    pc_cat = data["pc_cat_hist"]  # categoria historico com nota_dimensao
    pc_indicators = data["pc_indicators"]  # indicadores
    median_lookup = data["median_lookup"]
    class_lookup = data["class_lookup"]

    # Filtrar indicadores e series
    ind_catalog = [ind for ind in _build_indicator_catalog(data) if ind["dimensionId"] == dimension_id]

    # Dados de categoria historico
    cat_rows = [r for r in pc_cat if str(r.get("categoria")) == dimension_id]
    cat_by_year: dict[int, dict[str, Any]] = {}
    for r in cat_rows:
        cat_by_year[int(r["ano"])] = r

    # Dados de indicadores
    ind_rows = [r for r in pc_indicators if str(r.get("categoria")) == dimension_id]

    # Agrupar indicadores por id
    ind_by_indicator: dict[str, list[dict[str, Any]]] = {}
    for r in ind_rows:
        iid = str(r.get("indicador", "")).strip()
        if iid not in ind_by_indicator:
            ind_by_indicator[iid] = []
        ind_by_indicator[iid].append(r)

    # Montar dimension_history
    summary_pc = sorted(pc_all, key=lambda r: int(r["ano"]))
    dim_history = []
    for row in summary_pc:
        yr = int(row["ano"])
        total_reg = _safe_int(row.get("total_municipios_regiao"))
        # Nota da dimensao: preferir categoria_historico
        if yr in cat_by_year:
            score = _safe_float(cat_by_year[yr].get("nota_dimensao"))
            rank = _safe_int(cat_by_year[yr].get("ranking_dimensao"))
            total = _safe_int(cat_by_year[yr].get("total_municipios_regiao"))
        else:
            score = _safe_float(row.get(f"nota_{dimension_id}"))
            rank = None
            total = total_reg
        dim_history.append({
            "year": yr,
            "score": score if score else None,
            "rank": rank,
            "totalMunicipalitiesInRegion": total if total else total_reg,
        })

    # Montar series de indicadores
    series = []
    ind_order_map = {ind["id"]: ind["order"] for ind in ind_catalog}
    # Preservar ordem do catalogo
    for ind_id in [ind["id"] for ind in ind_catalog]:
        rows = ind_by_indicator.get(ind_id, [])
        values = []
        for r in rows:
            yr = int(r["ano"])
            md_key = (yr, dimension_id, ind_id)
            md = median_lookup.get(md_key, {})
            values.append({
                "year": yr,
                "score": _safe_float(r.get("nota_indicador")),
                "rank": _safe_int(r.get("ranking_indicador")),
                "untiedRank": _safe_int(r.get("ranking_indicador_desempatado")),
                "originalValue": _safe_float(r.get("valor_original")),
                "valueUsedForScore": _safe_float(r.get("valor_usado_nota")),
                "isImputed": _normalize_bool(r.get("valor_imputado")),
                "regionalMedianScore": _safe_float(md.get("mediana_nota_indicador_regiao")),
                "regionalMedianOriginalValue": _safe_float(md.get("mediana_valor_original_regiao")),
                "regionalMedianSampleSize": _safe_int(md.get("total_municipios_mediana")),
            })
        series.append({"indicatorId": ind_id, "values": values})

    return {
        "municipalityId": PICADA_CAFE_ID,
        "municipalityName": PICADA_CAFE_NAME,
        "regionId": PICADA_CAFE_REGION_ID,
        "regionName": region_name(PICADA_CAFE_REGION_ID),
        "corede": PICADA_CAFE_COREDE_NAME,
        "dimensionId": dimension_id,
        "dimensionName": DIMENSION_LABELS[dimension_id],
        "availableYears": [int(r["ano"]) for r in summary_pc],
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


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        raise ValidationError(msg)


def _check_banned(value: Any, path: str = "") -> None:
    banned = ("", "N/A", "-", "—", "NaN")
    if isinstance(value, dict):
        for k, v in value.items():
            _check_banned(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _check_banned(v, f"{path}[{i}]")
    elif isinstance(value, str):
        _assert(value not in banned, f"{path}: valor proibido {value!r}")


def _check_nan(value: Any, path: str = "") -> None:
    if isinstance(value, dict):
        for k, v in value.items():
            _check_nan(v, f"{path}.{k}")
    elif isinstance(value, list):
        for i, v in enumerate(value):
            _check_nan(v, f"{path}[{i}]")
    elif isinstance(value, float):
        _assert(not math.isnan(value), f"NaN em {path}")


def validate_all(manifest: dict[str, Any], catalog: dict[str, Any],
                 regions_data: dict[str, Any], ranking_data: dict[str, Any],
                 summary_data: dict[str, Any],
                 dim_files: dict[str, dict[str, Any]]) -> None:
    # 1. Manifest
    _assert(manifest["schemaVersion"] == SCHEMA_VERSION, "manifest.schemaVersion")
    _assert(manifest["activeDataVersion"] == DATA_VERSION, "manifest.activeDataVersion")
    _assert(PICADA_CAFE_ID in manifest.get("sample", {}).get("detailedMunicipalityIds", []), "manifest sample")

    # 2. Catalog regions
    _assert(len(catalog["regions"]) == 9, "catalog: 9 regions")
    _assert(len(catalog["coredes"]) >= 28, f"catalog: >= 28 coredes ({len(catalog['coredes'])})")
    _assert(any(m["id"] == PICADA_CAFE_ID for m in catalog["municipalities"]), "catalog: Picada Cafe")
    _assert(len(catalog["dimensions"]) == 6, "catalog: 6 dimensions")
    indicators = catalog["indicators"]
    _assert(len(indicators) == 41, f"catalog: 41 indicators ({len(indicators)})")
    dim_ids = {d["id"] for d in catalog["dimensions"]}
    for ind in indicators:
        _assert(ind["dimensionId"] in dim_ids, f"indicator {ind['id']}: dimensionId valido")
        _assert(ind["direction"] in ("higher_is_better", "lower_is_better", "neutral"), f"{ind['id']}: direction")

    # 3. Regions file
    _assert(regions_data["year"] == SAMPLE_YEAR, "regions.year")
    _assert(len(regions_data["regions"]) == 9, "regions: 9")
    for r in regions_data["regions"]:
        _assert(r["coredeCount"] == len(r["coredeIds"]) == len(r["coredeNames"]), f"{r['id']}: corede consistency")
    rf3_reg = next(r for r in regions_data["regions"] if r["id"] == PICADA_CAFE_REGION_ID)
    _assert(rf3_reg["municipalityCount"] == 49, f"RF3 municipalityCount: {rf3_reg['municipalityCount']}")

    # 4. Regional ranking
    _assert(ranking_data["regionId"] == PICADA_CAFE_REGION_ID, "ranking.regionId")
    _assert(ranking_data["municipalityCount"] == 49, f"ranking RF3 count: {ranking_data['municipalityCount']}")
    _assert(ranking_data["municipalityCount"] == len(ranking_data["municipalities"]),
            "ranking.municipalityCount == len")
    pc_in_ranking = [e for e in ranking_data["municipalities"] if e["municipalityId"] == PICADA_CAFE_ID]
    _assert(len(pc_in_ranking) == 1, "ranking: Picada presente")
    _assert(pc_in_ranking[0]["overallRank"] == 2, f"Picada ranking: {pc_in_ranking[0]['overallRank']}")

    # 5. Summary
    mun = summary_data["municipality"]
    _assert(mun["id"] == PICADA_CAFE_ID, "summary.id")
    _assert(mun["coredeName"] == "Hortênsias", f"summary.corede: {mun['coredeName']}")
    _assert(len(summary_data["availableYears"]) == 5, f"summary years: {summary_data['availableYears']}")
    _assert(len(summary_data["yearlySummaries"]) == 5, "summary: 5 yearly summaries")
    _assert(len(summary_data["dimensionHistory"]) == 6, f"summary: 6 dim history ({len(summary_data['dimensionHistory'])})")
    for dh in summary_data["dimensionHistory"]:
        _assert(len(dh["values"]) == 5, f"dim {dh['dimensionId']}: 5 values")
    # Verificar 2025 rank = 2
    y2025 = next(y for y in summary_data["yearlySummaries"] if y["year"] == SAMPLE_YEAR)
    _assert(y2025["overallRank"] == 2, f"2025 rank: {y2025['overallRank']}")
    _assert(y2025["classification"]["code"] in ("above", "expected", "below", "unknown"), "classification")

    # 6. Dimension files
    dim_catalog_ids = {ind["id"] for ind in indicators}
    for dim_id, df in dim_files.items():
        _assert(df["dimensionId"] == dim_id, f"dim file {dim_id}: dimensionId")
        _assert(df["municipalityId"] == PICADA_CAFE_ID, f"dim file {dim_id}: municipalityId")
        _assert(len(df["dimensionHistory"]) >= 5, f"dim {dim_id}: >= 5 history entries")
        for series in df["indicators"]:
            _assert(series["indicatorId"] in dim_catalog_ids, f"{series['indicatorId']} in catalog")
            for value in series["values"]:
                if value["isImputed"] is not None:
                    _assert(isinstance(value["isImputed"], bool), "isImputed boolean")
                if value["regionalMedianSampleSize"] is not None:
                    _assert(value["regionalMedianSampleSize"] > 0, "medianSampleSize > 0")

    # 7. Contagens especificas
    total_obs = sum(len(s["values"]) for dim_id, df in dim_files.items() for s in df["indicators"])
    total_medians = sum(
        1 for dim_id, df in dim_files.items()
        for s in df["indicators"]
        for v in s["values"]
        if v["regionalMedianScore"] is not None
    )
    total_median_all = sum(
        len(s["values"]) for dim_id, df in dim_files.items()
        for s in df["indicators"]
    )
    _assert(total_obs == 205, f"total observacoes: {total_obs}")
    if total_medians < total_median_all:  # Algumas medianas podem faltar
        print(f"  Medians: {total_medians}/{total_median_all} available")
    _assert(total_medians >= 200, f"medianas: {total_medians}")


# ---------------------------------------------------------------------------
# Orquestracao
# ---------------------------------------------------------------------------


def clean_sample_dir() -> None:
    if SAMPLE_DIR.exists():
        shutil.rmtree(SAMPLE_DIR)
    PUBLIC_DATA_DIR.mkdir(parents=True, exist_ok=True)


def main() -> int:
    print("Conectando ao Supabase remoto...")
    data = extract_all()
    print(f"  Anos: {data['all_years']}")
    print(f"  Regioes: {len(data['regions'])}")
    pc_summary = data["pc_all_summary"]
    print(f"  Picada Cafe: {len(pc_summary)} anos de resumo")
    print(f"  Indicadores: {len(data['pc_indicators'])} linhas")
    print(f"  Categoria historico: {len(data['pc_cat_hist'])} linhas")
    print(f"  Medianas RF3: {len(data['medians'])} linhas")
    print(f"  Classificacao: {len(data['pc_classification'])} linhas")

    clean_sample_dir()

    catalog_data = build_catalog(data)
    regions_data = build_regions(data)
    ranking_data = build_regional_ranking(data)
    summary_data = build_municipality_summary(data)

    dim_files: dict[str, dict[str, Any]] = {}
    for dim_id in DIMENSION_IDS:
        dim_files[dim_id] = build_dimension_file(data, dim_id)

    manifest = build_manifest(data)

    # Validacao
    validate_all(manifest, catalog_data, regions_data, ranking_data, summary_data, dim_files)

    # Escrita
    write_json(PUBLIC_DATA_DIR / "manifest.json", manifest)
    write_json(SAMPLE_DIR / "catalog.json", envelope(catalog_data))
    write_json(SAMPLE_DIR / "regions" / f"{SAMPLE_YEAR}.json", envelope(regions_data))
    write_json(
        SAMPLE_DIR / "rankings" / str(SAMPLE_YEAR) / f"{region_slug(PICADA_CAFE_REGION_ID)}.json",
        envelope(ranking_data),
    )
    mun_dir = SAMPLE_DIR / "municipalities" / PICADA_CAFE_ID
    write_json(mun_dir / "summary.json", envelope(summary_data))
    for dim_id, df in dim_files.items():
        write_json(mun_dir / f"{dim_id}.json", envelope(df))

    # Pos-escrita
    written = [
        PUBLIC_DATA_DIR / "manifest.json",
        SAMPLE_DIR / "catalog.json",
        SAMPLE_DIR / "regions" / f"{SAMPLE_YEAR}.json",
        SAMPLE_DIR / "rankings" / str(SAMPLE_YEAR) / f"{region_slug(PICADA_CAFE_REGION_ID)}.json",
        mun_dir / "summary.json",
    ]
    for dim_id in DIMENSION_IDS:
        written.append(mun_dir / f"{dim_id}.json")

    for p in written:
        _assert(p.exists(), f"nao gerado: {p.name}")
        with p.open(encoding="utf-8") as handle:
            payload = json.load(handle)
        if p.name != "manifest.json":
            _assert(payload.get("schemaVersion") == SCHEMA_VERSION, f"{p.name}: schemaVersion")
            _assert(payload.get("dataVersion") == DATA_VERSION, f"{p.name}: dataVersion")
        _check_banned(payload)
        _check_nan(payload)

    print(f"\nAmostra gerada em {SAMPLE_DIR}. {len(written)} arquivos.")
    for p in written:
        sz = p.stat().st_size
        print(f"  {p.relative_to(Path.cwd())} ({sz:,} bytes)")

    # Relatorio
    total_ind_obs = sum(len(s["values"]) for dim_id, df in dim_files.items() for s in df["indicators"])
    total_md = sum(
        1 for dim_id, df in dim_files.items()
        for s in df["indicators"]
        for v in s["values"]
        if v["regionalMedianScore"] is not None
    )
    print(f"\n--- Relatorio ---")
    print(f"  Catalog indicators: {len(catalog_data['indicators'])}")
    print(f"  Municipios no catalog: {len(catalog_data['municipalities'])}")
    print(f"  Regioes: {len(catalog_data['regions'])} / Coredes: {len(catalog_data['coredes'])}")
    print(f"  RF3 municipios (ranking): {ranking_data['municipalityCount']}")
    y2025_entry = next(y for y in summary_data['yearlySummaries'] if y['year'] == SAMPLE_YEAR)
    print(f"  Picada Cafe (2025): rank {y2025_entry['overallRank']}/49")
    print(f"  Picada Cafe corede: {summary_data['municipality']['coredeName']}")
    print(f"  Dimension files: {list(dim_files.keys())}")
    print(f"  Total observacoes indicador: {total_ind_obs}")
    print(f"  Total medianas: {total_md}")
    print(f"  Classification: {y2025_entry['classification']}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ValidationError as exc:
        print(f"ERRO DE VALIDACAO: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    except RuntimeError as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
