# pyrefly: ignore [missing-import]
import duckdb
import time
import os
import logging

os.makedirs('logs', exist_ok=True)
log_path = 'logs/metrics_generation.log'

with open(log_path, 'w', encoding='utf-8') as f:
    f.write(f"--- BI Metrics Generation Started at {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")

logging.basicConfig(
    filename=log_path,
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
    force=True
)

def run_metrics_generation():
    start_time = time.time()
    db_path = 'storage/db/mb_olap.db'
    
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"DuckDB database not found at {db_path}. Please run Phase 2 first.")
        
    logging.info(f"Connecting to DuckDB database at {db_path}...")
    conn = duckdb.connect(db_path)
    
    # 1. Financial Metrics View
    logging.info("Creating Fact_Financial_Metrics view...")
    conn.execute("""
    CREATE OR REPLACE VIEW Fact_Financial_Metrics AS
    SELECT
        f.*,
        p.MRP,
        p.RATE,
        CASE WHEN p.MRP = 0 THEN 0.0 ELSE f.NET_SALE_AMOUNT / p.MRP END AS NET_SALE_QUANTITY,
        f.NET_SALE_AMOUNT - f.NET_SALE_COGS_AMOUNT AS Gross_Profit,
        CASE WHEN f.NET_SALE_AMOUNT = 0 THEN 0.0 ELSE ((f.NET_SALE_AMOUNT - f.NET_SALE_COGS_AMOUNT) / f.NET_SALE_AMOUNT) * 100.0 END AS Gross_Margin_Pct,
        CASE WHEN f.NET_SALE_COGS_AMOUNT = 0 THEN 0.0 ELSE ((f.NET_SALE_AMOUNT - f.NET_SALE_COGS_AMOUNT) / f.NET_SALE_COGS_AMOUNT) * 100.0 END AS Markup_Pct,
        f.CLOSING_STOCK_QUANTITY * p.RATE AS Inventory_Cost,
        f.CLOSING_STOCK_QUANTITY * p.MRP AS Potential_Revenue,
        f.CLOSING_STOCK_AMOUNT AS Inventory_Worth
    FROM Fact_Inventory_Sales f
    JOIN Dim_Product p ON f.Product_ID = p.Product_ID;
    """)
    
    # 2. ABC Analysis Table
    logging.info("Generating Product_ABC_Classification table...")
    conn.execute("""
    CREATE OR REPLACE TABLE Product_ABC_Classification AS
    WITH Product_Revenue AS (
        SELECT
            Product_ID,
            SUM(NET_SALE_AMOUNT) AS Cumulative_Revenue
        FROM Fact_Inventory_Sales
        GROUP BY Product_ID
    ),
    Product_Ranks AS (
        SELECT
            Product_ID,
            Cumulative_Revenue,
            SUM(Cumulative_Revenue) OVER (ORDER BY Cumulative_Revenue DESC) AS Running_Total,
            SUM(Cumulative_Revenue) OVER () AS Total_Revenue
        FROM Product_Revenue
    ),
    Product_Pct AS (
        SELECT
            Product_ID,
            Cumulative_Revenue,
            CASE WHEN Total_Revenue = 0 THEN 0.0 ELSE (Running_Total / Total_Revenue) * 100.0 END AS Running_Pct
        FROM Product_Ranks
    )
    SELECT
        Product_ID,
        Cumulative_Revenue,
        CASE 
            WHEN Running_Pct <= 80.0 THEN 'Class A'
            WHEN Running_Pct <= 95.0 THEN 'Class B'
            ELSE 'Class C'
        END AS ABC_Class
    FROM Product_Pct;
    """)
    
    # 3. XYZ Analysis Table
    logging.info("Generating Product_XYZ_Classification table...")
    conn.execute("""
    CREATE OR REPLACE TABLE Product_XYZ_Classification AS
    WITH Monthly_Quantities AS (
        SELECT
            f.Product_ID,
            d.Year,
            d.Month,
            SUM(CASE WHEN p.MRP = 0 THEN 0.0 ELSE f.NET_SALE_AMOUNT / p.MRP END) AS Monthly_Qty
        FROM Fact_Inventory_Sales f
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        JOIN Dim_Date d ON f.Date_ID = d.Date_ID
        GROUP BY f.Product_ID, d.Year, d.Month
    ),
    Stats AS (
        SELECT
            Product_ID,
            AVG(Monthly_Qty) AS Avg_Qty,
            STDDEV_SAMP(Monthly_Qty) AS Stdev_Qty
        FROM Monthly_Quantities
        GROUP BY Product_ID
    )
    SELECT
        Product_ID,
        Avg_Qty,
        COALESCE(Stdev_Qty, 0.0) AS Stdev_Qty,
        CASE 
            WHEN Avg_Qty = 0 THEN 999.0 
            ELSE (COALESCE(Stdev_Qty, 0.0) / Avg_Qty) * 100.0 
        END AS CV_Pct,
        CASE 
            WHEN Avg_Qty = 0 THEN 'Class Z'
            WHEN (COALESCE(Stdev_Qty, 0.0) / Avg_Qty) * 100.0 <= 10.0 THEN 'Class X'
            WHEN (COALESCE(Stdev_Qty, 0.0) / Avg_Qty) * 100.0 <= 25.0 THEN 'Class Y'
            ELSE 'Class Z'
        END AS XYZ_Class
    FROM Stats;
    """)
    
    # 4. Stock Velocity Table (Dead Stock, Slow Moving, Fast Moving)
    logging.info("Generating Product_Stock_Velocity table...")
    conn.execute("""
    CREATE OR REPLACE TABLE Product_Stock_Velocity AS
    WITH DeadStockCheck AS (
        SELECT
            f.Product_ID,
            MIN(d.Date) AS Min_Date,
            MAX(d.Date) AS Max_Date,
            SUM(f.NET_SALE_AMOUNT) AS Total_Sales_Val
        FROM Fact_Inventory_Sales f
        JOIN Dim_Date d ON f.Date_ID = d.Date_ID
        WHERE f.CLOSING_STOCK_QUANTITY > 0
        GROUP BY f.Product_ID
        HAVING Total_Sales_Val = 0 AND DATEDIFF('day', Min_Date, Max_Date) >= 180
    ),
    Monthly_STR AS (
        SELECT
            f.Product_ID,
            AVG(
                CASE 
                    WHEN (f.OPENING_QUANTITY + f.GOODS_RECEIVE_QUANTITY) = 0 THEN 0.0 
                    ELSE ( (CASE WHEN p.MRP = 0 THEN 0.0 ELSE f.NET_SALE_AMOUNT / p.MRP END) / (f.OPENING_QUANTITY + f.GOODS_RECEIVE_QUANTITY) ) * 100.0 
                END
            ) AS Avg_STR
        FROM Fact_Inventory_Sales f
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        GROUP BY f.Product_ID
    )
    SELECT
        m.Product_ID,
        m.Avg_STR,
        CASE 
            WHEN m.Product_ID IN (SELECT Product_ID FROM DeadStockCheck) THEN 'Dead Stock'
            WHEN m.Avg_STR < 10.0 THEN 'Slow Moving'
            WHEN m.Avg_STR >= 40.0 THEN 'Fast Moving'
            ELSE 'Normal'
        END AS Velocity_Class
    FROM Monthly_STR m;
    """)
    
    # 5. Operational Stock Levels Table
    logging.info("Generating Product_Stock_Levels table...")
    conn.execute("""
    CREATE OR REPLACE TABLE Product_Stock_Levels AS
    WITH Dataset_Days AS (
        SELECT 
            DATEDIFF('day', MIN(Date), MAX(Date)) AS Total_Days,
            DATEDIFF('month', MIN(Date), MAX(Date)) + 1 AS Total_Months
        FROM Dim_Date
    ),
    Product_Sales_Stats AS (
        SELECT
            f.Product_ID,
            SUM(CASE WHEN p.MRP = 0 THEN 0.0 ELSE f.NET_SALE_AMOUNT / p.MRP END) AS Total_Sales_Qty,
            (SELECT Total_Days FROM Dataset_Days) AS Days,
            (SELECT Total_Months FROM Dataset_Days) AS Months
        FROM Fact_Inventory_Sales f
        JOIN Dim_Product p ON f.Product_ID = p.Product_ID
        GROUP BY f.Product_ID
    ),
    Product_Daily_Monthly_Demand AS (
        SELECT
            Product_ID,
            CASE WHEN Days = 0 THEN 0.0 ELSE Total_Sales_Qty / Days END AS ADSQ,
            CASE WHEN Months = 0 THEN 0.0 ELSE Total_Sales_Qty / Months END AS AMD
        FROM Product_Sales_Stats
    ),
    Latest_Product_Snapshot AS (
        SELECT
            f.Product_ID,
            f.CLOSING_STOCK_QUANTITY,
            ROW_NUMBER() OVER (PARTITION BY f.Product_ID ORDER BY d.Date DESC) AS rn
        FROM Fact_Inventory_Sales f
        JOIN Dim_Date d ON f.Date_ID = d.Date_ID
    )
    SELECT
        s.Product_ID,
        s.CLOSING_STOCK_QUANTITY,
        d.ADSQ,
        d.AMD,
        CASE 
            WHEN s.CLOSING_STOCK_QUANTITY <= (d.ADSQ * 14.0) THEN 'Understock'
            WHEN s.CLOSING_STOCK_QUANTITY > (d.AMD * 3.0) THEN 'Overstock'
            ELSE 'Normal'
        END AS Stock_Level_Status
    FROM Latest_Product_Snapshot s
    JOIN Product_Daily_Monthly_Demand d ON s.Product_ID = d.Product_ID
    WHERE s.rn = 1;
    """)
    
    conn.close()
    
    elapsed = time.time() - start_time
    msg = f"Phase 3 BI Metrics Generation completed successfully in {elapsed:.2f} seconds."
    print(msg)
    logging.info(msg)

if __name__ == "__main__":
    run_metrics_generation()
