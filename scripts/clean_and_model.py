import os
import time
import glob
import logging
# pyrefly: ignore [missing-import]
import polars as pl
# pyrefly: ignore [missing-import]
import duckdb

# Enforce thread limit to keep memory bounded
os.environ["POLARS_MAX_THREADS"] = "2"

os.makedirs('logs', exist_ok=True)
os.makedirs('storage/gold', exist_ok=True)
os.makedirs('storage/db', exist_ok=True)

log_path = 'logs/data_cleaning.log'
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(f"--- Data Cleaning Run Started at {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")

logging.basicConfig(
    filename=log_path,
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
    force=True
)

def parse_date_col(col_name):
    # Vectorized attempt to parse dates with multiple formats
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%d-%b-%y",
        "%b-%d-%Y",
        "%m-%d-%Y %H:%M",
        "%Y-%m-%d",
        "%d-%m-%Y"
    ]
    exprs = []
    for fmt in formats:
        exprs.append(pl.col(col_name).str.to_datetime(fmt, strict=False))
    return pl.coalesce(exprs)

def run_cleaning_and_modeling():
    start_time = time.time()
    
    # 1. Load cached central fact and rename BARCODE to ICODE (as ICODE was dropped in the inner join)
    logging.info("Loading cached central fact...")
    df_lazy = pl.scan_parquet('storage/cache/central_fact.parquet').rename({"BARCODE": "ICODE"})
    
    # 2. String trimming, casing normalization, and Null Handlers
    # Text-based columns
    text_cols = [
        "Division", "Section", "Department", "GRP_REM", "PARTYNAME",
        "Category 1", "Category 2", "Category 3", "Category 4", "Category 5", "Category 6",
        "DESC1", "DESC2", "DESC3", "GENERATED"
    ]
    
    # Apply trim, uppercase, and fill nulls with "UNKNOWN"
    clean_exprs = []
    for col in text_cols:
        clean_exprs.append(
            pl.col(col)
            .str.strip_chars()
            .str.to_uppercase()
            .fill_null("UNKNOWN")
            .alias(col)
        )
        
    # Sales numeric columns (26 metrics)
    numeric_cols = [
        "OPENING_QUANTITY", "OPENING_AMOUNT", "GOODS_RECEIVE_QUANTITY", "GOODS_RECEIVE_AMOUNT",
        "GOODS_RETURN_QUANTITY", "GOODS_RETURN_AMOUNT", "SITE_TRANSFER_IN_QUANTITY", "SITE_TRANSFER_IN_AMOUNT",
        "SITE_TRANSFER_OUT_QUANTITY", "SITE_TRANSFER_OUT_AMOUNT", "CONVERSION_ISSUE_QUANTITY", "CONVERSION_ISSUE_AMOUNT",
        "CONVERSION_RECEIVE_QUANTITY", "CONVERSION_RECEIVE_AMOUNT", "NET_SALE_AMOUNT", "NET_SALE_COGS_AMOUNT",
        "ADJUSTMENT_QUANTITY", "ADJUSTMENT_AMOUNT", "MISC_ISSUE_RECEIVE_QUANTITY", "MISC_ISSUE_RECEIVE_AMOUNT",
        "CLOSING_STOCK_QUANTITY", "CLOSING_STOCK_AMOUNT", "CLOSING_TRANSIT_QUANTITY", "CLOSING_TRANSIT_AMOUNT",
        "MRP", "RATE"
    ]
    
    for col in numeric_cols:
        clean_exprs.append(
            pl.col(col)
            .cast(pl.Float64)
            .fill_null(0.0)
            .alias(col)
        )
        
    df_cleaned = df_lazy.with_columns(clean_exprs)
    
    # Datetime normalization
    df_cleaned = df_cleaned.with_columns([
        parse_date_col("START_DATE").alias("START_DATE"),
        parse_date_col("END_DATE").alias("END_DATE"),
        parse_date_col("STOCKINDATE").alias("STOCKINDATE")
    ])
    
    # 3. Deduplication on ICODE
    # Sort by STOCKINDATE ascending, so unique(subset="ICODE", keep="last") keeps the most recent one.
    logging.info("Sorting and deduplicating on ICODE...")
    df_dedup = (
        df_cleaned
        .sort("STOCKINDATE", descending=False, nulls_last=False)
        .unique(subset=["ICODE"], keep="last")
    )
    
    # Let's collect to execute deduplication count comparison
    df_collected = df_dedup.collect()
    original_row_count = pl.read_parquet('storage/cache/central_fact.parquet').shape[0]
    dedup_row_count = df_collected.shape[0]
    dropped_count = original_row_count - dedup_row_count
    
    msg = f"Deduplication complete: dropped {dropped_count} duplicate product records (kept most recent STOCKINDATE)."
    print(msg)
    logging.info(msg)
    
    # 4. Extract Dimensions
    # Assign surrogate keys (ID) via row indices.
    
    # Dim_Product: Product_ID. Attributes: ICODE, DESC1, DESC2, DESC3, MRP, RATE, GENERATED, STOCKINDATE.
    logging.info("Extracting Dim_Product...")
    dim_product = (
        df_collected
        .select(["ICODE", "DESC1", "DESC2", "DESC3", "MRP", "RATE", "GENERATED", "STOCKINDATE"])
        .unique(subset=["ICODE"])
        .with_row_index("Product_ID", offset=1)
    )
    dim_product.write_parquet('storage/gold/dim_product.parquet')
    
    # Dim_Supplier: Supplier_ID. Attributes: Unique PARTYNAME values.
    logging.info("Extracting Dim_Supplier...")
    dim_supplier = (
        df_collected
        .select("PARTYNAME")
        .unique()
        .with_row_index("Supplier_ID", offset=1)
    )
    dim_supplier.write_parquet('storage/gold/dim_supplier.parquet')
    
    # Dim_Category: Category_ID. Attributes: Category 1-6, GRP_REM.
    logging.info("Extracting Dim_Category...")
    dim_category = (
        df_collected
        .select(["Category 1", "Category 2", "Category 3", "Category 4", "Category 5", "Category 6", "GRP_REM"])
        .unique()
        .with_row_index("Category_ID", offset=1)
    )
    dim_category.write_parquet('storage/gold/dim_category.parquet')
    
    # Dim_Organization: Org_ID. Attributes: Division, Section, Department.
    logging.info("Extracting Dim_Organization...")
    dim_org = (
        df_collected
        .select(["Division", "Section", "Department"])
        .unique()
        .with_row_index("Org_ID", offset=1)
    )
    dim_org.write_parquet('storage/gold/dim_org.parquet')
    
    # Dim_Store: Store_ID. Attributes: Unique ADMSITE_CODE.
    logging.info("Extracting Dim_Store...")
    dim_store = (
        df_collected
        .select("ADMSITE_CODE")
        .unique()
        .with_row_index("Store_ID", offset=1)
    )
    dim_store.write_parquet('storage/gold/dim_store.parquet')
    
    # Dim_Date: Date_ID. Generate comprehensive date dim from START_DATE, END_DATE, and STOCKINDATE.
    logging.info("Extracting Dim_Date...")
    dates_union = pl.concat([
        df_collected.select(pl.col("START_DATE").alias("date")),
        df_collected.select(pl.col("END_DATE").alias("date")),
        df_collected.select(pl.col("STOCKINDATE").alias("date"))
    ]).drop_nulls().unique()
    
    min_date = dates_union.select(pl.col("date").min()).item()
    max_date = dates_union.select(pl.col("date").max()).item()
    
    # Generate date range using polars
    date_range_df = pl.date_range(
        start=min_date,
        end=max_date,
        interval="1d",
        eager=True
    ).alias("Date").to_frame()
    
    dim_date = date_range_df.select([
        pl.col("Date"),
        pl.col("Date").dt.year().alias("Year"),
        pl.col("Date").dt.quarter().alias("Quarter"),
        pl.col("Date").dt.month().alias("Month"),
        pl.col("Date").dt.strftime("%B").alias("MonthName"),
        pl.col("Date").dt.day().alias("Day"),
        pl.col("Date").dt.weekday().alias("DayOfWeek")
    ]).with_row_index("Date_ID", offset=1)
    
    dim_date.write_parquet('storage/gold/dim_date.parquet')
    
    # 5. Fact_Inventory_Sales
    logging.info("Assembling Fact_Inventory_Sales...")
    # Join with each dimension to map keys
    fact_sales = df_collected
    
    fact_sales = fact_sales.join(dim_product, on="ICODE", how="left")
    fact_sales = fact_sales.join(dim_supplier, on="PARTYNAME", how="left")
    fact_sales = fact_sales.join(dim_category, on=["Category 1", "Category 2", "Category 3", "Category 4", "Category 5", "Category 6", "GRP_REM"], how="left")
    fact_sales = fact_sales.join(dim_org, on=["Division", "Section", "Department"], how="left")
    fact_sales = fact_sales.join(dim_store, on="ADMSITE_CODE", how="left")
    
    # Map start date to Date_ID
    fact_sales = fact_sales.join(dim_date, left_on="START_DATE", right_on="Date", how="left")
    
    fact_cols = [
        "Product_ID", "Supplier_ID", "Category_ID", "Org_ID", "Store_ID", "Date_ID",
        "OPENING_QUANTITY", "OPENING_AMOUNT", "GOODS_RECEIVE_QUANTITY", "GOODS_RECEIVE_AMOUNT",
        "GOODS_RETURN_QUANTITY", "GOODS_RETURN_AMOUNT", "SITE_TRANSFER_IN_QUANTITY", "SITE_TRANSFER_IN_AMOUNT",
        "SITE_TRANSFER_OUT_QUANTITY", "SITE_TRANSFER_OUT_AMOUNT", "CONVERSION_ISSUE_QUANTITY", "CONVERSION_ISSUE_AMOUNT",
        "CONVERSION_RECEIVE_QUANTITY", "CONVERSION_RECEIVE_AMOUNT", "NET_SALE_AMOUNT", "NET_SALE_COGS_AMOUNT",
        "ADJUSTMENT_QUANTITY", "ADJUSTMENT_AMOUNT", "MISC_ISSUE_RECEIVE_QUANTITY", "MISC_ISSUE_RECEIVE_AMOUNT",
        "CLOSING_STOCK_QUANTITY", "CLOSING_STOCK_AMOUNT", "CLOSING_TRANSIT_QUANTITY", "CLOSING_TRANSIT_AMOUNT"
    ]
    
    fact_sales_final = fact_sales.select(fact_cols)
    fact_sales_final.write_parquet('storage/gold/fact_inventory_sales.parquet')
    
    logging.info("All gold Parquet files successfully written.")
    
    # 6. DuckDB Indexing Setup
    logging.info("Setting up DuckDB database and indexing...")
    db_path = 'storage/db/mb_olap.db'
    conn = duckdb.connect(db_path)
    
    tables = [
        "Dim_Product", "Dim_Supplier", "Dim_Category", 
        "Dim_Organization", "Dim_Store", "Dim_Date", "Fact_Inventory_Sales"
    ]
    for tbl in tables:
        conn.execute(f"DROP TABLE IF EXISTS {tbl};")
    
    conn.execute("CREATE TABLE Dim_Product AS SELECT * FROM 'storage/gold/dim_product.parquet';")
    conn.execute("CREATE TABLE Dim_Supplier AS SELECT * FROM 'storage/gold/dim_supplier.parquet';")
    conn.execute("CREATE TABLE Dim_Category AS SELECT * FROM 'storage/gold/dim_category.parquet';")
    conn.execute("CREATE TABLE Dim_Organization AS SELECT * FROM 'storage/gold/dim_org.parquet';")
    conn.execute("CREATE TABLE Dim_Store AS SELECT * FROM 'storage/gold/dim_store.parquet';")
    conn.execute("CREATE TABLE Dim_Date AS SELECT * FROM 'storage/gold/dim_date.parquet';")
    conn.execute("CREATE TABLE Fact_Inventory_Sales AS SELECT * FROM 'storage/gold/fact_inventory_sales.parquet';")
    
    # Create required primary/secondary lookups and indices
    conn.execute("CREATE UNIQUE INDEX idx_product_icode ON Dim_Product (ICODE);")
    conn.execute("CREATE INDEX idx_fact_product_id ON Fact_Inventory_Sales (Product_ID);")
    conn.execute("CREATE INDEX idx_org_division ON Dim_Organization (Division);")
    conn.execute("CREATE INDEX idx_org_section ON Dim_Organization (Section);")
    conn.execute("CREATE INDEX idx_org_dept ON Dim_Organization (Department);")
    conn.execute("CREATE INDEX idx_supplier_partyname ON Dim_Supplier (PARTYNAME);")
    
    conn.close()
    
    elapsed = time.time() - start_time
    msg_end = f"Phase 2 processing completed successfully in {elapsed:.2f} seconds."
    print(msg_end)
    logging.info(msg_end)

if __name__ == "__main__":
    run_cleaning_and_modeling()
