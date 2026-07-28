#!/usr/bin/env python3
"""Publica no catalogo as medianas estaduais calculadas dos JSONs municipais."""

from __future__ import annotations

import json
import math
import statistics
from collections import defaultdict
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DATA = PROJECT_ROOT / "public" / "data"


def read_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


def write_json(path: Path, content: dict[str, Any]) -> None:
    with path.open("w", encoding="utf-8", newline="\n") as file:
        json.dump(content, file, ensure_ascii=False, indent=2, allow_nan=False)
        file.write("\n")


def main() -> int:
    manifest = read_json(PUBLIC_DATA / "manifest.json")
    data_dir = PUBLIC_DATA / manifest["activeDataVersion"]
    catalog_path = data_dir / manifest["files"]["catalog"]
    catalog_payload = read_json(catalog_path)
    catalog = catalog_payload["data"]
    years = [int(year) for year in manifest["availableYears"]]
    values: dict[tuple[str, int], list[float]] = defaultdict(list)
    regional_values: dict[tuple[str, str, int], list[float]] = defaultdict(list)

    for municipality in catalog["municipalities"]:
        municipality_dir = data_dir / "municipalities" / municipality["id"]
        region_id = municipality["regionId"]
        for dimension in catalog["dimensions"]:
            payload = read_json(municipality_dir / f"{dimension['id']}.json")
            for indicator in payload["data"]["indicators"]:
                for row in indicator["values"]:
                    value = row.get("originalValue")
                    if isinstance(value, (int, float)) and math.isfinite(float(value)):
                        values[(indicator["indicatorId"], int(row["year"]))].append(float(value))
                        regional_values[(indicator["indicatorId"], region_id, int(row["year"]))].append(float(value))

    for indicator in catalog["indicators"]:
        indicator_id = indicator["id"]
        indicator["stateMedianOriginalValueByReferenceYear"] = {
            str(year): statistics.median(values[(indicator_id, year)])
            if values[(indicator_id, year)]
            else None
            for year in years
        }
        indicator["regionalMedianOriginalValueByRegionAndReferenceYear"] = {
            region["id"]: {
                str(year): statistics.median(regional_values[(indicator_id, region["id"], year)])
                if regional_values[(indicator_id, region["id"], year)]
                else None
                for year in years
            }
            for region in catalog["regions"]
        }

    expected_state = len(catalog["indicators"]) * len(years)
    actual_state = sum(
        len(indicator["stateMedianOriginalValueByReferenceYear"])
        for indicator in catalog["indicators"]
    )
    expected_regional = expected_state * len(catalog["regions"])
    actual_regional = sum(
        len(years_by_region)
        for indicator in catalog["indicators"]
        for years_by_region in indicator["regionalMedianOriginalValueByRegionAndReferenceYear"].values()
    )
    if actual_state != expected_state or actual_regional != expected_regional:
        raise RuntimeError(
            f"Medianas estaduais: {actual_state}/{expected_state}; "
            f"regionais: {actual_regional}/{expected_regional}"
        )

    write_json(catalog_path, catalog_payload)
    print(
        f"[OK] {actual_state} medianas estaduais e "
        f"{actual_regional} regionais publicadas em {catalog_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
