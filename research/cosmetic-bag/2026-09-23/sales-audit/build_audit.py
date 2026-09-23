"""Join the 20 conflicting product IDs with UI evidence saved for this audit."""

import json
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path


BASE = Path(__file__).resolve().parent.parent
AUDIT = BASE / "sales-audit"
RAW = AUDIT / "raw"
OUTPUT = AUDIT / "normalized" / "sales_audit_20.json"


class TableCellParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.cells = []
        self.parts = None

    def handle_starttag(self, tag, attrs):
        if tag == "td":
            self.parts = []

    def handle_data(self, data):
        if self.parts is not None and data.strip():
            self.parts.append(data.strip())

    def handle_endtag(self, tag):
        if tag == "td" and self.parts is not None:
            self.cells.append(" ".join(self.parts))
            self.parts = None


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def parse_display_count(value):
    if not value:
        return None
    text = str(value).replace(",", "").replace("+", "")
    match = re.search(r"(\d+(?:\.\d+)?)\s*(万|[Kk])?", text)
    if not match:
        return None
    multiplier = 10000 if match.group(2) == "万" else 1000 if match.group(2) else 1
    return float(match.group(1)) * multiplier


def labelled_value(lines, label):
    try:
        return lines[lines.index(label) + 1]
    except (ValueError, IndexError):
        return None


def thunt_database(product_id):
    path = RAW / f"thunt_database_{product_id}.json"
    if not path.exists():
        return {"status": "not_searched"}
    data = read_json(path)
    result = data["result"]
    evidence = path.relative_to(BASE).as_posix()
    if not result["match"]:
        return {
            "status": "no_matching_result_with_default_filters",
            "searchedAt": data["capturedAt"],
            "evidence": evidence,
        }
    parser = TableCellParser()
    parser.feed(result["html"])
    cells = parser.cells
    if len(cells) < 8:
        return {"status": "parse_failed", "evidence": evidence}
    return {
        "status": "found",
        "searchedAt": data["capturedAt"],
        "dailySalesRaw": cells[3],
        "dailySales": parse_display_count(cells[3]),
        "weeklySalesRaw": cells[4],
        "weeklySales": parse_display_count(cells[4]),
        "monthlySalesRaw": cells[5],
        "monthlySales": parse_display_count(cells[5]),
        "totalSalesRaw": cells[6],
        "totalSales": parse_display_count(cells[6]),
        "listingDateRaw": cells[7] if cells[7] != "-" else None,
        "evidence": evidence,
    }


def thunt_detail(product_id):
    path = RAW / f"thunt_detail_{product_id}.json"
    if not path.exists():
        return {"status": "not_opened_detail_quota"}
    data = read_json(path)
    lines = data["visibleText"].splitlines()
    labels = {
        "daily": "日销量",
        "weekly": "周销量",
        "monthly": "月销量",
        "total": "总销量",
    }
    result = {
        "status": "captured",
        "capturedAt": data["capturedAt"],
        "url": data["url"],
        "listingDateRaw": next((x.split(":", 1)[1].strip() for x in lines if x.startswith("上架时间:")), None),
        "markedDelisted": "已下架" in lines,
        "evidence": path.relative_to(BASE).as_posix(),
    }
    for field, label in labels.items():
        raw = labelled_value(lines, label)
        result[field + "SalesRaw"] = raw
        result[field + "Sales"] = parse_display_count(raw)
    return result


def temu_detail(product_id, source_url):
    path = RAW / f"temu_detail_{product_id}.json"
    if not path.exists():
        return {"status": "missing_source_url" if not source_url else "not_attempted"}
    data = read_json(path)
    visible = data["visible"]
    if visible.get("blocked"):
        status, sale = "security_verification", None
    elif visible.get("soldOut"):
        status, sale = "sold_out_display_under_risk_control", None
    elif visible.get("primary"):
        status, sale = "product_sales_label_visible", visible["primary"]["label"]
    elif len(visible.get("sales", [])) == 1:
        status, sale = "product_sales_label_visible", visible["sales"][0]["label"]
    else:
        status, sale = "ambiguous_page", None
    return {
        "status": status,
        "capturedAt": data["capturedAt"],
        "url": data["url"],
        "productSalesRaw": sale,
        "productSales": parse_display_count(sale),
        "inventoryConclusion": "unavailable",
        "riskControlContext": "raw/user_report_temu_risk_control.json",
        "evidence": path.relative_to(BASE).as_posix(),
    }


def main():
    merged = read_json(BASE / "normalized" / "thunt_merged.json")
    shared = [record for record in merged if len(record["matchedQueries"]) == 2]
    assert len(shared) == 20
    items = []
    for record in shared:
        product_id = record["productId"]
        first = record["sourceValues"]["makeup bag"]
        second = record["sourceValues"]["cosmetic bag"]
        database = thunt_database(product_id)
        item = {
            "productId": product_id,
            "temuUrl": record["url"],
            "ranks": record["ranks"],
            "pluginSearch": {
                "makeupBag": {"sales": first["sales"], "capturedAt": first["capturedAt"]},
                "cosmeticBag": {"sales": second["sales"], "capturedAt": second["capturedAt"]},
            },
            "thuntDatabase": database,
            "thuntProductDetail": thunt_detail(product_id),
            "temuProductDetail": temu_detail(product_id, record["url"]),
        }
        if database["status"] == "found":
            item["databaseTotalEqualsPlugin"] = {
                "makeupBag": database["totalSales"] == first["sales"]["numeric"],
                "cosmeticBag": database["totalSales"] == second["sales"]["numeric"],
            }
        items.append(item)
    counts = {
        "thuntDatabase": dict(Counter(item["thuntDatabase"]["status"] for item in items)),
        "thuntProductDetail": dict(Counter(item["thuntProductDetail"]["status"] for item in items)),
        "temuProductDetail": dict(Counter(item["temuProductDetail"]["status"] for item in items)),
    }
    output = {
        "scope": "Twenty Temu IDs shared by makeup bag and cosmetic bag whose THunt extension sales differ",
        "generatedAt": datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds"),
        "count": len(items),
        "counts": counts,
        "items": items,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(counts, ensure_ascii=False))


if __name__ == "__main__":
    main()
