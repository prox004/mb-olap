from typing import List, Dict

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

templates = [

# ==========================
# QUERY 1
# ==========================

{
"id":"SALES_001",
"question":"Which is the best-selling product?",
"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    SUM(f.NET_SALE_AMOUNT) Revenue
FROM Fact_Financial_Metrics f
JOIN Dim_Product p ON f.Product_ID=p.Product_ID
GROUP BY p.ICODE,p.DESC1
ORDER BY Revenue DESC
LIMIT 1;
"""
},

{
"id":"SALES_001_DIVISION",
"question":"Which is the best-selling product in {Division}?",
"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    SUM(f.NET_SALE_AMOUNT) Revenue
FROM Fact_Financial_Metrics f
JOIN Dim_Product p ON f.Product_ID=p.Product_ID
JOIN Dim_Organization o ON f.Org_ID=o.Org_ID
WHERE o.Division='{Division}'
GROUP BY p.ICODE,p.DESC1
ORDER BY Revenue DESC
LIMIT 1;
""",
"expand":"Division"
},

{
"id":"SALES_001_SECTION",
"question":"Which is the best-selling product in {Section}?",
"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    SUM(f.NET_SALE_AMOUNT) Revenue
FROM Fact_Financial_Metrics f
JOIN Dim_Product p ON f.Product_ID=p.Product_ID
JOIN Dim_Organization o ON f.Org_ID=o.Org_ID
WHERE o.Section='{Section}'
GROUP BY p.ICODE,p.DESC1
ORDER BY Revenue DESC
LIMIT 1;
""",
"expand":"Section"
},

{
"id":"SALES_001_DEPARTMENT",
"question":"Which is the best-selling product in {Department}?",
"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    SUM(f.NET_SALE_AMOUNT) Revenue
FROM Fact_Financial_Metrics f
JOIN Dim_Product p ON f.Product_ID=p.Product_ID
JOIN Dim_Organization o ON f.Org_ID=o.Org_ID
WHERE o.Department='{Department}'
GROUP BY p.ICODE,p.DESC1
ORDER BY Revenue DESC
LIMIT 1;
""",
"expand":"Department"
},

# ==========================
# QUERY 2
# ==========================

{
"id":"SALES_002",
"question":"Show top 10 best-selling products.",
"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    SUM(f.NET_SALE_AMOUNT) Revenue
FROM Fact_Financial_Metrics f
JOIN Dim_Product p ON f.Product_ID=p.Product_ID
GROUP BY p.ICODE,p.DESC1
ORDER BY Revenue DESC
LIMIT 10;
"""
},

# ==========================
# QUERY 3
# ==========================

{
"id":"SALES_003",
"question":"Which product generated the highest revenue?",
"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    SUM(f.NET_SALE_AMOUNT) Revenue
FROM Fact_Financial_Metrics f
JOIN Dim_Product p ON f.Product_ID=p.Product_ID
GROUP BY p.ICODE,p.DESC1
ORDER BY Revenue DESC
LIMIT 1;
"""
},

# ==========================
# QUERY 4
# ==========================

{
"id":"SALES_004",
"question":"Which product sold maximum quantity?",
"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    SUM(f.NET_SALE_QUANTITY) Qty
FROM Fact_Financial_Metrics f
JOIN Dim_Product p ON f.Product_ID=p.Product_ID
GROUP BY p.ICODE,p.DESC1
ORDER BY Qty DESC
LIMIT 1;
"""
},

# ==========================
# QUERY 5
# ==========================

{
"id":"SALES_005",
"question":"Which department sells the most?",
"sql":"""
SELECT
    o.Department,
    SUM(f.NET_SALE_AMOUNT) Revenue
FROM Fact_Financial_Metrics f
JOIN Dim_Organization o ON f.Org_ID=o.Org_ID
GROUP BY o.Department
ORDER BY Revenue DESC
LIMIT 1;
"""
},

# ==========================
# QUERY 6
# ==========================

{
"id":"SALES_006",
"question":"Which supplier sells the most?",
"sql":"""
SELECT
    s.PARTYNAME,
    SUM(f.NET_SALE_AMOUNT) Revenue
FROM Fact_Financial_Metrics f
JOIN Dim_Supplier s ON f.Supplier_ID=s.Supplier_ID
GROUP BY s.PARTYNAME
ORDER BY Revenue DESC
LIMIT 1;
"""
}

]


# ==========================
# QUERY 20
# ==========================

templates.append({

"id":"SALES_020",

"question":"Which new arrival is selling the fastest?",

"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    p.STOCKINDATE,
    SUM(f.NET_SALE_QUANTITY) AS Qty
FROM Fact_Financial_Metrics f
JOIN Dim_Product p
ON f.Product_ID=p.Product_ID
WHERE p.STOCKINDATE >= CURRENT_DATE - INTERVAL '30 day'
GROUP BY
    p.ICODE,
    p.DESC1,
    p.STOCKINDATE
ORDER BY Qty DESC
LIMIT 1;
"""

})

# ==========================
# QUERY 21
# ==========================

templates.append({

"id":"TOP_021",

"question":"Show top 10 products.",

"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    SUM(f.NET_SALE_AMOUNT) Revenue
FROM Fact_Financial_Metrics f
JOIN Dim_Product p
ON f.Product_ID=p.Product_ID
GROUP BY
    p.ICODE,
    p.DESC1
ORDER BY Revenue DESC
LIMIT 10;
"""

})

# ==========================
# QUERY 22
# ==========================

templates.append({

"id":"TOP_022",

"question":"Show top 20 selling products.",

"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    SUM(f.NET_SALE_AMOUNT) Revenue
FROM Fact_Financial_Metrics f
JOIN Dim_Product p
ON f.Product_ID=p.Product_ID
GROUP BY
    p.ICODE,
    p.DESC1
ORDER BY Revenue DESC
LIMIT 20;
"""

})

# ==========================
# QUERY 25
# ==========================

templates.append({

"id":"TOP_025",

"question":"Which products haven't sold this month?",

"sql":"""
SELECT
    p.ICODE,
    p.DESC1
FROM Fact_Financial_Metrics f
JOIN Dim_Product p
ON f.Product_ID=p.Product_ID
GROUP BY
    p.ICODE,
    p.DESC1
HAVING SUM(f.NET_SALE_QUANTITY)=0;
"""

})

# ==========================
# QUERY 27
# ==========================

templates.append({

"id":"TOP_027",

"question":"Which products are slow moving?",

"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    v.Avg_STR,
    v.Velocity_Class
FROM Product_Stock_Velocity v
JOIN Dim_Product p
ON v.Product_ID=p.Product_ID
WHERE
    v.Velocity_Class='Slow'
ORDER BY
    v.Avg_STR;
"""

})

# ==========================
# QUERY 28
# ==========================

templates.append({

"id":"TOP_028",

"question":"Which products are fast moving?",

"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    v.Avg_STR,
    v.Velocity_Class
FROM Product_Stock_Velocity v
JOIN Dim_Product p
ON v.Product_ID=p.Product_ID
WHERE
    v.Velocity_Class='Fast'
ORDER BY
    v.Avg_STR DESC;
"""

})

# ==========================
# QUERY 29
# ==========================

templates.append({

"id":"TOP_029",

"question":"Which products sold out quickly?",

"supported":False,

"reason":"Transaction history unavailable."

})

# ==========================
# QUERY 30
# ==========================

templates.append({

"id":"TOP_030",

"question":"Which products need immediate restocking?",

"sql":"""
SELECT
    p.ICODE,
    p.DESC1,
    SUM(f.CLOSING_STOCK_QUANTITY) Stock
FROM Fact_Inventory_Sales f
JOIN Dim_Product p
ON f.Product_ID=p.Product_ID
GROUP BY
    p.ICODE,
    p.DESC1
HAVING
    SUM(f.CLOSING_STOCK_QUANTITY)<10
ORDER BY
    Stock;
"""

})

lookup = {
    "Division": DIVISIONS,
    "Section": SECTIONS,
    "Department": DEPARTMENTS
}

dataset = []

pid = 1

for t in templates:

    if "expand" not in t:

        dataset.append({
            "prompt_id": pid,
            "template_id": t["id"],
            "question": t["question"],
            "sql": t["sql"].strip()
        })

        pid += 1

    else:

        key = t["expand"]

        for value in lookup[key]:

            dataset.append({

                "prompt_id": pid,

                "template_id": t["id"],

                "question": t["question"].replace("{"+key+"}", value),

                "sql": t["sql"].replace("{"+key+"}", value).strip()

            })

            pid += 1

import json

with open("sales_part1.json","w",encoding="utf8") as f:
    json.dump(dataset,f,indent=4,ensure_ascii=False)

print(len(dataset))
print("Done")