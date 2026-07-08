# Phase-by-Phase Platform Implementation Roadmap: Retail BI & Inventory Analytics

This roadmap decomposes the system prompt into deterministic, enterprise-grade execution phases. Every phase eliminates architectural ambiguity, enforces strict data-integrity rules, and establishes clear performance baselines using Polars/DuckDB and TypeScript.

---

## Phase 1: High-Performance Data Ingestion, Automated Discovery & Merge Pipeline

### 1.1 Automated File Discovery and Schema Validation Engine
* **Command:** Implement an automated file system crawler targeting `dataset/items/` and `dataset/sales.csv`. 
* **Precise Execution:**
    * Do not hardcode individual item sheet names (`sheet1.csv` ... `sheet16.csv`). Use standard file system globbing (`dataset/items/*.csv`) to dynamically discover files.
    * Initialize an empty system log file at `logs/data_pipeline.log` to track ingestion runs.
    * Iterate through each discovered file in `dataset/items/`. If a file is completely empty ($0$ bytes), log a warning: `[WARN] File {filename} is empty. Skipping.` and omit it from the processing stack.
    * Read the header row of the first valid item CSV file to extract the baseline schema definition:
        $$\text{Schema}_{\text{Items}} = \{\text{Division}, \text{Section}, \text{Department}, \text{GRP\_REM}, \text{PARTYNAME}, \text{Category 1} \dots \text{Category 6}, \text{DESC1}, \text{DESC2}, \text{DESC3}, \text{MRP}, \text{RATE}, \text{ICODE}, \text{GENERATED}, \text{STOCKINDATE}\}$$
    * For every subsequent file discovered within `dataset/items/`, check its columns against $\text{Schema}_{\text{Items}}$.
    * If a file exhibits a mismatch (missing column or extra column), throw an explicit runtime exception, log the error details with file name to `logs/data_pipeline.log`, and halt execution. Do not attempt auto-recovery.

### 1.2 Lazy-Evaluation Compilation and Merging via Polars/DuckDB
* **Command:** Compile the decentralized file paths into a unified central fact data structure using lazy computation.
* **Precise Execution:**
    * Utilize either the `polars.scan_csv()` interface or a persistent DuckDB local connection instance. Naive `pandas.read_csv()` memory-allocation routines are prohibited.
    * Read all validated files from `dataset/items/` as a collection of lazy dataframes. Apply a vertical concatenation (`polars.concat()` with rechunking or SQL `UNION ALL`) to assemble the raw items master dataset ($\approx 1,000,000$ records).
    * Initialize a separate lazy connection scanning `dataset/sales.csv`.
    * Perform an inner equi-join operation executing the literal relationship:
        $$\text{Fact\_Central} = \text{ItemsLazyDF}.\text{join}(\text{SalesLazyDF}, \text{left\_on}=\text{"ICODE"}, \text{right\_on}=\text{"BARCODE"}, \text{how}=\text{"inner"})$$
    * Materialize and persist this unified state as an optimized columnar cache using an enterprise Apache Parquet format target path at `storage/cache/central_fact.parquet`.

---

## Phase 2: Production-Grade Data Cleaning, Transformation & Star Schema Modeling

### 2.1 String Standardization and Field-Level Data Cleansing
* **Command:** Apply deterministic type casting, string manipulation, and datetime normalization to the materialized dataset.
* **Precise Execution:**
    * **String Trimming:** For every text-based column ($\text{Division}$, $\text{Section}$, $\text{Department}$, $\text{PARTYNAME}$, $\text{Category 1-6}$), strip leading and trailing whitespace using vectorized expressions (`.str.strip()`).
    * **Text Normalization:** Convert all string values to uppercase to eliminate duplicate categories caused by case variance.
    * **Null Handlers:** Identify null fields across all metrics. Replace null string fields with `"UNKNOWN"`. Replace null numeric quantity/amount fields with `0.0`.
    * **Numeric Casting:** Cast `MRP` and `RATE` explicitly to float64. Cast all 26 sales metric quantities and amount variables (e.g., `OPENING_QUANTITY`, `NET_SALE_AMOUNT`) to float64.
    * **Datetime Normalization:** Parse diverse date formats dynamically. Convert string formats resembling `Nov-15-2013` (format string: `%b-%d-%Y`) and `01-05-2026 00:00` (format string: `%m-%d-%Y %H:%M`) into standard ISO-8601 UTC timestamp objects (`YYYY-MM-DD HH:MM:SS`).
    * **Deduplication:** Scan for duplicate product entities where `ICODE` is identical; retain only the record displaying the most recent `STOCKINDATE`. Log the total count of dropped duplicates.

### 2.2 Relational Dimension and Fact Extract Engine (Star Schema Design)
* **Command:** Break down the flat central dataset into an enterprise star schema structure.
* **Precise Execution:**
    * Extract distinct dimensions from the sanitized cache into independent entities, assigning uniform surrogate primary keys ($\text{ID}$) to each table via a monotonically increasing sequence or row index identifier.
    * **Dim_Product:** Primary Key `Product_ID`. Attributes: `ICODE`, `DESC1`, `DESC2`, `DESC3`, `MRP`, `RATE`, `GENERATED`, `STOCKINDATE`.
    * **Dim_Supplier:** Primary Key `Supplier_ID`. Attributes: Unique `PARTYNAME` values (Supplier names normalized).
    * **Dim_Category:** Primary Key `Category_ID`. Attributes: `Category 1`, `Category 2`, `Category 3`, `Category 4`, `Category 5`, `Category 6`, `GRP_REM`.
    * **Dim_Organization:** Primary Key `Org_ID`. Attributes: `Division`, `Section`, `Department`.
    * **Dim_Store:** Primary Key `Store_ID`. Attributes: Unique `ADMSITE_CODE` values.
    * **Dim_Date:** Primary Key `Date_ID`. Generate comprehensive date dim from the min/max of `START_DATE`, `END_DATE`, and `STOCKINDATE` containing: `Date`, `Year`, `Quarter`, `Month`, `MonthName`, `Day`, `DayOfWeek`.
    * **Fact_Inventory_Sales:** Replace all textual reference columns inside the central dataset with their corresponding relational integer keys: `Product_ID`, `Supplier_ID`, `Category_ID`, `Org_ID`, `Store_ID`, `Date_ID`. Keep all 26 raw metric quantities and amounts as the numerical fact measures.
    * Export these tables as separate files inside `storage/gold/` using Parquet formats.

### 2.3 Vectorized Database Indexing Setup
* **Command:** Enforce structural indexing across storage files to secure sub-second query execution across millions of data rows.
* **Precise Execution:**
    * Configure DuckDB storage allocations to automatically structure underlying physical block storage by indexing column constraints.
    * Construct explicit primary indexing structures and secondary lookup indices directly across the physical partitions for the following query filters:
        $$\text{Indexes} = \{\text{Dim\_Product.ICODE}, \text{Fact\_Inventory\_Sales.Product\_ID}, \text{Dim\_Organization.Division}, \text{Dim\_Organization.Section}, \text{Dim\_Organization.Department}, \text{Dim\_Supplier.PARTYNAME}\}$$

---

## Phase 3: Analytical Calculators and Business Intelligence Metrics Layer

### 3.1 Financial Metric Definition Engines
* **Command:** Construct deterministic mathematical expressions for corporate profit analytics.
* **Precise Execution:**
    * Configure calculation pipelines utilizing the explicit formulas below:
    * $$\text{Gross Profit} = \text{NET\_SALE\_AMOUNT} - \text{NET\_SALE\_COGS\_AMOUNT}$$
    * $$\text{Gross Margin \%} = \left( \frac{\text{Gross Profit}}{\text{NET\_SALE\_AMOUNT}} \right) \times 100 \quad (\text{Set to } 0 \text{ if } \text{NET\_SALE\_AMOUNT} = 0)$$
    * $$\text{Markup \%} = \left( \frac{\text{Gross Profit}}{\text{NET\_SALE\_COGS\_AMOUNT}} \right) \times 100 \quad (\text{Set to } 0 \text{ if } \text{NET\_SALE\_COGS\_AMOUNT} = 0)$$
    * $$\text{Inventory Cost} = \text{CLOSING\_STOCK\_QUANTITY} \times \text{RATE}$$
    * $$\text{Potential Revenue} = \text{CLOSING\_STOCK\_QUANTITY} \times \text{MRP}$$
    * $$\text{Inventory Worth} = \text{CLOSING\_STOCK\_AMOUNT}$$

### 3.2 Inventory Health Classification Engine
* **Command:** Process item classifications dynamically based on movement velocity and operational volume.
* **Precise Execution:**
    * **ABC Analysis Matrix:** Rank all products in descending order based on their cumulative `NET_SALE_AMOUNT`. Classify the top 80% of total revenue as `Class A`, the subsequent 15% as `Class B`, and the trailing 5% as `Class C`.
    * **XYZ Analysis Matrix:** Calculate the coefficient of variation ($CV$) for monthly item quantities sold. Classify products with $CV \le 10\%$ as `Class X` (stable demand), $10\% < CV \le 25\%$ as `Class Y` (variable demand), and $CV > 25\%$ or zero sales as `Class Z` (uncertain/erratic demand).
    * **Stock Velocity Rules:** Evaluate inventory velocity using explicit criteria:
        * `Dead Stock`: Inventory where $\text{NET\_SALE\_AMOUNT} == 0$ AND $\text{CLOSING\_STOCK\_QUANTITY} > 0$ for a continuous tracking window $\ge 180 \text{ days}$.
        * `Slow Moving`: Items where the calculated $\text{Sell Through Rate (STR)} < 10\%$ monthly. Where $\text{STR} = (\text{NET\_SALE\_QUANTITY} / (\text{OPENING\_QUANTITY} + \text{GOODS\_RECEIVE\_QUANTITY})) \times 100$.
        * `Fast Moving`: Items where $\text{STR} \ge 40\%$ monthly.
    * **Operational Stock Levels:**
        * `Understock / Reorder Trigger`: Condition where $\text{CLOSING\_STOCK\_QUANTITY} \le (\text{Average Daily Sales Quantity} \times \text{Lead Time of 14 Days})$.
        * `Overstock`: Condition where $\text{CLOSING\_STOCK\_QUANTITY} > (\text{Average Monthly Demand} \times 3)$.

---

## Phase 4: API Layer, Advanced Analytics & ML Forecasting Core

### 4.1 High-Performance Semantic OLAP API Controllers
* **Command:** Develop an API layer with automated filter aggregation, instant search capability, and robust fallback error handling.
* **Precise Execution:**
    * Build optimized query routing layers using Python (FastAPI backed by DuckDB) or Node.js (using packaged analytical bindings).
    * **Global Filters Routine:** Program multi-parameter aggregation handlers that accept array parameters for `Division`, `Section`, `Department`, `Supplier`, `Store`, `Category`, alongside object ranges for `Date Range` and `MRP Range`. Implement these as native SQL `WHERE` evaluations using parameterized queries to protect against injection vulnerability.
    * **Instant Fuzzy Search Endpoint:** Implement a high-speed search router utilizing an optimized substring match or a Levenshtein distance metric capped at threshold $D=1$. The service must resolve lookups against indices `ICODE`, `BARCODE`, `PARTYNAME`, and `Category 1` within $<50\text{ms}$ execution ceilings.
    * **Data Export Handlers:** Implement server-side generation features to output streaming binary reports for PDF (using structured canvas wrappers), Excel (using multi-tab streaming writers), and raw CSV formats.

### 4.2 ML Forecasting Architecture
* **Command:** Implement a dedicated analytical microservice providing demand forecasting.
* **Precise Execution:**
    * Construct an isolated analytics module leveraging `statsmodels` or `Prophet` for time-series modeling.
    * **Time-Series Aggregation:** Group historical data by `Date_ID` to compile total aggregate daily metrics for both `NET_SALE_AMOUNT` and `CLOSING_STOCK_QUANTITY`.
    * **Fallback Modeling Strategy:**
        * *Primary:* Fit an additive automated `Prophet` forecasting model configuring seasonal components (`yearly_seasonality=true`, `weekly_seasonality=true`).
        * *Secondary Fallback:* If Python system constraints lack the native C++ compilers required for Prophet, automatically fall back to an elegant Autoregressive Integrated Moving Average model ($\text{ARIMA}(p,d,q)$ parameters optimized via AIC minimization thresholds) or rolling 30-day centered moving average calculations.
    * Expose outputs via a predictable structure: `/api/v1/analytics/forecast?metric=sales&horizon=30` returns an array of daily objects containing `date`, `predicted_value`, `lower_bound`, and `upper_bound`.

### 4.3 Natural Language Interface (AI Analyst Core)
* **Command:** Set up a secure semantic routing gateway that converts natural language queries into executable SQL commands.
* **Precise Execution:**
    * Create a specialized system context mapping the precise table layouts generated in Section 2.2.
    * Implement an API interface `/api/v1/ai/query` processing user strings. It must map phrases directly to pre-compiled structural queries using deterministic regex classifications or structured LLM tool-calling declarations:
        * *Input:* "Which supplier generated the highest profit?" $\rightarrow$ Maps to an aggregated join query summing `Gross Profit` grouped by `Dim_Supplier.PARTYNAME` ordered descending with a limit of 1.
        * *Input:* "Show producsts with zero sales." $\rightarrow$ Maps to: `SELECT ICODE FROM Dim_Product WHERE Product_ID NOT IN (SELECT DISTINCT Product_ID FROM Fact_Inventory_Sales WHERE NET_SALE_QUANTITY > 0)`
    * Enforce a validation check before executing any generated SQL query against the database: if the query string contains modification keywords (`INSERT`, `UPDATE`, `DELETE`, `DROP`, `ALTER`), block execution and throw an access violation error.

---

## Phase 5: Enterprise Premium Frontend Interface (UX/UI Implementation)

### 5.1 Architecture Setup and Styling Foundations
* **Command:** Build a fully typed frontend architecture using Strict TypeScript and layout guidelines inspired by Microsoft Fabric and Stripe.
* **Precise Execution:**
    * Bootstrap the web layout utilizing React 19 or Next.js 15 App Router architecture. Configure `tsconfig.json` to enforce `"strict": true`.
    * **Theme Specifications (Luxury Dark Palette):** Extend the configuration settings (e.g., via Tailwind CSS) with the following hexadecimal color parameters:
        * `Background Deep`: `#09090B`
        * `Surface Card Glass`: `rgba(18, 18, 23, 0.7)` with CSS Backing Filter Backdrop Blur set to `12px` and thin borders styled as `1px solid rgba(255, 255, 255, 0.08)`.
        * `Luxury Accent Purple`: `#6D28D9`
        * `Indigo Primary`: `#4338CA`
        * `Blue Vibrant Accents`: `#2563EB`
        * `Text Primary High Contrast`: `#F4F4F5`
        * `Text Muted Functional`: `#A1A1AA`

### 5.2 Layout Grid, Global Workspace Navigation and Skeletons
* **Command:** Layout the workspace viewports, custom structural dashboard elements, and persistent interaction bars.
* **Precise Execution:**
    * **Sidebar Framework:** Create a responsive structural left-side menu displaying uniform links: Dashboard, Sales Analytics, Inventory, Products, Suppliers, Categories, Departments, Stores, Reports, Forecasting, AI Assistant, and Settings.
    * **Global Workspace Controls:** Mount a persistent top workspace configuration panel housing global filter selectors. Changes made here must immediately emit updated filter states to all active sub-views via a unified state provider (such as React Context or Redux Toolkit).
    * **Loading State UX:** Implement layout skeleton states for every chart component using subtle pulse animation transitions (`animate-pulse`). Never display empty text containers or raw layout shifts while fetching asynchronous payload records.
    * **Error Boundaries:** Wrap every analytical view card inside an isolated UI Error Boundary component. If an aggregation service failure occurs within an individual chart component, capture the failure state and display a fallback notification container: `"Failed to load visualization data"`, without breaking the rest of the operational dashboard view.

### 5.3 Modular Visual Aggregation Views (Visualizations Implementation)
* **Command:** Mount professional, optimized charting layers powered by standard tracking components like ECharts or Chart.js.
* **Precise Execution:**
    * Construct the interface blocks exactly across these target dashboard panels:
    * **Executive Grid View:** Mount high-impact summary KPI text cards with clear values tracking: Total Products, Inventory Value, Net Sales, Gross Profit, Gross Margin %, Closing Inventory, Opening Inventory, Goods Received, Goods Returned, Transfer In, Transfer Out, Dead Stock Value, Slow Moving Stock, Fast Moving Stock, Average Inventory, Top Supplier, Top Category, Top Department.
    * **Sales Analytics Grid:** Render temporal sales volume charts (Monthly/Yearly tracking using Area charts), comparative ranking structures (Supplier, Category, Department performance using Horizontal Bar charts), and comprehensive Revenue Trend Lines featuring a 30-day calculation overlay.
    * **Inventory Dashboard Layer:** Render a dual-axis line-bar tracking chart visualizing Stock Movement flow (`GOODS_RECEIVE_QUANTITY` vs `GOODS_RETURN_QUANTITY`). Integrate a structural Treemap diagram displaying spatial inventory concentration across Categories and Departments.
    * **Product Insights Panel:** Generate optimized tabular layout lists displaying both ends of the performance spectrum (Best/Worst/Zero sales). Render structural coordinate diagrams tracking ABC/XYZ categorizations and a Pareto distribution curve.
    * **AI Assistant Chat Workspace:** Build an isolated dialogue interface panel containing quick-action prompt buttons for standard queries. Display assistant responses in structured markdown tables accompanied by a simple "Export to CSV" utility action.