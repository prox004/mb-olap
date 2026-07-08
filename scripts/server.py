# pyrefly: ignore [missing-import]
import re
import os
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
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
import polars as pl

app = FastAPI(title="Retail BI OLAP Engine API", version="1.0.0")

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
    gemini_key: Optional[str] = None

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
import difflib
from google import genai

# In-memory query cache pre-populated with standard requests
query_cache = {
    "which supplier generated the highest profit?": """
        SELECT sup.PARTYNAME AS Supplier, SUM(f.Gross_Profit) AS Total_Profit
        FROM Fact_Financial_Metrics f
        JOIN Dim_Supplier sup ON f.Supplier_ID = sup.Supplier_ID
        GROUP BY sup.PARTYNAME
        ORDER BY Total_Profit DESC
        LIMIT 10
    """,
    "show products with zero sales.": """
        SELECT p.ICODE, p.DESC1
        FROM Dim_Product p
        WHERE p.Product_ID NOT IN (
            SELECT DISTINCT Product_ID FROM Fact_Inventory_Sales WHERE NET_SALE_AMOUNT > 0
        )
        LIMIT 10
    """,
    "show inventory values exceeding 20 lakh": """
        SELECT p.ICODE, p.DESC1, SUM(f.Inventory_Worth) AS Total_Worth
        FROM Fact_Financial_Metrics f
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        GROUP BY p.ICODE, p.DESC1
        HAVING Total_Worth > 2000000
        ORDER BY Total_Worth DESC
    """
}

def find_cached_query(query: str, threshold: float = 0.85) -> Optional[str]:
    query_clean = query.strip().lower()
    best_match = None
    best_ratio = 0.0
    for cached_q, sql in query_cache.items():
        ratio = difflib.SequenceMatcher(None, query_clean, cached_q).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = sql
    if best_ratio >= threshold:
        return best_match
    return None

# System prompt with database schema metadata
SQL_GEN_SYSTEM_PROMPT = """You are an expert SQL engineer. Your task is to translate natural language user questions into read-only DuckDB SQL queries.
Return ONLY valid, executable DuckDB SQL. Do NOT include markdown code blocks, backticks, or any explanatory text. Simply return the raw SQL.

Important constraints:
- Only SELECT queries are allowed. Absolutely no DML operations (INSERT, UPDATE, DELETE, DROP, CREATE, ALTER) are allowed.
- The schema is:
  - Dim_Product (Product_ID INTEGER, ICODE VARCHAR, DESC1 VARCHAR, DESC2 VARCHAR, DESC3 VARCHAR, MRP DOUBLE, RATE DOUBLE, GENERATED VARCHAR, STOCKINDATE TIMESTAMP)
  - Dim_Supplier (Supplier_ID INTEGER, PARTYNAME VARCHAR)
  - Dim_Category (Category_ID INTEGER, "Category 1" VARCHAR, "Category 2" VARCHAR, "Category 3" VARCHAR, "Category 4" VARCHAR, "Category 5" VARCHAR, "Category 6" VARCHAR, GRP_REM VARCHAR)
  - Dim_Organization (Org_ID INTEGER, Division VARCHAR, Section VARCHAR, Department VARCHAR)
  - Dim_Store (Store_ID INTEGER, ADMSITE_CODE VARCHAR)
  - Dim_Date (Date_ID INTEGER, Date TIMESTAMP, Year INTEGER, Quarter INTEGER, Month INTEGER, MonthName VARCHAR, Day INTEGER, DayOfWeek INTEGER)
  - Fact_Inventory_Sales (Product_ID INTEGER, Supplier_ID INTEGER, Category_ID INTEGER, Org_ID INTEGER, Store_ID INTEGER, Date_ID INTEGER, OPENING_QUANTITY DOUBLE, OPENING_AMOUNT DOUBLE, GOODS_RECEIVE_QUANTITY DOUBLE, GOODS_RECEIVE_AMOUNT DOUBLE, GOODS_RETURN_QUANTITY DOUBLE, GOODS_RETURN_AMOUNT DOUBLE, SITE_TRANSFER_IN_QUANTITY DOUBLE, SITE_TRANSFER_IN_AMOUNT DOUBLE, SITE_TRANSFER_OUT_QUANTITY DOUBLE, SITE_TRANSFER_OUT_AMOUNT DOUBLE, CONVERSION_ISSUE_QUANTITY DOUBLE, CONVERSION_ISSUE_AMOUNT DOUBLE, CONVERSION_RECEIVE_QUANTITY DOUBLE, CONVERSION_RECEIVE_AMOUNT DOUBLE, NET_SALE_AMOUNT DOUBLE, NET_SALE_COGS_AMOUNT DOUBLE, ADJUSTMENT_QUANTITY DOUBLE, ADJUSTMENT_AMOUNT DOUBLE, MISC_ISSUE_RECEIVE_QUANTITY DOUBLE, MISC_ISSUE_RECEIVE_AMOUNT DOUBLE, CLOSING_STOCK_QUANTITY DOUBLE, CLOSING_STOCK_AMOUNT DOUBLE, CLOSING_TRANSIT_QUANTITY DOUBLE, CLOSING_TRANSIT_AMOUNT DOUBLE)
  - Fact_Financial_Metrics (View joining Fact_Inventory_Sales and Dim_Product containing all columns from Fact_Inventory_Sales plus MRP, RATE, NET_SALE_QUANTITY, Gross_Profit, Gross_Margin_Pct, Markup_Pct, Inventory_Cost, Potential_Revenue, Inventory_Worth)
  - Product_ABC_Classification (Product_ID INTEGER, Cumulative_Revenue DOUBLE, ABC_Class VARCHAR)
  - Product_XYZ_Classification (Product_ID INTEGER, Avg_Qty DOUBLE, Stdev_Qty DOUBLE, CV_Pct DOUBLE, XYZ_Class VARCHAR)
  - Product_Stock_Velocity (Product_ID INTEGER, Avg_STR DOUBLE, Velocity_Class VARCHAR)

Note: Always use correct DuckDB SQL syntax. When joining, match key IDs (e.g. JOIN Dim_Product p ON f.Product_ID = p.Product_ID). Column names with spaces like "Category 1" must be quoted using double quotes (cat."Category 1").
Limit returned records to a reasonable number (e.g. LIMIT 10) unless a specific count is asked."""

REPORT_GEN_SYSTEM_PROMPT = """You are a senior business intelligence and inventory analyst.
You will be given:
1. The user's natural language request.
2. The DuckDB SQL query that was run.
3. The raw tabular results from the query execution (represented in JSON format).

Please write a brief, executive word report summarizing these results. Keep it professional, conversational, and highly insightful.
Use clean markdown layout (e.g. simple headers, bold text, bullet points). Highlight key takeaways, anomalies, or important figures for the business. Keep the report brief (1-3 paragraphs or a few bullet points)."""

@app.post("/api/v1/ai/query")
def ai_semantic_query(req: AIQueryRequest):
    raw_query = req.query.strip()
    if not raw_query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
    
    # 1. Check fuzzy match cache
    sql = find_cached_query(raw_query)
    cache_hit = False
    
    if sql:
        cache_hit = True
    else:
        # Generate query using Gemini API
        api_key = req.gemini_key or os.environ.get("GEMINI_API_KEY")
        if not api_key:
            # Fallback to standard matching in case API key is not configured yet
            q = raw_query.lower()
            if "highest profit" in q or "top supplier" in q:
                sql = query_cache["which supplier generated the highest profit?"]
            elif "zero sales" in q or "no sales" in q:
                sql = query_cache["show products with zero sales."]
            elif "exceeding 20 lakh" in q or "exceeding 20" in q or "20 lakh" in q:
                sql = query_cache["show inventory values exceeding 20 lakh"]
            else:
                sql = """
                SELECT p.ICODE, p.DESC1, SUM(f.NET_SALE_AMOUNT) AS Sales
                FROM Fact_Financial_Metrics f
                JOIN Dim_Product p ON f.Product_ID = p.Product_ID
                GROUP BY p.ICODE, p.DESC1
                ORDER BY Sales DESC
                LIMIT 10
                """
        else:
            try:
                client = genai.Client(api_key=api_key)
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=raw_query,
                    config={"system_instruction": SQL_GEN_SYSTEM_PROMPT}
                )
                sql_response = response.text.strip()
                # Clean markdown styling if Gemini accidentally returned it
                if sql_response.startswith("```"):
                    sql_response = re.sub(r"^```sql\s*|^```\s*|```$", "", sql_response, flags=re.MULTILINE).strip()
                sql = sql_response
                # Save to cache
                query_cache[raw_query.lower()] = sql
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to generate SQL from Gemini: {str(e)}")

    # 2. Safety Check
    if not is_safe_sql(sql) or not is_safe_sql(raw_query):
        raise HTTPException(status_code=403, detail="Access Violation: Non-SELECT or modification query blocked.")
        
    conn = get_db()
    results_list = []
    try:
        res = conn.execute(sql).fetchall()
        cols = [desc[0] for desc in conn.description]
        results_list = [dict(zip(cols, row)) for row in res]
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"SQL Execution Error: {str(e)} (Generated Query: {sql})")
    finally:
        conn.close()

    # 3. Generate Report using Gemini API
    report = ""
    api_key = req.gemini_key or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        report = "### Executive Summary (Demo Mode - Gemini API Key Missing)\\n\\n"
        report += f"The query fetched **{len(results_list)} records** from the database. Enter your Gemini API Key in the Settings page to generate real-time AI-powered reports."
    else:
        try:
            client = genai.Client(api_key=api_key)
            prompt = f"User Request: {raw_query}\\nExecuted SQL: {sql}\\nTabular Data Results (JSON): {results_list[:50]}"
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config={"system_instruction": REPORT_GEN_SYSTEM_PROMPT}
            )
            report = response.text.strip()
        except Exception as e:
            report = f"### Executive Summary\\n\\nError generating report via Gemini: {str(e)}\\n\\nQuery retrieved {len(results_list)} rows successfully."

    return {
        "sql": sql,
        "results": results_list,
        "report": report,
        "cache_hit": cache_hit
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
