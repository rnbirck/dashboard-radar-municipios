#!/usr/bin/env python3
"""
Backfill dos agregados anuais estaticos a partir dos summaries ja publicados.

Este utilitario nao acessa banco nem APIs externas. Ele usa os arquivos em
public/data/v2025/municipalities/*/summary.json para materializar os arquivos
regions/{year}.json e rankings/{year}/{region}.json que a UI carrega quando o
usuario troca o ano global.
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA = PROJECT_ROOT / "public" / "data"


def read_json(path: Path) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path, content: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(content, f, ensure_ascii=False, indent=2, allow_nan=False)
        f.write("\n")


def average(values: list[float | int | None]) -> float | None:
    numeric = [float(value) for value in values if isinstance(value, (int, float)) and math.isfinite(float(value))]
    if not numeric:
        return None
    return sum(numeric) / len(numeric)


def envelope(data: dict[str, Any], data_version: str, generated_at: str) -> dict[str, Any]:
    return {
        "schemaVersion": "1.0.0",
        "dataVersion": data_version,
        "generatedAt": generated_at,
        "data": data,
    }


def load_summary(data_dir: Path, municipality_id: str) -> dict[str, Any]:
    path = data_dir / "municipalities" / municipality_id / "summary.json"
    payload = read_json(path)
    return payload["data"]


def year_row(summary: dict[str, Any], year: int) -> dict[str, Any]:
    for row in summary["yearlySummaries"]:
        if row["year"] == year:
            return row
    raise RuntimeError(f"Municipio {summary['municipality']['id']} sem resumo de {year}")


def build_regions(
    year: int,
    summaries: list[dict[str, Any]],
    regions: list[dict[str, Any]],
    coredes_by_region: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    region_rows = []
    for region in sorted(regions, key=lambda item: item["order"]):
        region_id = region["id"]
        region_summaries = [item for item in summaries if item["municipality"]["regionId"] == region_id]
        coredes = sorted(coredes_by_region[region_id], key=lambda item: item["name"])
        scores = [year_row(item, year)["finalScore"] for item in region_summaries]

        region_rows.append({
            "id": region_id,
            "name": region["name"],
            "order": region["order"],
            "municipalityCount": len(region_summaries),
            "coredeCount": len(coredes),
            "coredeIds": [item["id"] for item in coredes],
            "coredeNames": [item["name"] for item in coredes],
            "averageFinalScore": average(scores),
        })

    return {
        "year": year,
        "totals": {
            "municipalities": len(summaries),
            "regions": len(regions),
            "coredes": sum(len(items) for items in coredes_by_region.values()),
        },
        "regions": region_rows,
    }


def build_ranking(
    year: int,
    region: dict[str, Any],
    region_summaries: list[dict[str, Any]],
) -> dict[str, Any]:
    entries = []
    for summary in region_summaries:
        municipality = summary["municipality"]
        row = year_row(summary, year)
        entries.append({
            "municipalityId": municipality["id"],
            "municipalityName": municipality["name"],
            "coredeId": municipality["coredeId"],
            "coredeName": municipality["coredeName"],
            "overallRank": row["overallRank"],
            "previousOverallRank": row["previousOverallRank"],
            "rankChange": row["rankChange"],
            "populationPerformance": row["classification"],
            "finalScore": row["finalScore"],
            "dimensionRanks": row["dimensionRanks"],
        })

    entries.sort(key=lambda item: (
        item["overallRank"] is None,
        item["overallRank"] if item["overallRank"] is not None else 10**9,
        item["municipalityName"],
    ))

    return {
        "year": year,
        "regionId": region["id"],
        "regionName": region["name"],
        "municipalityCount": len(entries),
        "municipalities": entries,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Backfill de aggregates anuais estaticos")
    parser.add_argument("--overwrite", action="store_true", help="reescreve tambem arquivos ja existentes")
    args = parser.parse_args()

    manifest = read_json(PUBLIC_DATA / "manifest.json")
    data_version = manifest["activeDataVersion"]
    generated_at = manifest["generatedAt"]
    years = [int(year) for year in manifest["availableYears"]]
    data_dir = PUBLIC_DATA / data_version

    catalog_payload = read_json(data_dir / manifest["files"]["catalog"])
    catalog = catalog_payload["data"]
    regions = catalog["regions"]
    municipalities = catalog["municipalities"]

    coredes_by_region: dict[str, list[dict[str, Any]]] = {region["id"]: [] for region in regions}
    for corede in catalog["coredes"]:
        coredes_by_region.setdefault(corede["regionId"], []).append(corede)

    summaries = [load_summary(data_dir, item["id"]) for item in municipalities]
    summaries_by_region: dict[str, list[dict[str, Any]]] = {region["id"]: [] for region in regions}
    for summary in summaries:
        summaries_by_region[summary["municipality"]["regionId"]].append(summary)

    written = 0
    skipped = 0

    for year in years:
        regions_path = data_dir / "regions" / f"{year}.json"
        if args.overwrite or not regions_path.exists():
            regions_data = build_regions(year, summaries, regions, coredes_by_region)
            write_json(regions_path, envelope(regions_data, data_version, generated_at))
            written += 1
        else:
            skipped += 1

        for region in regions:
            ranking_path = data_dir / "rankings" / str(year) / f"{region['id'].lower()}.json"
            if args.overwrite or not ranking_path.exists():
                ranking = build_ranking(year, region, summaries_by_region[region["id"]])
                write_json(ranking_path, envelope(ranking, data_version, generated_at))
                written += 1
            else:
                skipped += 1

    expected_region_files = len(years)
    expected_ranking_files = len(years) * len(regions)
    actual_region_files = len(list((data_dir / "regions").glob("*.json")))
    actual_ranking_files = len(list((data_dir / "rankings").glob("*/*.json")))

    if actual_region_files != expected_region_files:
        raise RuntimeError(f"regions: {actual_region_files} arquivos, esperado {expected_region_files}")
    if actual_ranking_files != expected_ranking_files:
        raise RuntimeError(f"rankings: {actual_ranking_files} arquivos, esperado {expected_ranking_files}")

    print(f"[OK] {written} arquivos escritos; {skipped} ja existiam.")
    print(f"[OK] regions: {actual_region_files}; rankings: {actual_ranking_files}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
