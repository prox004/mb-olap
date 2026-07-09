# pyrefly: ignore [missing-import]
import re
import os
import logging
import math
# pyrefly: ignore [missing-import]
# pyrefly: ignore [missing-import]
import duckdb
# pyrefly: ignore [missing-import]
import pandas as pd
# pyrefly: ignore [missing-import]
from typing import List
# pyrefly: ignore [missing-import]
from typing import Optional
# pyrefly: ignore [missing-import]
from fastapi import FastAPI
# pyrefly: ignore [missing-import]
from fastapi import HTTPException
# pyrefly: ignore [missing-import]
from fastapi import Query
# pyrefly: ignore [missing-import]
from fastapi import Response
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
import polars as pl
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

# Load environment variables from .env file (resolved from project root)
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

import json

ENTITY_EXTRACTION_SYSTEM_PROMPT = """Extract likely business/entity phrases from the user's retail analytics question.

Return JSON only in this exact shape:
{"entities":["phrase 1","phrase 2"]}

Rules:
- Extract only noun-like business/entity phrases that may need database matching.
- Include supplier names, brand/company names, category phrases, department/section/division phrases, product codes, product-type phrases, and short description-like product references.
- Do not include metric words like sales, profit, margin, top, bottom, highest, lowest, report, show.
- Keep phrases short and literal from the user's query.
- Maximum 5 phrases.
- If there are no likely entity phrases, return {"entities":[]}.
"""

def _nan_safe_json(obj):
    """Recursively replace NaN/Inf floats with None so JSON serialization never fails."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: _nan_safe_json(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_nan_safe_json(i) for i in obj]
    return obj

class NaNSafeJSONResponse(JSONResponse):
    """FastAPI response class that silently converts NaN/Inf to null."""
    def render(self, content) -> bytes:
        return json.dumps(
            _nan_safe_json(content),
            ensure_ascii=False,
            allow_nan=False,
            separators=(",", ":"),
        ).encode("utf-8")

app = FastAPI(title="Retail BI OLAP Engine API", version="1.0.0", default_response_class=NaNSafeJSONResponse)

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = 'storage/db/mb_olap.db'

def get_db():
    return duckdb.connect(DB_PATH)

# Request Models
class AIQueryRequest(BaseModel):
    query: str

# Helper: validate SQL
def is_safe_sql(sql: str) -> bool:
    forbidden = r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|TRUNCATE|GRANT|REVOKE)\b"
    if re.search(forbidden, sql, re.IGNORECASE):
        return False
    return True

# 1. Global Filters Options Endpoint
@app.get("/api/v1/filters")
def get_filter_options():
    conn = get_db()
    try:
        divisions = [r[0] for r in conn.execute("SELECT DISTINCT Division FROM Dim_Organization WHERE Division IS NOT NULL ORDER BY Division").fetchall()]
        sections = [r[0] for r in conn.execute("SELECT DISTINCT Section FROM Dim_Organization WHERE Section IS NOT NULL ORDER BY Section").fetchall()]
        departments = [r[0] for r in conn.execute("SELECT DISTINCT Department FROM Dim_Organization WHERE Department IS NOT NULL ORDER BY Department").fetchall()]
        suppliers = [r[0] for r in conn.execute("SELECT DISTINCT PARTYNAME FROM Dim_Supplier WHERE PARTYNAME IS NOT NULL ORDER BY PARTYNAME").fetchall()]
        stores = [r[0] for r in conn.execute("SELECT DISTINCT ADMSITE_CODE FROM Dim_Store WHERE ADMSITE_CODE IS NOT NULL ORDER BY ADMSITE_CODE").fetchall()]
        categories = [r[0] for r in conn.execute("SELECT DISTINCT \"Category 1\" FROM Dim_Category WHERE \"Category 1\" IS NOT NULL ORDER BY \"Category 1\"").fetchall()]
        
        # Min/Max dates
        dates = conn.execute("SELECT MIN(Date), MAX(Date) FROM Dim_Date").fetchone()
        
        return {
            "divisions": divisions,
            "sections": sections,
            "departments": departments,
            "suppliers": suppliers,
            "stores": stores,
            "categories": categories,
            "min_date": dates[0],
            "max_date": dates[1]
        }
    finally:
        conn.close()

# Helper: build SQL WHERE filters
def build_where_clause(
    divisions: Optional[List[str]] = None,
    sections: Optional[List[str]] = None,
    departments: Optional[List[str]] = None,
    suppliers: Optional[List[str]] = None,
    stores: Optional[List[str]] = None,
    categories: Optional[List[str]] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    min_mrp: Optional[float] = None,
    max_mrp: Optional[float] = None
):
    conditions = []
    params = []
    
    if divisions:
        conditions.append("org.Division IN (" + ",".join(["?"] * len(divisions)) + ")")
        params.extend(divisions)
    if sections:
        conditions.append("org.Section IN (" + ",".join(["?"] * len(sections)) + ")")
        params.extend(sections)
    if departments:
        conditions.append("org.Department IN (" + ",".join(["?"] * len(departments)) + ")")
        params.extend(departments)
    if suppliers:
        conditions.append("sup.PARTYNAME IN (" + ",".join(["?"] * len(suppliers)) + ")")
        params.extend(suppliers)
    if stores:
        conditions.append("st.ADMSITE_CODE IN (" + ",".join(["?"] * len(stores)) + ")")
        params.extend(stores)
    if categories:
        conditions.append("cat.\"Category 1\" IN (" + ",".join(["?"] * len(categories)) + ")")
        params.extend(categories)
    if start_date:
        conditions.append("dt.Date >= ?")
        params.append(start_date)
    if end_date:
        conditions.append("dt.Date <= ?")
        params.append(end_date)
    if min_mrp:
        conditions.append("p.MRP >= ?")
        params.append(min_mrp)
    if max_mrp:
        conditions.append("p.MRP <= ?")
        params.append(max_mrp)
        
    where = " AND ".join(conditions)
    return (" WHERE " + where) if where else "", params

# 2. Executive Dashboard KPIs
@app.get("/api/v1/analytics/dashboard-kpis")
def get_dashboard_kpis(
    division: Optional[List[str]] = Query(None),
    section: Optional[List[str]] = Query(None),
    department: Optional[List[str]] = Query(None),
    supplier: Optional[List[str]] = Query(None),
    store: Optional[List[str]] = Query(None),
    category: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    min_mrp: Optional[float] = Query(None),
    max_mrp: Optional[float] = Query(None)
):
    conn = get_db()
    try:
        where_clause, params = build_where_clause(
            division, section, department, supplier, store, category, start_date, end_date, min_mrp, max_mrp
        )
        
        # Build core query joining fact table with dimensions
        base_query = f"""
        FROM Fact_Financial_Metrics f
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        JOIN Dim_Supplier sup ON f.Supplier_ID = sup.Supplier_ID
        JOIN Dim_Category cat ON f.Category_ID = cat.Category_ID
        JOIN Dim_Organization org ON f.Org_ID = org.Org_ID
        JOIN Dim_Store st ON f.Store_ID = st.Store_ID
        JOIN Dim_Date dt ON f.Date_ID = dt.Date_ID
        {where_clause}
        """
        
        # Calculate primary KPI aggregations
        kpis = conn.execute(f"""
        SELECT
            COUNT(DISTINCT f.Product_ID) AS Total_Products,
            SUM(f.Inventory_Worth) AS Inventory_Value,
            SUM(f.NET_SALE_AMOUNT) AS Net_Sales,
            SUM(f.Gross_Profit) AS Gross_Profit,
            SUM(f.CLOSING_STOCK_QUANTITY) AS Closing_Stock_Qty,
            SUM(f.OPENING_QUANTITY) AS Opening_Stock_Qty,
            SUM(f.GOODS_RECEIVE_QUANTITY) AS Goods_Receive_Qty,
            SUM(f.GOODS_RETURN_QUANTITY) AS Goods_Return_Qty,
            SUM(f.SITE_TRANSFER_IN_QUANTITY) AS Site_Transfer_In_Qty,
            SUM(f.SITE_TRANSFER_OUT_QUANTITY) AS Site_Transfer_Out_Qty
        {base_query}
        """, params).fetchone()
        
        # Top Supplier, Category, Department
        top_supplier = conn.execute(f"""
        SELECT sup.PARTYNAME, SUM(f.NET_SALE_AMOUNT) AS Sales
        {base_query}
        GROUP BY sup.PARTYNAME ORDER BY Sales DESC LIMIT 1
        """, params).fetchone()
        
        top_category = conn.execute(f"""
        SELECT cat."Category 1", SUM(f.NET_SALE_AMOUNT) AS Sales
        {base_query}
        GROUP BY cat."Category 1" ORDER BY Sales DESC LIMIT 1
        """, params).fetchone()
        
        top_dept = conn.execute(f"""
        SELECT org.Department, SUM(f.NET_SALE_AMOUNT) AS Sales
        {base_query}
        GROUP BY org.Department ORDER BY Sales DESC LIMIT 1
        """, params).fetchone()
        
        # Dead, Slow, Fast moving counts
        velocity_stats = conn.execute(f"""
        SELECT vel.Velocity_Class, COUNT(DISTINCT vel.Product_ID)
        FROM Product_Stock_Velocity vel
        JOIN Fact_Financial_Metrics f ON vel.Product_ID = f.Product_ID
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        JOIN Dim_Supplier sup ON f.Supplier_ID = sup.Supplier_ID
        JOIN Dim_Category cat ON f.Category_ID = cat.Category_ID
        JOIN Dim_Organization org ON f.Org_ID = org.Org_ID
        JOIN Dim_Store st ON f.Store_ID = st.Store_ID
        JOIN Dim_Date dt ON f.Date_ID = dt.Date_ID
        {where_clause}
        GROUP BY vel.Velocity_Class
        """, params).fetchall()
        
        velocity_map = {row[0]: row[1] for row in velocity_stats}
        
        total_sales = kpis[2] or 0.0
        gross_profit = kpis[3] or 0.0
        margin_pct = (gross_profit / total_sales) * 100.0 if total_sales > 0 else 0.0
        
        return {
            "total_products": kpis[0] or 0,
            "inventory_value": kpis[1] or 0.0,
            "net_sales": total_sales,
            "gross_profit": gross_profit,
            "gross_margin_pct": margin_pct,
            "closing_stock_qty": kpis[4] or 0.0,
            "opening_stock_qty": kpis[5] or 0.0,
            "goods_receive_qty": kpis[6] or 0.0,
            "goods_return_qty": kpis[7] or 0.0,
            "site_transfer_in_qty": kpis[8] or 0.0,
            "site_transfer_out_qty": kpis[9] or 0.0,
            "top_supplier": top_supplier[0] if top_supplier else "N/A",
            "top_category": top_category[0] if top_category else "N/A",
            "top_department": top_dept[0] if top_dept else "N/A",
            "dead_stock_count": velocity_map.get("Dead Stock", 0),
            "slow_moving_count": velocity_map.get("Slow Moving", 0),
            "fast_moving_count": velocity_map.get("Fast Moving", 0)
        }
    finally:
        conn.close()

# 3. Sales Analytics Charts
@app.get("/api/v1/analytics/sales-charts")
def get_sales_charts(
    division: Optional[List[str]] = Query(None),
    section: Optional[List[str]] = Query(None),
    department: Optional[List[str]] = Query(None),
    supplier: Optional[List[str]] = Query(None),
    store: Optional[List[str]] = Query(None),
    category: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    min_mrp: Optional[float] = Query(None),
    max_mrp: Optional[float] = Query(None)
):
    conn = get_db()
    try:
        where_clause, params = build_where_clause(
            division, section, department, supplier, store, category, start_date, end_date, min_mrp, max_mrp
        )
        
        base_query = f"""
        FROM Fact_Financial_Metrics f
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        JOIN Dim_Supplier sup ON f.Supplier_ID = sup.Supplier_ID
        JOIN Dim_Category cat ON f.Category_ID = cat.Category_ID
        JOIN Dim_Organization org ON f.Org_ID = org.Org_ID
        JOIN Dim_Store st ON f.Store_ID = st.Store_ID
        JOIN Dim_Date dt ON f.Date_ID = dt.Date_ID
        {where_clause}
        """
        
        # Monthly trend
        monthly = conn.execute(f"""
        SELECT dt.Year, dt.MonthName, SUM(f.NET_SALE_AMOUNT) AS Sales, SUM(f.Gross_Profit) AS Profit
        {base_query}
        GROUP BY dt.Year, dt.Month, dt.MonthName ORDER BY dt.Year, dt.Month
        """, params).fetchall()
        
        monthly_data = [{"period": f"{r[1]} {r[0]}", "sales": r[2], "profit": r[3]} for r in monthly]
        
        # Category Rankings
        cat_ranking = conn.execute(f"""
        SELECT cat."Category 1", SUM(f.NET_SALE_AMOUNT) AS Sales
        {base_query}
        GROUP BY cat."Category 1" ORDER BY Sales DESC LIMIT 10
        """, params).fetchall()
        
        cat_ranking_data = [{"category": r[0], "sales": r[1]} for r in cat_ranking]
        
        # Supplier Rankings
        sup_ranking = conn.execute(f"""
        SELECT sup.PARTYNAME, SUM(f.NET_SALE_AMOUNT) AS Sales
        {base_query}
        GROUP BY sup.PARTYNAME ORDER BY Sales DESC LIMIT 10
        """, params).fetchall()
        
        sup_ranking_data = [{"supplier": r[0], "sales": r[1]} for r in sup_ranking]
        
        return {
            "monthly_trend": monthly_data,
            "category_rankings": cat_ranking_data,
            "supplier_rankings": sup_ranking_data
        }
    finally:
        conn.close()

# 4. Instant Fuzzy Search (< 50ms)
@app.get("/api/v1/search")
def instant_search(q: str = Query("", min_length=1)):
    # Cap fuzzy search for performance; using indexed prefix/substring matches
    conn = get_db()
    try:
        # Search against indices ICODE, PARTYNAME, and Category 1
        query_str = f"""
        SELECT 
            p.ICODE,
            p.DESC1,
            sup.PARTYNAME AS Supplier,
            cat."Category 1" AS Category,
            p.MRP,
            p.RATE
        FROM Dim_Product p
        LEFT JOIN Dim_Supplier sup ON p.RATE = p.RATE -- we join using Supplier matching logic if present, 
        -- but since Dim_Product does not directly hold Supplier_ID, we fetch PARTYNAME associated with the ICODE from cache/dim supplier
        -- Actually, we can fetch directly from Dim_Product JOINed with dim supplier via fact table grouping, or just query Dim_Product table:
        """
        # Let's write a simple direct fuzzy/substring matching query:
        search_pattern = f"%{q.upper()}%"
        res = conn.execute("""
        SELECT DISTINCT
            p.ICODE,
            p.DESC1,
            p.MRP,
            p.RATE
        FROM Dim_Product p
        WHERE p.ICODE LIKE ? OR UPPER(p.DESC1) LIKE ?
        LIMIT 10
        """, [search_pattern, search_pattern]).fetchall()
        
        results = [{"icode": r[0], "desc": r[1], "mrp": r[2], "rate": r[3]} for r in res]
        return {"results": results}
    finally:
        conn.close()

# 5. ML Forecasting Endpoint (Linear Trend + Weekly Seasonality Decomposition Model)
@app.get("/api/v1/analytics/forecast")
def demand_forecast(metric: str = "sales", horizon: int = 30):
    import datetime
    conn = get_db()
    try:
        # Pull daily historical data
        hist = conn.execute("""
        SELECT dt.Date, SUM(f.NET_SALE_AMOUNT) AS Sales, SUM(f.CLOSING_STOCK_QUANTITY) AS Stock
        FROM Fact_Financial_Metrics f
        JOIN Dim_Date dt ON f.Date_ID = dt.Date_ID
        GROUP BY dt.Date ORDER BY dt.Date
        """).fetchall()
        
        if not hist:
            return {"forecast": []}
            
        # Parse history
        dates = []
        values = []
        for row in hist:
            try:
                val_date = row[0]
                if isinstance(val_date, str):
                    d = datetime.datetime.strptime(val_date, "%Y-%m-%d").date()
                elif isinstance(val_date, datetime.datetime):
                    d = val_date.date()
                elif hasattr(val_date, "strftime"):
                    d = val_date
                else:
                    continue
                dates.append(d)
                val = float(row[1] if metric == "sales" else row[2])
                values.append(val)
            except Exception as e:
                continue
                
        n = len(values)
        if n == 0:
            return {"forecast": []}
            
        if n < 7:
            # Fallback to simple average if too little data
            avg = sum(values) / n
            forecast_list = []
            for i in range(1, horizon + 1):
                f_date = dates[-1] + datetime.timedelta(days=i)
                forecast_list.append({
                    "date": f_date.strftime("%Y-%m-%d"),
                    "predicted_value": round(avg, 2),
                    "lower_bound": round(max(0.0, avg * 0.8), 2),
                    "upper_bound": round(avg * 1.2, 2)
                })
            return {"metric": metric, "horizon": horizon, "forecast": forecast_list}

        # Fit Classical Decomposition Model (last 90 days)
        fit_n = min(n, 90)
        fit_values = values[-fit_n:]
        fit_dates = dates[-fit_n:]
        
        x = list(range(fit_n))
        mean_x = sum(x) / fit_n
        mean_y = sum(fit_values) / fit_n
        
        num = sum((x[i] - mean_x) * (fit_values[i] - mean_y) for i in range(fit_n))
        den = sum((x[i] - mean_x) ** 2 for i in range(fit_n))
        
        slope = num / den if den != 0 else 0
        intercept = mean_y - slope * mean_x
        
        # Calculate residuals and weekly seasonal factors
        seasonal_sums = [0.0] * 7
        seasonal_counts = [0] * 7
        residuals = []
        
        for i in range(fit_n):
            trend_val = slope * x[i] + intercept
            actual = fit_values[i]
            residuals.append(actual - trend_val)
            
            dow = fit_dates[i].weekday()  # Monday is 0, Sunday is 6
            ratio = actual / max(trend_val, 1.0)
            seasonal_sums[dow] += ratio
            seasonal_counts[dow] += 1
            
        seasonal_factors = [1.0] * 7
        for dow in range(7):
            if seasonal_counts[dow] > 0:
                seasonal_factors[dow] = seasonal_sums[dow] / seasonal_counts[dow]
                
        # Calculate standard deviation of residuals
        mean_res = sum(residuals) / fit_n
        var_res = sum((r - mean_res) ** 2 for r in residuals) / max(1, fit_n - 1)
        std_res = var_res ** 0.5
        
        # Project forecast
        last_date = dates[-1]
        forecast_list = []
        
        for i in range(1, horizon + 1):
            f_date = last_date + datetime.timedelta(days=i)
            dow = f_date.weekday()
            
            future_x = (fit_n - 1) + i
            trend_pred = max(0.0, slope * future_x + intercept)
            predicted = trend_pred * seasonal_factors[dow]
            
            # Uncertainty grows with time horizon
            uncertainty = std_res * (1 + (i / 15.0) ** 0.5)
            lower = max(0.0, predicted - 1.96 * uncertainty)
            upper = predicted + 1.96 * uncertainty
            
            forecast_list.append({
                "date": f_date.strftime("%Y-%m-%d"),
                "predicted_value": round(predicted, 2),
                "lower_bound": round(lower, 2),
                "upper_bound": round(upper, 2)
            })
            
        history_list = []
        hist_limit = min(n, 60)
        for i in range(n - hist_limit, n):
            history_list.append({
                "date": dates[i].strftime("%Y-%m-%d"),
                "value": round(values[i], 2)
            })
            
        return {
            "metric": metric,
            "horizon": horizon,
            "history": history_list,
            "forecast": forecast_list
        }
    finally:
        conn.close()

# 6. Read-Only Natural Language AI Gateway & Caching
GROQ_MODEL = "openai/gpt-oss-120b"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"

AI_SUGGESTIONS = [
    "Which supplier generated the highest profit?",
    "Show products with zero sales.",
    "Top 5 products by gross margin",
    "Show slow-moving products with closing stock value",
]

FALLBACK_SQL_BY_KEYWORD = {
    "highest_profit_supplier": """
        SELECT sup.PARTYNAME AS Supplier, SUM(f.Gross_Profit) AS Total_Profit
        FROM Fact_Financial_Metrics f
        JOIN Dim_Supplier sup ON f.Supplier_ID = sup.Supplier_ID
        GROUP BY sup.PARTYNAME
        ORDER BY Total_Profit DESC
        LIMIT 10
    """,
    "zero_sales_products": """
        SELECT p.ICODE
        FROM Dim_Product p
        WHERE p.Product_ID NOT IN (
            SELECT DISTINCT Product_ID FROM Fact_Inventory_Sales WHERE NET_SALE_AMOUNT > 0
        )
        LIMIT 10
    """,
    "inventory_value_over_20_lakh": """
        SELECT p.ICODE, SUM(f.Inventory_Worth) AS Total_Worth
        FROM Fact_Financial_Metrics f
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        GROUP BY p.ICODE
        HAVING Total_Worth > 2000000
        ORDER BY Total_Worth DESC
    """,
    "default_top_products_by_sales": """
        SELECT p.ICODE, SUM(f.NET_SALE_AMOUNT) AS Sales
        FROM Fact_Financial_Metrics f
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        GROUP BY p.ICODE
        ORDER BY Sales DESC
        LIMIT 10
    """,
}

def fix_union_order_by(sql: str) -> str:
    """
    DuckDB requires every UNION / UNION ALL branch that contains ORDER BY or LIMIT
    to be wrapped in parentheses. This function detects the pattern and fixes it
    automatically so AI-generated queries don't fail at execution time.
    """
    union_pattern = re.compile(
        r'(?i)(UNION\s+ALL|UNION)\s+(SELECT)',
    )
    if not union_pattern.search(sql):
        return sql  # no UNION – nothing to do

    # Split on UNION / UNION ALL boundaries (keep delimiter in tokens)
    tokens = re.split(r'(?i)(UNION\s+ALL|UNION)', sql)
    # tokens = [branch0, 'UNION ALL', branch1, 'UNION ALL', branch2, ...]
    fixed_parts = []
    for i, tok in enumerate(tokens):
        if re.match(r'(?i)UNION(\s+ALL)?', tok.strip()):
            fixed_parts.append(tok)
            continue
        branch = tok.strip()
        # Only wrap if it contains ORDER BY or LIMIT and isn't already parenthesized
        needs_wrap = re.search(r'(?i)(ORDER\s+BY|LIMIT)', branch)
        already_wrapped = branch.startswith('(') and branch.endswith(')')
        if needs_wrap and not already_wrapped:
            branch = f"({branch})"
        fixed_parts.append(branch)
    return '\n'.join(fixed_parts)

def get_groq_client(api_key: str):
    # pyrefly: ignore [missing-import]
    from openai import OpenAI

    return OpenAI(
        api_key=api_key,
        base_url=GROQ_BASE_URL,
    )

logger = logging.getLogger("nl2sql")

def generate_groq_text(client, prompt: str, system_prompt: str, temperature: float = 0.0) -> str:
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ],
        max_tokens=4096,
        temperature=temperature,   # deterministic SQL gen; report gen can use a slightly higher value if you want variety
        timeout=20,                # don't let the demo hang if Groq is slow
    )
    content = response.choices[0].message.content or ""
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    return content


def clean_sql(sql_response: str) -> str:
    """Strip markdown fences / stray prose the model sometimes adds despite instructions."""
    sql_response = sql_response.strip()
    if sql_response.startswith("```"):
        sql_response = re.sub(r"^```sql\s*|^```\s*|```$", "", sql_response, flags=re.MULTILINE).strip()
    # If the model added a trailing explanation after the query, cut it at the first ';' if present
    if ";" in sql_response:
        sql_response = sql_response.split(";")[0].strip()
    return sql_response


# ---------------------------------------------------------------------------
# System prompt with database schema metadata
# ---------------------------------------------------------------------------
SQL_GEN_SYSTEM_PROMPT = """DuckDB SQL expert. Translate natural language to a single read-only SELECT. Output raw SQL only — no markdown, backticks, or prose.
Rules: SELECT only. Aliases usable in HAVING/ORDER BY, not WHERE. Single quotes for strings, double quotes for identifiers with spaces. Always LIMIT unless user says otherwise.

Business glossary and synonym rule (IMPORTANT):
- vendor = supplier = PARTYNAME = Dim_Supplier
- brand may mean supplier or category; prefer supplier when the question sounds like a company/vendor, otherwise use the most relevant category level
- stock value = inventory value = closing inventory value
- revenue = sales = net sales = SUM(NET_SALE_AMOUNT)
- COGS = cost of goods sold = NET_SALE_COGS_AMOUNT
- profit = gross profit = SUM(NET_SALE_AMOUNT - NET_SALE_COGS_AMOUNT) = SUM(Gross_Profit) via Fact_Financial_Metrics
- margin = gross margin = Gross_Margin_Pct unless the user explicitly asks for markup
- barcode = SKU = product code = ICODE
- store = site = store code = ADMSITE_CODE

Metric definition rule (IMPORTANT):
- sales = SUM(NET_SALE_AMOUNT)
- gross_profit = SUM(NET_SALE_AMOUNT - NET_SALE_COGS_AMOUNT) or SUM(Gross_Profit) from Fact_Financial_Metrics
- gross_margin_pct = gross_profit / sales * 100, or use Gross_Margin_Pct from Fact_Financial_Metrics when aggregating appropriately
- inventory_value = SUM(CLOSING_STOCK_AMOUNT) or SUM(Inventory_Worth) from Fact_Financial_Metrics depending context
- closing_stock = SUM(CLOSING_STOCK_QUANTITY)
- opening_stock = SUM(OPENING_QUANTITY)
- goods_received = SUM(GOODS_RECEIVE_QUANTITY)
- goods_returned = SUM(GOODS_RETURN_QUANTITY)
- transfer_in = SUM(SITE_TRANSFER_IN_QUANTITY)
- transfer_out = SUM(SITE_TRANSFER_OUT_QUANTITY)

Product identity rule (IMPORTANT):
- Always SELECT p.ICODE as the product identifier whenever any product-level column (MRP, RATE, Sales, Profit, etc.) appears.
- DO NOT use p.DESC1 to name, filter, group, or search for products — it is blank for ~99% of rows and unreliable. Never put DESC1 in a WHERE clause to "find" a product by name.
- For any human-readable grouping of products (by "type", "category", "brand", "department", "line", etc.), use the business dimensions instead:
    cat."Category 1" ... cat."Category 6" (Dim_Category, broad → narrow)
    org.Division, org.Section, org.Department (Dim_Organization)
    sup.PARTYNAME (Dim_Supplier)
  Pick whichever of these best matches the wording of the question (e.g. "by brand" → supplier or Category; "by department" → org.Department).

Text matching and entity disambiguation rule (IMPORTANT):
- Natural-language names for suppliers, categories, divisions, sections, and departments are often partial, abbreviated, or missing legal/coded suffixes. Unless the user provides the exact full database value, prefer case-insensitive partial matching with UPPER(column) LIKE '%TERM%' instead of exact equality.
- For supplier-name questions, filter on sup.PARTYNAME. Do not assume a user-provided business fragment must equal the full PARTYNAME exactly.
- Tokens embedded inside supplier/category text can look like codes. If an alphanumeric token appears as part of a supplier/business name, treat it as part of the text value unless the user explicitly asks about stores or ADMSITE_CODE.
- Do not map supplier-name fragments or suffixes to st.ADMSITE_CODE. Only use Dim_Store / ADMSITE_CODE when the user explicitly asks about store/site/store code/site code.
- If the user gives only a distinctive fragment of a supplier/business name, use a PARTYNAME text filter built from the most distinctive fragment(s), for example UPPER(sup.PARTYNAME) LIKE '%FRAGMENT%'.
- When names contain punctuation, spaces, or embedded codes, prefer normalized matching such as REGEXP_REPLACE(UPPER(column), '[^A-Z0-9]+', '', 'g') LIKE '%NORMALIZEDTERM%' rather than assuming exact punctuation/spacing.

Data caveats and dataset reality rule (IMPORTANT):
- PARTYNAME values are messy business strings and may include legal suffixes, punctuation, numeric fragments, and embedded code-like suffixes.
- DESC1 is usually blank and is not a reliable product name. Prefer ICODE plus supplier/category/department context in both filtering and output.
- Store identifiers live in Dim_Store.ADMSITE_CODE. Do not infer store filters from arbitrary alphanumeric fragments unless the question is explicitly about stores/sites/store codes.
- NET_SALE_AMOUNT, NET_SALE_COGS_AMOUNT, stock amounts, MRP, and RATE are monetary/value fields in Indian Rupees.
- Gross profit can be positive, zero, or negative. Do not assume profit is always positive.
- Inventory and stock quantities can be zero. Zero-sales and dead-stock style questions are valid and should not be treated as errors.
- When a question asks for "top products of supplier X", treat it as a supplier filter plus product ranking, usually by sales unless another metric is explicitly named.

Ambiguity rule (IMPORTANT):
- If the question is incomplete or ambiguous (no time range, no explicit metric, vague scope like "best products" or "how are we doing"), do NOT refuse and do NOT ask a clarifying question — make the most reasonable default assumption and still produce a valid, runnable query.
  Defaults: metric = SUM(NET_SALE_AMOUNT) unless profit/margin is implied; time range = all available data unless a period is mentioned; N = 10 for "top/best/worst" with no number given.

Currency rule: all monetary values are in Indian Rupees. Never use $ or USD. Format amounts with the ₹ symbol in column aliases when helpful (e.g. "Sales_₹").

SCHEMA (join all facts to dims on surrogate _ID keys):
Dim_Product(Product_ID PK, ICODE varchar/*barcode/SKU — always SELECT this for any product query*/, DESC1 varchar/*mostly blank, do not rely on this*/, MRP double/*max retail price ₹*/, RATE double/*cost ₹*/, STOCKINDATE timestamp)
Dim_Supplier(Supplier_ID PK, PARTYNAME varchar/*vendor/brand name*/)
Dim_Category(Category_ID PK, "Category 1" varchar/*top*/, "Category 2", "Category 3", "Category 4", "Category 5", "Category 6", GRP_REM varchar)  -- always quote spaced cols: cat."Category 1"
Dim_Organization(Org_ID PK, Division, Section, Department varchar)
Dim_Store(Store_ID PK, ADMSITE_CODE varchar)
Dim_Date(Date_ID PK, Date timestamp, Year int, Quarter int, Month int, MonthName varchar, Day int, DayOfWeek int)

Fact_Inventory_Sales(Product_ID, Supplier_ID, Category_ID, Org_ID, Store_ID, Date_ID,  -- all FK to dims above
  OPENING_QUANTITY, OPENING_AMOUNT, GOODS_RECEIVE_QUANTITY, GOODS_RECEIVE_AMOUNT,
  GOODS_RETURN_QUANTITY, GOODS_RETURN_AMOUNT, SITE_TRANSFER_IN_QUANTITY, SITE_TRANSFER_IN_AMOUNT,
  SITE_TRANSFER_OUT_QUANTITY, SITE_TRANSFER_OUT_AMOUNT, ADJUSTMENT_QUANTITY, ADJUSTMENT_AMOUNT,
  MISC_ISSUE_RECEIVE_QUANTITY, MISC_ISSUE_RECEIVE_AMOUNT,
  NET_SALE_AMOUNT double/*primary sales KPI*/, NET_SALE_COGS_AMOUNT double,
  CLOSING_STOCK_QUANTITY, CLOSING_STOCK_AMOUNT, CLOSING_TRANSIT_QUANTITY, CLOSING_TRANSIT_AMOUNT  -- all double)

Fact_Financial_Metrics  -- VIEW = Fact_Inventory_Sales + Dim_Product extras. USE THIS for profit/margin/markup/inventory worth queries.
  Extra cols: NET_SALE_QUANTITY, Gross_Profit/*sale-cogs*/, Gross_Margin_Pct, Markup_Pct, Inventory_Cost/*qty*rate*/, Potential_Revenue/*qty*MRP*/, Inventory_Worth, MRP, RATE

Product_ABC_Classification(Product_ID, Cumulative_Revenue, ABC_Class varchar)  -- 'Class A'|'Class B'|'Class C'
Product_XYZ_Classification(Product_ID, Avg_Qty, Stdev_Qty, CV_Pct, XYZ_Class varchar)  -- 'Class X'|'Class Y'|'Class Z'
Product_Stock_Velocity(Product_ID, Avg_STR, Velocity_Class varchar)  -- 'Fast Moving'|'Normal'|'Slow Moving'


PATTERNS:
sales/revenue → SUM(NET_SALE_AMOUNT) | profit → SUM(Gross_Profit) via Fact_Financial_Metrics
top N → ORDER BY metric DESC LIMIT N | second best → LIMIT 1 OFFSET 1
"top products" / "best sellers" without a naming column → GROUP BY p.ICODE, cat."Category 1" (do not group by DESC1)
dead stock → Product_ID NOT IN (SELECT DISTINCT Product_ID FROM Fact_Inventory_Sales WHERE NET_SALE_AMOUNT>0)
date filter → JOIN Dim_Date d ON f.Date_ID=d.Date_ID WHERE d.Year=2024

DuckDB UNION rule: When using UNION ALL / UNION, each branch that has ORDER BY or LIMIT MUST be wrapped in parentheses.
Correct:  (SELECT ... ORDER BY x LIMIT 5) UNION ALL (SELECT ... ORDER BY x ASC LIMIT 5)
Wrong:    SELECT ... ORDER BY x LIMIT 5 UNION ALL SELECT ... ORDER BY x ASC LIMIT 5

EXAMPLES:
Q: second best supplier by sales
SELECT sup.PARTYNAME, SUM(f.NET_SALE_AMOUNT) AS Sales FROM Fact_Inventory_Sales f JOIN Dim_Supplier sup ON f.Supplier_ID=sup.Supplier_ID GROUP BY sup.PARTYNAME ORDER BY Sales DESC LIMIT 1 OFFSET 1

Q: top 5 products by profit
SELECT p.ICODE, cat."Category 1", SUM(f.Gross_Profit) AS Profit FROM Fact_Financial_Metrics f JOIN Dim_Product p ON f.Product_ID=p.Product_ID JOIN Dim_Category cat ON f.Category_ID=cat.Category_ID GROUP BY p.ICODE, cat."Category 1" ORDER BY Profit DESC LIMIT 5

Q: top 5 products of a supplier whose name was given partially
SELECT p.ICODE, SUM(f.NET_SALE_AMOUNT) AS Sales FROM Fact_Inventory_Sales f JOIN Dim_Product p ON f.Product_ID=p.Product_ID JOIN Dim_Supplier sup ON f.Supplier_ID=sup.Supplier_ID WHERE UPPER(sup.PARTYNAME) LIKE '%SUPPLIER_FRAGMENT%' GROUP BY p.ICODE ORDER BY Sales DESC LIMIT 5

Q: top products of a supplier whose name was typed without punctuation
SELECT p.ICODE, SUM(f.NET_SALE_AMOUNT) AS Sales FROM Fact_Inventory_Sales f JOIN Dim_Product p ON f.Product_ID=p.Product_ID JOIN Dim_Supplier sup ON f.Supplier_ID=sup.Supplier_ID WHERE REGEXP_REPLACE(UPPER(sup.PARTYNAME), '[^A-Z0-9]+', '', 'g') LIKE '%SUPPLIERNORMALIZED%' GROUP BY p.ICODE ORDER BY Sales DESC LIMIT 10

Q: top suppliers in ladies western wear
SELECT sup.PARTYNAME, SUM(f.NET_SALE_AMOUNT) AS Sales FROM Fact_Inventory_Sales f JOIN Dim_Supplier sup ON f.Supplier_ID=sup.Supplier_ID JOIN Dim_Organization org ON f.Org_ID=org.Org_ID WHERE UPPER(org.Section) LIKE '%LADIES WESTERN WEAR%' GROUP BY sup.PARTYNAME ORDER BY Sales DESC LIMIT 10

Q: best and worst 5 products by sales
WITH s AS (SELECT p.ICODE, cat."Category 1" AS Category, SUM(f.NET_SALE_AMOUNT) AS Sales FROM Fact_Inventory_Sales f JOIN Dim_Product p ON f.Product_ID=p.Product_ID JOIN Dim_Category cat ON f.Category_ID=cat.Category_ID GROUP BY p.ICODE, cat."Category 1")
(SELECT 'Best' AS Rank_Group, ICODE, Category, Sales FROM s ORDER BY Sales DESC LIMIT 5)
UNION ALL
(SELECT 'Worst' AS Rank_Group, ICODE, Category, Sales FROM s ORDER BY Sales ASC LIMIT 5)
"""

REPORT_GEN_SYSTEM_PROMPT = """You are a senior Business Intelligence and Inventory Analyst.

You will receive:
1. The user's question.
2. The SQL query.
3. The query results (JSON).

Write an executive business report.

Requirements:
- Use Markdown.
- Use short sections.
- Keep the report under 150 words.
- Base every statement strictly on the supplied data.
- If the data is empty, say plainly that no matching records were found and suggest the user broaden the filters — do not invent figures.
- Highlight important figures and rankings.
- Mention anomalies only if clearly supported.
- Refer to products by their ICODE and category/department/supplier, never by a blank or missing description field.

Currency Rules (MANDATORY):
- All monetary values are Indian Rupees.
- Always use the ₹ symbol.
- Never output $, USD, Dollar, Dollars, EUR, Euro or €.
- Never perform currency conversion.

Formatting:
- Use Indian number formatting.
- Use concise bullet points where appropriate."""


# ---------------------------------------------------------------------------
# Self-healing SQL generation: generate -> validate -> execute -> repair
# ---------------------------------------------------------------------------
MAX_SQL_ATTEMPTS = 3  # 1 initial + 2 repair attempts

def generate_and_run_sql(client, raw_query: str):
    """
    Returns (sql, results_list, error_or_None).
    Retries with the execution error fed back to the model if the first
    attempt produces invalid/failing SQL — this is what keeps advanced or
    slightly-off-schema questions from just breaking the demo outright.
    """
    sql = None
    last_error = None

    for attempt in range(MAX_SQL_ATTEMPTS):
        if attempt == 0:
            prompt = raw_query
        else:
            prompt = f"""Your previous SQL failed. Fix it and return ONLY the corrected raw SQL (no prose, no markdown).

Original question: {raw_query}
Previous SQL: {sql}
Database error: {last_error}
"""
        try:
            sql_response = generate_groq_text(client, prompt, SQL_GEN_SYSTEM_PROMPT)
        except Exception as e:
            last_error = f"Groq call failed: {e}"
            logger.warning("SQL generation attempt %d failed: %s", attempt, last_error)
            continue

        candidate_sql = fix_union_order_by(clean_sql(sql_response))

        # Safety check applies ONLY to the generated SQL, never to the user's free-text question
        if not is_safe_sql(candidate_sql):
            last_error = "Generated SQL failed the read-only safety check (must be a single SELECT statement)."
            logger.warning("Attempt %d rejected by safety check: %s", attempt, candidate_sql)
            sql = candidate_sql
            continue

        sql = candidate_sql
        conn = get_db()
        try:
            res = conn.execute(sql).fetchall()
            cols = [desc[0] for desc in conn.description]
            results_list = [dict(zip(cols, row)) for row in res]
            return sql, results_list, None
        except Exception as e:
            last_error = str(e)
            logger.warning("Attempt %d execution failed: %s | SQL: %s", attempt, last_error, sql)
            continue
        finally:
            conn.close()

    return sql, [], last_error


def normalize_entity_text(text: str) -> str:
    return re.sub(r"[^A-Z0-9]+", "", text.upper())


def should_attempt_zero_result_repair(raw_query: str) -> bool:
    q = raw_query.lower()
    explicit_zero_result_cases = [
        "zero sales",
        "no sales",
        "without sales",
        "dead stock",
        "not sold",
        "unsold",
    ]
    return not any(phrase in q for phrase in explicit_zero_result_cases)


def extract_entities_with_llm(client, raw_query: str) -> List[str]:
    try:
        response = generate_groq_text(client, raw_query, ENTITY_EXTRACTION_SYSTEM_PROMPT, temperature=0.0)
        payload = json.loads(response)
        entities = payload.get("entities", [])
        if not isinstance(entities, list):
            return []
        cleaned = []
        for entity in entities:
            if isinstance(entity, str):
                entity = entity.strip()
                if entity:
                    cleaned.append(entity)
        return cleaned[:5]
    except Exception as e:
        logger.warning("Entity extraction failed: %s", e)
        return []


def search_entity_candidates(entity_phrases: List[str], limit_per_phrase: int = 12) -> List[dict]:
    if not entity_phrases:
        return []

    candidates = []
    seen = set()
    conn = get_db()
    try:
        search_specs = [
            ("supplier", "Dim_Supplier", "PARTYNAME"),
            ("category", "Dim_Category", "\"Category 1\""),
            ("category", "Dim_Category", "\"Category 2\""),
            ("category", "Dim_Category", "\"Category 3\""),
            ("category", "Dim_Category", "\"Category 4\""),
            ("category", "Dim_Category", "\"Category 5\""),
            ("category", "Dim_Category", "\"Category 6\""),
            ("division", "Dim_Organization", "Division"),
            ("section", "Dim_Organization", "Section"),
            ("department", "Dim_Organization", "Department"),
            ("product_code", "Dim_Product", "ICODE"),
            ("product_text", "Dim_Product", "DESC1"),
        ]

        for phrase in entity_phrases:
            normalized_phrase = normalize_entity_text(phrase)
            if len(normalized_phrase) < 2:
                continue
            like_value = f"%{normalized_phrase}%"

            for entity_type, table_name, column_name in search_specs:
                sql = f"""
                SELECT DISTINCT {column_name} AS candidate
                FROM {table_name}
                WHERE {column_name} IS NOT NULL
                  AND {column_name} <> ''
                  AND REGEXP_REPLACE(UPPER({column_name}), '[^A-Z0-9]+', '', 'g') LIKE ?
                LIMIT ?
                """
                rows = conn.execute(sql, [like_value, limit_per_phrase]).fetchall()
                for row in rows:
                    value = row[0]
                    key = (entity_type, value)
                    if not value or key in seen:
                        continue
                    seen.add(key)
                    candidates.append(
                        {
                            "query_phrase": phrase,
                            "entity_type": entity_type,
                            "value": value,
                            "normalized_value": normalize_entity_text(str(value)),
                        }
                    )
    finally:
        conn.close()

    return candidates[:40]


def run_sql(sql: str):
    conn = get_db()
    try:
        res = conn.execute(sql).fetchall()
        cols = [desc[0] for desc in conn.description]
        return [dict(zip(cols, row)) for row in res], None
    except Exception as e:
        return [], str(e)
    finally:
        conn.close()


def attempt_zero_result_repair(client, raw_query: str, failed_sql: str):
    entity_phrases = extract_entities_with_llm(client, raw_query)
    if not entity_phrases:
        return failed_sql, [], None

    candidates = search_entity_candidates(entity_phrases)
    if not candidates:
        return failed_sql, [], None

    repair_prompt = f"""The previous SQL returned zero rows. Repair it and return ONLY corrected raw SQL.

Original question: {raw_query}
Previous SQL: {failed_sql}

Likely cause:
- The question contains noun/entity phrases that may not match the database exactly because of punctuation, spaces, abbreviations, legal suffixes, or embedded codes.

Detected entity phrases:
{json.dumps(entity_phrases, ensure_ascii=False)}

Candidate database matches:
{json.dumps(candidates, ensure_ascii=False)}

Repair rules:
- Preserve the user's original metric, ranking direction, and time intent.
- Fix only the entity matching/filter logic unless another obvious mistake exists.
- Prefer supplier/category/department/section/division matching over store-code matching unless the question explicitly asks about stores/sites/store codes.
- For punctuated or abbreviated business names, prefer normalized matching with REGEXP_REPLACE(UPPER(column), '[^A-Z0-9]+', '', 'g').
- If the question asks for products of a supplier/brand/company, rank products after applying the corrected supplier filter.
"""

    try:
        sql_response = generate_groq_text(client, repair_prompt, SQL_GEN_SYSTEM_PROMPT, temperature=0.0)
        repaired_sql = fix_union_order_by(clean_sql(sql_response))
    except Exception as e:
        logger.warning("Zero-result repair generation failed: %s", e)
        return failed_sql, [], None

    if not is_safe_sql(repaired_sql):
        logger.warning("Zero-result repair SQL rejected by safety check: %s", repaired_sql)
        return failed_sql, [], None

    repaired_results, repaired_error = run_sql(repaired_sql)
    if repaired_error:
        logger.warning("Zero-result repair SQL failed: %s | SQL: %s", repaired_error, repaired_sql)
        return failed_sql, [], None

    if not repaired_results:
        return failed_sql, [], None

    return repaired_sql, repaired_results, {
        "entity_phrases": entity_phrases,
        "candidates": candidates,
    }


@app.get("/api/v1/ai/suggestions")
def get_ai_suggestions():
    """Return static suggestion strings for frontend autocomplete."""
    return {"suggestions": AI_SUGGESTIONS}


@app.post("/api/v1/ai/query")
def ai_semantic_query(req: AIQueryRequest):
    raw_query = req.query.strip()
    if not raw_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    sql = None
    results_list = []
    exec_error = None
    zero_result_repair_meta = None

    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        # Fallback to basic keyword matching if the API key isn't configured
        q = raw_query.lower()
        if "highest profit" in q or "top supplier" in q:
            sql = FALLBACK_SQL_BY_KEYWORD["highest_profit_supplier"]
        elif "zero sales" in q or "no sales" in q:
            sql = FALLBACK_SQL_BY_KEYWORD["zero_sales_products"]
        elif "exceeding 20 lakh" in q or "exceeding 20" in q or "20 lakh" in q:
            sql = FALLBACK_SQL_BY_KEYWORD["inventory_value_over_20_lakh"]
        else:
            sql = FALLBACK_SQL_BY_KEYWORD["default_top_products_by_sales"]
        conn = get_db()
        try:
            res = conn.execute(sql).fetchall()
            cols = [desc[0] for desc in conn.description]
            results_list = [dict(zip(cols, row)) for row in res]
        except Exception as e:
            conn.close()
            raise HTTPException(status_code=500, detail=f"SQL Execution Error: {str(e)} (Generated Query: {sql})")
        finally:
            conn.close()
    else:
        try:
            client = get_groq_client(api_key)
            sql, results_list, exec_error = generate_and_run_sql(client, raw_query)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate SQL from Groq: {str(e)}")

        if exec_error:
            raise HTTPException(
                status_code=500,
                detail=f"Could not produce a working query for this question after {MAX_SQL_ATTEMPTS} attempts. "
                       f"Last error: {exec_error}"
            )

        if not results_list and should_attempt_zero_result_repair(raw_query):
            repaired_sql, repaired_results, repair_meta = attempt_zero_result_repair(client, raw_query, sql)
            if repaired_results:
                sql = repaired_sql
                results_list = repaired_results
                zero_result_repair_meta = repair_meta

    # 2. Generate Report
    report = ""
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        report = "### Executive Summary\n\n"
        report += f"The query fetched **{len(results_list)} records** from the database. Configure `GROQ_API_KEY` in your `.env` file to enable AI-powered report generation."
    elif not results_list:
        report = "### Executive Summary\n\nNo matching records were found for this query. Try widening the date range or removing a filter."
    else:
        try:
            client = get_groq_client(api_key)
            prompt = f"User Request: {raw_query}\nExecuted SQL: {sql}\nTabular Data Results (JSON): {results_list[:50]}"
            report = generate_groq_text(client, prompt, REPORT_GEN_SYSTEM_PROMPT, temperature=0.3)
        except Exception as e:
            report = f"### Executive Summary\n\nCould not generate the narrative report ({str(e)}), but the query itself succeeded and returned {len(results_list)} row(s) below."

    # Sanitize currency: replace any foreign currency symbols with ₹ regardless of LLM output
    report = re.sub(r"[$€£¥₩₽¢₫₪₴₦₱₲₵₡₭₮₸₺₼₾₿]", "₹", report)

    return {
        "sql": sql,
        "results": results_list,
        "report": report,
        "cache_hit": False,
        "zero_result_repair_used": zero_result_repair_meta is not None,
    }

# 7. Data Exports
@app.get("/api/v1/export/csv")
def export_csv():
    conn = get_db()
    try:
        df = conn.execute("SELECT * FROM Fact_Financial_Metrics LIMIT 5000").df()
        csv_data = df.to_csv(index=False)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=financial_metrics_export.csv"}
        )
    finally:
        conn.close()

# 8. Suppliers Detailed Analytics Endpoints
@app.get("/api/v1/analytics/suppliers")
def get_suppliers_analytics(
    division: Optional[List[str]] = Query(None),
    section: Optional[List[str]] = Query(None),
    department: Optional[List[str]] = Query(None),
    supplier: Optional[List[str]] = Query(None),
    store: Optional[List[str]] = Query(None),
    category: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    conn = get_db()
    try:
        where_clause, params = build_where_clause(
            division, section, department, supplier, store, category, start_date, end_date
        )
        base_query = f"""
        FROM Fact_Financial_Metrics f
        JOIN Dim_Supplier sup ON f.Supplier_ID = sup.Supplier_ID
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        JOIN Dim_Category cat ON f.Category_ID = cat.Category_ID
        JOIN Dim_Organization org ON f.Org_ID = org.Org_ID
        JOIN Dim_Store st ON f.Store_ID = st.Store_ID
        JOIN Dim_Date dt ON f.Date_ID = dt.Date_ID
        {where_clause}
        """

        # Best Selling and Lowest Selling Suppliers
        rankings = conn.execute(f"""
            SELECT 
                sup.PARTYNAME AS supplier,
                SUM(f.NET_SALE_AMOUNT) AS sales,
                SUM(f.Gross_Profit) AS profit,
                SUM(f.CLOSING_STOCK_QUANTITY) AS stock_qty,
                (SUM(f.Gross_Profit) / NULLIF(SUM(f.NET_SALE_AMOUNT), 0)) * 100.0 AS margin_pct,
                COUNT(DISTINCT f.Product_ID) AS sku_count,
                SUM(f.GOODS_RECEIVE_QUANTITY) AS receive_qty,
                SUM(f.GOODS_RETURN_QUANTITY) AS return_qty,
                (SUM(f.GOODS_RETURN_QUANTITY) / NULLIF(SUM(f.GOODS_RECEIVE_QUANTITY), 0)) * 100.0 AS return_rate_pct
            {base_query}
            GROUP BY sup.PARTYNAME
            ORDER BY sales DESC
        """, params).fetchall()

        cols = ["supplier", "sales", "profit", "stock_qty", "margin_pct", "sku_count", "receive_qty", "return_qty", "return_rate_pct"]
        rankings_list = [dict(zip(cols, r)) for r in rankings]

        # Top 5 best selling suppliers
        best_selling = rankings_list[:10]
        # Lowest selling (excluding zero sales)
        lowest_selling = [r for r in rankings_list if (r["sales"] or 0) > 0][-10:]
        lowest_selling.reverse()

        return {
            "all_suppliers": rankings_list,
            "best_selling": best_selling,
            "lowest_selling": lowest_selling
        }
    finally:
        conn.close()

@app.get("/api/v1/analytics/suppliers/top-products")
def get_supplier_top_products(partyname: str):
    conn = get_db()
    try:
        # Top 5 products of a specific supplier
        products = conn.execute("""
            SELECT 
                p.ICODE AS icode,
                p.DESC1 AS description,
                SUM(f.NET_SALE_AMOUNT) AS sales,
                SUM(f.NET_SALE_QUANTITY) AS qty
            FROM Fact_Financial_Metrics f
            JOIN Dim_Supplier sup ON f.Supplier_ID = sup.Supplier_ID
            JOIN Dim_Product p ON f.Product_ID = p.Product_ID
            WHERE sup.PARTYNAME = ?
            GROUP BY p.ICODE, p.DESC1
            ORDER BY sales DESC
            LIMIT 5
        """, [partyname]).fetchall()
        
        cols = ["icode", "description", "sales", "qty"]
        return {"products": [dict(zip(cols, r)) for r in products]}
    finally:
        conn.close()

# 9. Categories Detailed Analytics Endpoints
@app.get("/api/v1/analytics/categories")
def get_categories_analytics(
    division: Optional[List[str]] = Query(None),
    section: Optional[List[str]] = Query(None),
    department: Optional[List[str]] = Query(None),
    supplier: Optional[List[str]] = Query(None),
    store: Optional[List[str]] = Query(None),
    category: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    conn = get_db()
    try:
        where_clause, params = build_where_clause(
            division, section, department, supplier, store, category, start_date, end_date
        )
        base_query = f"""
        FROM Fact_Financial_Metrics f
        JOIN Dim_Category cat ON f.Category_ID = cat.Category_ID
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        JOIN Dim_Supplier sup ON f.Supplier_ID = sup.Supplier_ID
        JOIN Dim_Organization org ON f.Org_ID = org.Org_ID
        JOIN Dim_Store st ON f.Store_ID = st.Store_ID
        JOIN Dim_Date dt ON f.Date_ID = dt.Date_ID
        {where_clause}
        """

        # Best Selling and Lowest Selling Categories
        rankings = conn.execute(f"""
            SELECT 
                cat."Category 1" AS category,
                SUM(f.NET_SALE_AMOUNT) AS sales,
                SUM(f.Gross_Profit) AS profit,
                SUM(f.CLOSING_STOCK_QUANTITY) AS stock_qty,
                (SUM(f.Gross_Profit) / NULLIF(SUM(f.NET_SALE_AMOUNT), 0)) * 100.0 AS margin_pct,
                COUNT(DISTINCT f.Product_ID) AS sku_count,
                SUM(f.GOODS_RECEIVE_QUANTITY) AS receive_qty,
                SUM(f.GOODS_RETURN_QUANTITY) AS return_qty,
                (SUM(f.GOODS_RETURN_QUANTITY) / NULLIF(SUM(f.GOODS_RECEIVE_QUANTITY), 0)) * 100.0 AS return_rate_pct
            {base_query}
            GROUP BY cat."Category 1"
            ORDER BY sales DESC
        """, params).fetchall()

        cols = ["category", "sales", "profit", "stock_qty", "margin_pct", "sku_count", "receive_qty", "return_qty", "return_rate_pct"]
        rankings_list = [dict(zip(cols, r)) for r in rankings]

        # Top 10 best selling categories
        best_selling = rankings_list[:10]
        # Lowest selling (excluding zero sales)
        lowest_selling = [r for r in rankings_list if (r["sales"] or 0) > 0][-10:]
        lowest_selling.reverse()

        return {
            "all_categories": rankings_list,
            "best_selling": best_selling,
            "lowest_selling": lowest_selling
        }
    finally:
        conn.close()

@app.get("/api/v1/analytics/categories/top-products")
def get_category_top_products(category_name: str):
    conn = get_db()
    try:
        # Top 5 products of a specific category
        products = conn.execute("""
            SELECT 
                p.ICODE AS icode,
                p.DESC1 AS description,
                SUM(f.NET_SALE_AMOUNT) AS sales,
                SUM(f.NET_SALE_QUANTITY) AS qty
            FROM Fact_Financial_Metrics f
            JOIN Dim_Category cat ON f.Category_ID = cat.Category_ID
            JOIN Dim_Product p ON f.Product_ID = p.Product_ID
            WHERE cat."Category 1" = ?
            GROUP BY p.ICODE, p.DESC1
            ORDER BY sales DESC
            LIMIT 5
        """, [category_name]).fetchall()
        
        cols = ["icode", "description", "sales", "qty"]
        return {"products": [dict(zip(cols, r)) for r in products]}
    finally:
        conn.close()

# 10. Departments Detailed Analytics Endpoints
@app.get("/api/v1/analytics/departments")
def get_departments_analytics(
    division: Optional[List[str]] = Query(None),
    section: Optional[List[str]] = Query(None),
    department: Optional[List[str]] = Query(None),
    supplier: Optional[List[str]] = Query(None),
    store: Optional[List[str]] = Query(None),
    category: Optional[List[str]] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None)
):
    conn = get_db()
    try:
        where_clause, params = build_where_clause(
            division, section, department, supplier, store, category, start_date, end_date
        )
        base_query = f"""
        FROM Fact_Financial_Metrics f
        JOIN Dim_Organization org ON f.Org_ID = org.Org_ID
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        JOIN Dim_Supplier sup ON f.Supplier_ID = sup.Supplier_ID
        JOIN Dim_Category cat ON f.Category_ID = cat.Category_ID
        JOIN Dim_Store st ON f.Store_ID = st.Store_ID
        JOIN Dim_Date dt ON f.Date_ID = dt.Date_ID
        {where_clause}
        """

        # Best Selling and Lowest Selling Departments
        rankings = conn.execute(f"""
            SELECT 
                org.Department AS department,
                SUM(f.NET_SALE_AMOUNT) AS sales,
                SUM(f.Gross_Profit) AS profit,
                SUM(f.CLOSING_STOCK_QUANTITY) AS stock_qty,
                (SUM(f.Gross_Profit) / NULLIF(SUM(f.NET_SALE_AMOUNT), 0)) * 100.0 AS margin_pct,
                COUNT(DISTINCT f.Product_ID) AS sku_count,
                SUM(f.GOODS_RECEIVE_QUANTITY) AS receive_qty,
                SUM(f.GOODS_RETURN_QUANTITY) AS return_qty,
                (SUM(f.GOODS_RETURN_QUANTITY) / NULLIF(SUM(f.GOODS_RECEIVE_QUANTITY), 0)) * 100.0 AS return_rate_pct
            {base_query}
            GROUP BY org.Department
            ORDER BY sales DESC
        """, params).fetchall()

        cols = ["department", "sales", "profit", "stock_qty", "margin_pct", "sku_count", "receive_qty", "return_qty", "return_rate_pct"]
        rankings_list = [dict(zip(cols, r)) for r in rankings]

        # Top 10 best selling departments
        best_selling = rankings_list[:10]
        # Lowest selling (excluding zero sales)
        lowest_selling = [r for r in rankings_list if (r["sales"] or 0) > 0][-10:]
        lowest_selling.reverse()

        return {
            "all_departments": rankings_list,
            "best_selling": best_selling,
            "lowest_selling": lowest_selling
        }
    finally:
        conn.close()

@app.get("/api/v1/analytics/departments/top-products")
def get_department_top_products(department_name: str):
    conn = get_db()
    try:
        # Top 5 products of a specific department
        products = conn.execute("""
            SELECT 
                p.ICODE AS icode,
                p.DESC1 AS description,
                SUM(f.NET_SALE_AMOUNT) AS sales,
                SUM(f.NET_SALE_QUANTITY) AS qty
            FROM Fact_Financial_Metrics f
            JOIN Dim_Organization org ON f.Org_ID = org.Org_ID
            JOIN Dim_Product p ON f.Product_ID = p.Product_ID
            WHERE org.Department = ?
            GROUP BY p.ICODE, p.DESC1
            ORDER BY sales DESC
            LIMIT 5
        """, [department_name]).fetchall()
        
        cols = ["icode", "description", "sales", "qty"]
        return {"products": [dict(zip(cols, r)) for r in products]}
    finally:
        conn.close()

if __name__ == "__main__":
    # pyrefly: ignore [missing-import]
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
