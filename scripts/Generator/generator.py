import csv
import json
import os

# Define the category expansions
DIVISIONS = [
    "ACCESSORIES 1",
    "ACCESSORIES 2",
    "FABRICS & ACCESSORIES",
    "KIDS WEAR",
    "LADIES WEAR",
    "MENS WEAR",
    "NON TRADING DIVISION",
    "SALES PROMOTIONAL ITEMS",
    "WINTER GARMENTS"
]

SECTIONS = [
    "AD GIFT ITEMS",
    "BOYS WEAR",
    "CARRY BAGS",
    "COSMETICS",
    "CROCKERIES",
    "ELECTRICAL EQUIPMENT & FITTINGS",
    "FABRICS",
    "FOOTWEAR",
    "GIRLS WEAR",
    "HOME APPLIANCES",
    "HOME FURNISHINGS",
    "JEWELLERY",
    "KIDS ACCESSORIES",
    "LADIES ACCESSORIES",
    "LADIES ETHNIC",
    "LADIES WESTERN WEAR",
    "LUGGAGE POUCHES & LEATHER ITEMS",
    "MENS ACCESSORIES",
    "MENS LOWERS",
    "MENS SPORTS WEAR",
    "MENS UPPER WEAR",
    "MISC. MENS WEAR",
    "OTHER NON TRADING ITEMS",
    "PACKING & DISPLAY MATERIALS",
    "PLASTIC WARE",
    "SAREES",
    "STAFF UNIFORMS",
    "STATIONERIES",
    "TOILETORIES",
    "TOYS & GAMES",
    "WINTERWEAR BOYS",
    "WINTERWEAR GIRLS",
    "WINTERWEAR LADIES",
    "WINTERWEAR MENS"
]

DEPARTMENTS = [
    "OTHER ELECTRIC ACCESSORIES",
    "BLAZERS (B)",
    "SKIRTS",
    "ELECTRIC KETTLE",
    "BRA",
    "SKIRT-TOPS (G)",
    "TEXTILE THAN",
    "PAYJAMA (G)",
    "JACKETS [WL]",
    "STAFF JACKETS UF",
    "SHORT PANT",
    "LEGGINGS (G)",
    "POLY BAGS",
    "PENCILS",
    "GIRLS SETS [WG]",
    "CURTAIN & COVER",
    "T SHIRTS (G)",
    "BODY SPRAY",
    "TROUSERS (B)",
    "SOFT TOYS",
    "SHOES (L)",
    "JACKETS [WB]",
    "PARALLEL (G)",
    "STAFF SHIRTS UF",
    "SANDALS (M)",
    "COTTON SAREES",
    "HALF PANT (B)",
    "TUBELIGHT & LED LIGHTS",
    "ROOM FRESHNERS",
    "FROCKS (G)",
    "BLANKETS KIDS",
    "SHORT KURTI",
    "AD REGULAR GIFT ITEMS",
    "MASK",
    "SPORTS TOYS",
    "SHORT KURTA",
    "CAPRI",
    "FORMAL SHIRTS",
    "BABA SUITS [WB]",
    "KURTA PAYJAMA (B)",
    "T SHIRTS",
    "STOCKING",
    "WINTER TOPS [WL]",
    "SOAPS",
    "MODI & WAIST COAT",
    "T SHIRTS (B)",
    "PAYJAMA [WB]",
    "WALKING STICK",
    "BEDSHEETS",
    "SHAWL"
]

LOOKUP = {
    "Division": DIVISIONS,
    "Section": SECTIONS,
    "Department": DEPARTMENTS
}

THRESHOLDS = {
    "REORDER_LEVEL": "10",
    "MIN_STOCK": "5",
    "MAX_STOCK": "100",
    "MIN_MARGIN": "20",
    "HIGH_REVENUE": "50000",
    "LOW_PROFIT": "1000",
    "LOW_REVENUE": "10000",
    "HIGH_MARGIN": "50",
    "LOW_STOCK": "10",
    "UNDERSTOCK_LEVEL": "10",
    "OVERSTOCK_LEVEL": "100",
    "DISCONTINUE_STOCK": "10",
    "LOW_SALES": "5",
    "PROMOTION_MARGIN": "30",
    "HIGH_SALES": "50"
}

def replace_thresholds(sql_text: str) -> str:
    if not sql_text:
        return ""
    for k, v in THRESHOLDS.items():
        sql_text = sql_text.replace("{" + k + "}", v)
    return sql_text

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(base_dir, "template.csv")
    output_path = os.path.join(base_dir, "sales_part1.json")

    dataset = []
    pid = 1

    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            template_id = row.get("template_id", "").strip()
            # Skip header duplicates or empty rows
            if not template_id or template_id == "template_id":
                continue
            
            supported = row.get("supported", "").strip().lower() == "true"
            if not supported:
                continue

            question_template = row.get("question_template", "").strip()
            sql_template = row.get("sql_template", "").strip()
            expand_key = row.get("expand", "").strip()

            # Clean and process the templates
            sql_template = replace_thresholds(sql_template)

            if expand_key and expand_key in LOOKUP:
                for val in LOOKUP[expand_key]:
                    question = question_template.replace("{" + expand_key + "}", val)
                    sql = sql_template.replace("{" + expand_key + "}", val)
                    dataset.append({
                        "prompt_id": pid,
                        "template_id": template_id,
                        "question": question,
                        "sql": sql
                    })
                    pid += 1
            else:
                dataset.append({
                    "prompt_id": pid,
                    "template_id": template_id,
                    "question": question_template,
                    "sql": sql_template
                })
                pid += 1

    with open(output_path, "w", encoding="utf-8") as out_f:
        json.dump(dataset, out_f, indent=4, ensure_ascii=False)

    print(f"Generated {len(dataset)} queries in {output_path}")

    # Run the test queries
    run_test_queries(dataset, base_dir)

def run_test_queries(dataset, base_dir):
    import duckdb
    from datetime import date, datetime

    db_path = os.path.abspath(os.path.join(base_dir, "..", "..", "storage", "db", "mb_olap.db"))
    output_test_path = os.path.join(base_dir, "output.json")
    
    print(f"Connecting to database at {db_path} to test queries...")
    if not os.path.exists(db_path):
        print(f"Error: Database file not found at {db_path}")
        return

    try:
        conn = duckdb.connect(db_path, read_only=True)
    except Exception as e:
        print(f"Failed to connect to database: {e}")
        return

    test_results = []
    errors = []

    def json_serializable(val):
        if isinstance(val, (date, datetime)):
            return val.isoformat()
        return val

    for item in dataset:
        prompt_id = item["prompt_id"]
        sql = item["sql"]
        result_entry = {
            "prompt_id": prompt_id,
            "template_id": item["template_id"],
            "question": item["question"],
            "sql": sql,
            "status": "success",
            "results": [],
            "error_message": None
        }

        try:
            res = conn.execute(sql)
            if res.description:
                cols = [desc[0] for desc in res.description]
                rows = []
                for row in res.fetchall():
                    serialized_row = {cols[i]: json_serializable(row[i]) for i in range(len(cols))}
                    rows.append(serialized_row)
                result_entry["results"] = rows
        except Exception as e:
            err_msg = str(e)
            result_entry["status"] = "error"
            result_entry["error_message"] = err_msg
            errors.append({
                "prompt_id": prompt_id,
                "template_id": item["template_id"],
                "sql": sql,
                "error": err_msg
            })
            print(f"Query ERROR [Prompt ID {prompt_id}]: {err_msg}")

        test_results.append(result_entry)

    conn.close()

    with open(output_test_path, "w", encoding="utf-8") as out_f:
        json.dump(test_results, out_f, indent=4, ensure_ascii=False)

    print(f"Testing finished. Results saved to {output_test_path}")
    print(f"Total queries: {len(dataset)}, Successful: {len(dataset) - len(errors)}, Errors: {len(errors)}")

if __name__ == "__main__":
    main()

