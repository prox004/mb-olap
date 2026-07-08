import os
import glob
import logging
import time

# Enforce thread limit to keep memory bounded under 512MB
os.environ["POLARS_MAX_THREADS"] = "2"

# pyrefly: ignore [missing-import]
import polars as pl

class DataPipelineSchemaException(Exception):
    pass

# Ensure directories exist
os.makedirs('logs', exist_ok=True)
os.makedirs('storage/cache', exist_ok=True)

# Setup logging
log_path = 'logs/data_pipeline.log'
# Clear/initialize the log file
with open(log_path, 'w', encoding='utf-8') as f:
    f.write(f"--- Data Pipeline Run Started at {time.strftime('%Y-%m-%d %H:%M:%S')} ---\n")

logging.basicConfig(
    filename=log_path,
    level=logging.INFO,
    format='%(asctime)s %(levelname)s: %(message)s',
    force=True
)

def run_ingestion():
    # 1. Discover files
    item_pattern = os.path.join('dataset', 'items', '*.csv')
    discovered_files = glob.glob(item_pattern)
    if not discovered_files:
        raise FileNotFoundError("No item CSV files found in dataset/items/")
    
    valid_files = []
    for filepath in discovered_files:
        filename = os.path.basename(filepath)
        try:
            size = os.path.getsize(filepath)
            if size == 0:
                msg = f"[WARN] File {filename} is empty. Skipping."
                print(msg)
                logging.warning(msg)
                continue
            valid_files.append(filepath)
        except OSError as e:
            logging.error(f"Error accessing file {filename}: {e}")
            raise

    if not valid_files:
        raise ValueError("No valid non-empty item files found.")

    # 2. Schema validation
    baseline_schema = None
    baseline_file = None
    
    for filepath in valid_files:
        filename = os.path.basename(filepath)
        try:
            # Using polars to read just the schema is cleaner and more robust
            lf = pl.scan_csv(filepath, n_rows=0)
            columns = lf.collect_schema().names()
        except Exception as e:
            logging.error(f"Failed to read schema from {filename}: {e}")
            raise

        if baseline_schema is None:
            baseline_schema = columns
            baseline_file = filename
            logging.info(f"Established baseline schema from {filename}: {baseline_schema}")
        else:
            if columns != baseline_schema:
                # Find mismatch details
                missing = set(baseline_schema) - set(columns)
                extra = set(columns) - set(baseline_schema)
                
                # Check for order mismatches
                order_mismatch = False
                if len(columns) == len(baseline_schema) and not missing and not extra:
                    for c, b in zip(columns, baseline_schema):
                        if c != b:
                            order_mismatch = True
                            break

                delta_msg = []
                if missing:
                    delta_msg.append(f"Missing columns: {list(missing)}")
                if extra:
                    delta_msg.append(f"Extra columns: {list(extra)}")
                if order_mismatch:
                    delta_msg.append(f"Column ordering mismatch. Expected: {baseline_schema}, Found: {columns}")
                if not missing and not extra and not order_mismatch:
                    delta_msg.append("Schema mismatch (type or count difference)")

                delta_str = "; ".join(delta_msg)
                error_msg = f"[FATAL] Schema mismatch in {filename} compared to baseline {baseline_file}. Delta: {delta_str}"
                logging.error(error_msg)
                print(error_msg)
                raise DataPipelineSchemaException(error_msg)

    print("All file schemas validated successfully.")
    logging.info("All file schemas validated successfully.")

    # 3. Lazy Compilation and Merging via Polars
    # Define explicit schema overrides to prevent type mismatch during scanning
    item_schema_overrides = {
        "Division": pl.String,
        "Section": pl.String,
        "Department": pl.String,
        "GRP_REM": pl.String,
        "PARTYNAME": pl.String,
        "Category 1": pl.String,
        "Category 2": pl.String,
        "Category 3": pl.String,
        "Category 4": pl.String,
        "Category 5": pl.String,
        "Category 6": pl.String,
        "DESC1": pl.String,
        "DESC2": pl.String,
        "DESC3": pl.String,
        "MRP": pl.Float64,
        "RATE": pl.Float64,
        "ICODE": pl.String,
        "GENERATED": pl.String,
        "STOCKINDATE": pl.String,
    }

    # Scan all valid item files lazily with low_memory=True
    lazy_item_frames = []
    for filepath in valid_files:
        lazy_item_frames.append(pl.scan_csv(filepath, schema_overrides=item_schema_overrides, low_memory=True))
    
    # Vertical concatenation without rechunking to prevent high peak memory usage
    items_lazy = pl.concat(lazy_item_frames, rechunk=False)
    
    # Scan sales
    sales_path = os.path.join('dataset', 'sales.csv')
    if not os.path.exists(sales_path):
        raise FileNotFoundError(f"Sales file not found at {sales_path}")
        
    sales_schema_overrides = {
        "BARCODE": pl.String,
        "ADMSITE_CODE": pl.String,
        "OPENING_QUANTITY": pl.Float64,
        "OPENING_AMOUNT": pl.Float64,
        "GOODS_RECEIVE_QUANTITY": pl.Float64,
        "GOODS_RECEIVE_AMOUNT": pl.Float64,
        "GOODS_RETURN_QUANTITY": pl.Float64,
        "GOODS_RETURN_AMOUNT": pl.Float64,
        "SITE_TRANSFER_IN_QUANTITY": pl.Float64,
        "SITE_TRANSFER_IN_AMOUNT": pl.Float64,
        "SITE_TRANSFER_OUT_QUANTITY": pl.Float64,
        "SITE_TRANSFER_OUT_AMOUNT": pl.Float64,
        "CONVERSION_ISSUE_QUANTITY": pl.Float64,
        "CONVERSION_ISSUE_AMOUNT": pl.Float64,
        "CONVERSION_RECEIVE_QUANTITY": pl.Float64,
        "CONVERSION_RECEIVE_AMOUNT": pl.Float64,
        "NET_SALE_AMOUNT": pl.Float64,
        "NET_SALE_COGS_AMOUNT": pl.Float64,
        "ADJUSTMENT_QUANTITY": pl.Float64,
        "ADJUSTMENT_AMOUNT": pl.Float64,
        "MISC_ISSUE_RECEIVE_QUANTITY": pl.Float64,
        "MISC_ISSUE_RECEIVE_AMOUNT": pl.Float64,
        "CLOSING_STOCK_QUANTITY": pl.Float64,
        "CLOSING_STOCK_AMOUNT": pl.Float64,
        "CLOSING_TRANSIT_QUANTITY": pl.Float64,
        "CLOSING_TRANSIT_AMOUNT": pl.Float64,
    }
    
    sales_lazy = pl.scan_csv(sales_path, schema_overrides=sales_schema_overrides)
    
    # Equi-join with sales on the left (smaller dataset) and items on the right (larger dataset)
    # to minimize the memory footprint of the join hash table
    central_fact_lazy = sales_lazy.join(
        items_lazy,
        left_on="BARCODE",
        right_on="ICODE",
        how="inner"
    )
    
    # Materialize and persist as parquet using streaming mode
    start_time = time.time()
    output_path = os.path.join('storage', 'cache', 'central_fact.parquet')
    
    # Using sink_parquet runs the lazy graph and streams chunks directly to disk
    central_fact_lazy.sink_parquet(output_path)
    end_time = time.time()
    
    msg = f"Data Pipeline completed successfully in {end_time - start_time:.4f} seconds."
    print(msg)
    logging.info(msg)

if __name__ == "__main__":
    run_ingestion()
