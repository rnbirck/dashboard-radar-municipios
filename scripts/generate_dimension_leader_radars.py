from __future__ import annotations

import argparse
import json
import math
import textwrap
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from PIL import Image, ImageDraw, ImageFont


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_ROOT = PROJECT_ROOT / "public" / "data" / "v2025"
RANKING_ROOT = DATA_ROOT / "rankings"
MUNICIPALITY_ROOT = DATA_ROOT / "municipalities"
EXPORT_ROOT = PROJECT_ROOT / "docs" / "exports" / "graficos 4"
RADAR_ROOT = EXPORT_ROOT / "radares"
CATALOG_PATH = DATA_ROOT / "catalog.json"

YEAR = 2025
CANVAS_WIDTH = 3000
CANVAS_HEIGHT = 2000
DPI = 300

REGULAR_FONT_PATH = Path(r"C:\Windows\Fonts\segoeui.ttf")
BOLD_FONT_PATH = Path(r"C:\Windows\Fonts\segoeuib.ttf")

COLORS = {
    "ink": "#142A41",
    "muted": "#52657A",
    "border": "#D8E2E9",
    "grid": "#D7E2E8",
    "axis": "#DCE6EB",
    "radar_background": "#EEF6F6",
    "teal": "#08716D",
    "teal_fill": (8, 106, 102, 46),
    "orange": "#B86F12",
    "orange_fill": (184, 111, 18, 18),
    "white": "#FFFFFF",
}

DIMENSIONS = (
    ("educacao", "educacao", "Educação"),
    ("financas", "financas", "Finanças"),
    ("meio_ambiente", "meioAmbiente", "Meio Ambiente"),
    ("saude", "saude", "Saúde"),
    ("seguranca", "seguranca", "Segurança"),
    ("socioeconomico", "socioeconomico", "Socioeconômico"),
)


@dataclass(frozen=True)
class LeaderRadar:
    region_number: int
    region_id: str
    region_name: str
    dimension_id: str
    dimension_rank_key: str
    dimension_name: str
    municipality_id: str
    municipality_name: str
    corede_name: str
    dimension_rank: int
    dimension_score: float | None
    indicators: tuple[dict[str, Any], ...]
    output_path: Path


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))["data"]


def load_catalog() -> dict[str, Any]:
    return load_json(CATALOG_PATH)


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    cleaned = "".join(
        character.lower() if character.isalnum() else "-"
        for character in ascii_value
    )
    return "-".join(part for part in cleaned.split("-") if part)


def indicator_label(metadata: dict[str, Any], indicator_id: str) -> str:
    name = metadata.get("name") or ""
    if name and len(name) <= 34:
        return name
    return metadata.get("shortName") or name or indicator_id


def year_value(
    values: Iterable[dict[str, Any]],
    year: int,
) -> dict[str, Any] | None:
    return next((item for item in values if item.get("year") == year), None)


def build_leader_radars(
    *,
    year: int = YEAR,
    region_numbers: Iterable[int] = range(1, 10),
    dimension_ids: Iterable[str] | None = None,
) -> list[LeaderRadar]:
    catalog = load_catalog()
    metadata_by_id = {
        item["id"]: item for item in catalog["indicators"]
    }
    selected_dimensions = {
        dimension_id for dimension_id in dimension_ids
    } if dimension_ids is not None else None
    records: list[LeaderRadar] = []

    for region_number in region_numbers:
        ranking = load_json(
            RANKING_ROOT / str(year) / f"rf{region_number}.json"
        )
        municipalities = ranking["municipalities"]

        for dimension_id, rank_key, dimension_name in DIMENSIONS:
            if (
                selected_dimensions is not None
                and dimension_id not in selected_dimensions
            ):
                continue

            ranked = [
                municipality
                for municipality in municipalities
                if municipality["dimensionRanks"].get(rank_key) is not None
            ]
            if not ranked:
                raise ValueError(
                    f"RF{region_number} {dimension_name}: sem ranking em {year}"
                )
            best_rank = min(
                int(item["dimensionRanks"][rank_key]) for item in ranked
            )
            leaders = [
                item
                for item in ranked
                if int(item["dimensionRanks"][rank_key]) == best_rank
            ]
            if best_rank != 1 or len(leaders) != 1:
                raise ValueError(
                    f"RF{region_number} {dimension_name}: "
                    f"esperado um líder na posição 1; encontrados "
                    f"{len(leaders)} na posição {best_rank}"
                )

            leader = leaders[0]
            dimension_data = load_json(
                MUNICIPALITY_ROOT
                / leader["municipalityId"]
                / f"{dimension_id}.json"
            )
            dimension_year = year_value(
                dimension_data["dimensionHistory"],
                year,
            )
            indicators: list[dict[str, Any]] = []
            for indicator in dimension_data["indicators"]:
                current = year_value(indicator["values"], year)
                if current is None:
                    raise ValueError(
                        f"{leader['municipalityName']} {dimension_name} "
                        f"{indicator['indicatorId']}: ano {year} ausente"
                    )
                metadata = metadata_by_id[indicator["indicatorId"]]
                indicators.append(
                    {
                        "indicator_id": indicator["indicatorId"],
                        "indicator_name": metadata.get("name")
                        or indicator["indicatorId"],
                        "indicator_short_name": metadata.get("shortName"),
                        "label": indicator_label(
                            metadata,
                            indicator["indicatorId"],
                        ),
                        "score": current.get("score"),
                        "regional_median_score": current.get(
                            "regionalMedianScore"
                        ),
                        "original_value": current.get("originalValue"),
                        "regional_median_original_value": current.get(
                            "regionalMedianOriginalValue"
                        ),
                        "regional_median_sample_size": current.get(
                            "regionalMedianSampleSize"
                        ),
                        "indicator_rank": current.get("rank"),
                        "is_imputed": current.get("isImputed"),
                        "unit": metadata.get("unit"),
                        "format": metadata.get("format"),
                        "decimal_places": metadata.get("decimalPlaces"),
                        "multiplier": metadata.get("multiplier"),
                        "direction": metadata.get("direction"),
                        "order": metadata.get("order"),
                    }
                )

            if len(indicators) < 3:
                raise ValueError(
                    f"{leader['municipalityName']} {dimension_name}: "
                    "menos de três indicadores para o radar"
                )
            for item in indicators:
                for value_key in ("score", "regional_median_score"):
                    value = item[value_key]
                    if value is not None and not 0 <= float(value) <= 10:
                        raise ValueError(
                            f"{leader['municipalityName']} {dimension_name} "
                            f"{item['indicator_id']}: {value_key}={value}"
                        )

            output_path = (
                RADAR_ROOT
                / f"rf{region_number}"
                / (
                    f"radar-rf{region_number}-{dimension_id}-"
                    f"{slugify(leader['municipalityName'])}-{year}.png"
                )
            )
            records.append(
                LeaderRadar(
                    region_number=region_number,
                    region_id=ranking["regionId"],
                    region_name=ranking["regionName"],
                    dimension_id=dimension_id,
                    dimension_rank_key=rank_key,
                    dimension_name=dimension_name,
                    municipality_id=leader["municipalityId"],
                    municipality_name=leader["municipalityName"],
                    corede_name=leader["coredeName"],
                    dimension_rank=best_rank,
                    dimension_score=(
                        dimension_year.get("score")
                        if dimension_year
                        else None
                    ),
                    indicators=tuple(indicators),
                    output_path=output_path,
                )
            )

    return records


def font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = BOLD_FONT_PATH if bold else REGULAR_FONT_PATH
    return ImageFont.truetype(str(path), size=size)


def regular_polygon_points(
    center: tuple[float, float],
    radius: float,
    count: int,
) -> list[tuple[float, float]]:
    return [
        (
            center[0]
            + math.cos(-math.pi / 2 + index * 2 * math.pi / count) * radius,
            center[1]
            + math.sin(-math.pi / 2 + index * 2 * math.pi / count) * radius,
        )
        for index in range(count)
    ]


def value_points(
    values: Iterable[float | None],
    center: tuple[float, float],
    radius: float,
) -> list[tuple[float, float]]:
    values_list = list(values)
    count = len(values_list)
    points: list[tuple[float, float]] = []
    for index, value in enumerate(values_list):
        bounded = 0.0 if value is None else max(0.0, min(float(value), 10.0))
        distance = radius * bounded / 10.0
        angle = -math.pi / 2 + index * 2 * math.pi / count
        points.append(
            (
                center[0] + math.cos(angle) * distance,
                center[1] + math.sin(angle) * distance,
            )
        )
    return points


def draw_dashed_segment(
    draw: ImageDraw.ImageDraw,
    start: tuple[float, float],
    end: tuple[float, float],
    *,
    fill: str,
    width: int,
    dash: float = 24,
    gap: float = 16,
) -> None:
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    length = math.hypot(dx, dy)
    if length == 0:
        return
    ux = dx / length
    uy = dy / length
    distance = 0.0
    while distance < length:
        dash_end = min(distance + dash, length)
        draw.line(
            (
                start[0] + ux * distance,
                start[1] + uy * distance,
                start[0] + ux * dash_end,
                start[1] + uy * dash_end,
            ),
            fill=fill,
            width=width,
        )
        distance += dash + gap


def draw_dashed_polygon(
    draw: ImageDraw.ImageDraw,
    points: list[tuple[float, float]],
    *,
    fill: str,
    width: int,
) -> None:
    for index, start in enumerate(points):
        draw_dashed_segment(
            draw,
            start,
            points[(index + 1) % len(points)],
            fill=fill,
            width=width,
        )


def wrap_label(value: str, indicator_count: int) -> list[str]:
    width = 20 if indicator_count >= 8 else 23
    lines = textwrap.wrap(
        value,
        width=width,
        break_long_words=False,
        break_on_hyphens=False,
    )
    return lines or [value]


def draw_label(
    draw: ImageDraw.ImageDraw,
    lines: list[str],
    position: tuple[float, float],
    center_x: float,
    label_font: ImageFont.FreeTypeFont,
) -> None:
    spacing = 8
    line_boxes = [draw.textbbox((0, 0), line, font=label_font) for line in lines]
    line_heights = [box[3] - box[1] for box in line_boxes]
    total_height = sum(line_heights) + spacing * (len(lines) - 1)
    top = position[1] - total_height / 2

    for line, box, line_height in zip(lines, line_boxes, line_heights):
        text_width = box[2] - box[0]
        if position[0] < center_x - 90:
            x = position[0] - text_width
        elif position[0] > center_x + 90:
            x = position[0]
        else:
            x = position[0] - text_width / 2
        draw.text(
            (round(x), round(top)),
            line,
            font=label_font,
            fill=COLORS["ink"],
        )
        top += line_height + spacing


def composite_polygon_fill(
    image: Image.Image,
    points: list[tuple[float, float]],
    fill: tuple[int, int, int, int],
) -> None:
    overlay = Image.new("RGBA", image.size, (255, 255, 255, 0))
    overlay_draw = ImageDraw.Draw(overlay)
    overlay_draw.polygon(points, fill=fill)
    image.alpha_composite(overlay)


def format_scale(value: float) -> str:
    if value.is_integer():
        return str(int(value))
    return str(value).replace(".", ",")


def render_radar(record: LeaderRadar) -> Path:
    record.output_path.parent.mkdir(parents=True, exist_ok=True)
    image = Image.new(
        "RGBA",
        (CANVAS_WIDTH, CANVAS_HEIGHT),
        COLORS["white"],
    )
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle(
        (3, 3, CANVAS_WIDTH - 4, CANVAS_HEIGHT - 4),
        radius=34,
        outline=COLORS["border"],
        width=4,
        fill=COLORS["white"],
    )
    draw.rounded_rectangle(
        (3, 3, CANVAS_WIDTH - 4, 18),
        radius=8,
        fill="#9FC8C4",
    )

    header_font = font(78, bold=True)
    subtitle_font = font(56, bold=True)
    draw.text(
        (110, 72),
        f"RF{record.region_number} · {record.dimension_name.upper()}",
        font=header_font,
        fill=COLORS["ink"],
    )
    draw.text(
        (110, 174),
        (
            f"{record.municipality_name} — "
            f"{record.dimension_rank}º lugar em {YEAR}"
        ),
        font=subtitle_font,
        fill=COLORS["teal"],
    )
    draw.line(
        (110, 276, CANVAS_WIDTH - 110, 276),
        fill=COLORS["border"],
        width=3,
    )

    center = (CANVAS_WIDTH / 2, 1010.0)
    radius = 520.0
    labels_radius = 705.0
    count = len(record.indicators)

    outer = regular_polygon_points(center, radius, count)
    composite_polygon_fill(image, outer, (238, 246, 246, 124))
    draw = ImageDraw.Draw(image)

    for ratio in (0.25, 0.5, 0.75, 1.0):
        grid_points = regular_polygon_points(center, radius * ratio, count)
        draw.line(
            grid_points + [grid_points[0]],
            fill=COLORS["grid"],
            width=3,
            joint="curve",
        )
    for endpoint in outer:
        draw.line((center, endpoint), fill=COLORS["axis"], width=3)

    comparison_values = [
        item["regional_median_score"] for item in record.indicators
    ]
    municipality_values = [item["score"] for item in record.indicators]
    comparison_points = value_points(comparison_values, center, radius)
    municipality_points = value_points(municipality_values, center, radius)

    composite_polygon_fill(image, comparison_points, COLORS["orange_fill"])
    composite_polygon_fill(image, municipality_points, COLORS["teal_fill"])
    draw = ImageDraw.Draw(image)
    draw_dashed_polygon(
        draw,
        comparison_points,
        fill=COLORS["orange"],
        width=7,
    )
    draw.line(
        municipality_points + [municipality_points[0]],
        fill=COLORS["teal"],
        width=9,
        joint="curve",
    )

    for points, values, outline, point_radius, stroke_width in (
        (
            comparison_points,
            comparison_values,
            COLORS["orange"],
            14,
            6,
        ),
        (
            municipality_points,
            municipality_values,
            COLORS["teal"],
            16,
            7,
        ),
    ):
        for point, value in zip(points, values):
            if value is None:
                continue
            draw.ellipse(
                (
                    point[0] - point_radius,
                    point[1] - point_radius,
                    point[0] + point_radius,
                    point[1] + point_radius,
                ),
                fill=COLORS["white"],
                outline=outline,
                width=stroke_width,
            )

    scale_font = font(32, bold=True)
    for value in (2.5, 5.0, 7.5, 10.0):
        y = center[1] - radius * value / 10.0
        draw.text(
            (center[0] + 18, y + 8),
            format_scale(value),
            font=scale_font,
            fill="#718192",
        )

    label_font = font(42, bold=True)
    label_positions = regular_polygon_points(center, labels_radius, count)
    for position, indicator in zip(label_positions, record.indicators):
        draw_label(
            draw,
            wrap_label(indicator["label"], count),
            position,
            center[0],
            label_font,
        )

    legend_font = font(42, bold=True)
    legend_items = (
        (
            record.municipality_name,
            COLORS["teal"],
            COLORS["teal_fill"],
        ),
        (
            "Mediana da Região Funcional",
            COLORS["orange"],
            COLORS["orange_fill"],
        ),
    )
    legend_widths = []
    for label, _, _ in legend_items:
        bbox = draw.textbbox((0, 0), label, font=legend_font)
        legend_widths.append(46 + 24 + bbox[2] - bbox[0])
    gap = 140
    total_width = sum(legend_widths) + gap
    legend_x = (CANVAS_WIDTH - total_width) / 2
    legend_y = 1850
    for (label, outline, fill), item_width in zip(
        legend_items,
        legend_widths,
    ):
        fill_rgb = (*fill[:3], 70)
        overlay = Image.new("RGBA", image.size, (255, 255, 255, 0))
        overlay_draw = ImageDraw.Draw(overlay)
        overlay_draw.rounded_rectangle(
            (legend_x, legend_y, legend_x + 46, legend_y + 46),
            radius=7,
            fill=fill_rgb,
            outline=outline,
            width=5,
        )
        image.alpha_composite(overlay)
        draw = ImageDraw.Draw(image)
        draw.text(
            (legend_x + 70, legend_y - 4),
            label,
            font=legend_font,
            fill=COLORS["ink"],
        )
        legend_x += item_width + gap

    rgb_image = image.convert("RGB")
    rgb_image.save(record.output_path, format="PNG", dpi=(DPI, DPI))
    return record.output_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Gera radares dos líderes de cada dimensão por Região Funcional."
        )
    )
    parser.add_argument(
        "--region",
        type=int,
        choices=range(1, 10),
        action="append",
        help="Região Funcional a gerar; pode ser repetida.",
    )
    parser.add_argument(
        "--dimension",
        choices=[item[0] for item in DIMENSIONS],
        action="append",
        help="Dimensão a gerar; pode ser repetida.",
    )
    parser.add_argument("--year", type=int, default=YEAR)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    regions = args.region or list(range(1, 10))
    records = build_leader_radars(
        year=args.year,
        region_numbers=regions,
        dimension_ids=args.dimension,
    )
    for record in records:
        render_radar(record)
        print(
            f"RF{record.region_number} | {record.dimension_name} | "
            f"{record.municipality_name} | {record.output_path}"
        )
    print(f"Radares gerados: {len(records)}")


if __name__ == "__main__":
    main()
