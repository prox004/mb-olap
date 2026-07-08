# ROLE
You are a Staff Software Engineer, Data Engineer, Product Designer, BI Architect, and UX Designer. Your task is to build a complete enterprise-grade Retail Business Intelligence & Inventory Analytics Platform.
This is NOT a prototype. This is NOT a demo dashboard.
This is a production-quality application that should look and feel like software used by large retail chains.
The application should have clean architecture, scalable code, modular components, enterprise UX, and high performance.
--------------------------------------------------
# PROJECT OVERVIEW
The application will analyze retail inventory and sales data.
The project contains a dataset folder structured exactly like this:
project-root/
│
├── dataset/
│   ├── sales.csv
│   └── items/
│       ├── sheet1.csv
│       ├── sheet2.csv
│       ├── sheet3.csv
│       ├── ...
│       └── sheet16.csv
There is ONLY ONE sales.csv file.
There are 16 CSV files inside the items folder.
The application must automatically discover every CSV inside the items folder without hardcoding filenames.
--------------------------------------------------
# DATASET DETAILS
## Items Dataset
The items folder contains 16 CSV files.
The first 15 files contain approximately 65,000 rows each.
The 16th file contains around 500 rows.
Total records are approximately 1,000,000 rows.
Columns include:
Division
Section
Department
GRP_REM
PARTYNAME
Category 1
Category 2
Category 3
Category 4
Category 5
Category 6
DESC1
DESC2
DESC3
MRP
RATE
ICODE
GENERATED
STOCKINDATE
ICODE is the unique Product ID.
--------------------------------------------------
## Sales Dataset
sales.csv contains monthly inventory movement.
Each row represents:
Product
+
Store
+
Date Range
Columns include:
START_DATE
END_DATE
BARCODE
ADMSITE_CODE
OPENING_QUANTITY
OPENING_AMOUNT
GOODS_RECEIVE_QUANTITY
GOODS_RECEIVE_AMOUNT
GOODS_RETURN_QUANTITY
GOODS_RETURN_AMOUNT
SITE_TRANSFER_IN_QUANTITY
SITE_TRANSFER_IN_AMOUNT
SITE_TRANSFER_OUT_QUANTITY
SITE_TRANSFER_OUT_AMOUNT
CONVERSION_ISSUE_QUANTITY
CONVERSION_ISSUE_AMOUNT
CONVERSION_RECEIVE_QUANTITY
CONVERSION_RECEIVE_AMOUNT
NET_SALE_AMOUNT
NET_SALE_COGS_AMOUNT
ADJUSTMENT_QUANTITY
ADJUSTMENT_AMOUNT
MISC_ISSUE_RECEIVE_QUANTITY
MISC_ISSUE_RECEIVE_AMOUNT
CLOSING_STOCK_QUANTITY
CLOSING_STOCK_AMOUNT
CLOSING_TRANSIT_QUANTITY
CLOSING_TRANSIT_AMOUNT
BARCODE represents the Product Code.
--------------------------------------------------
# DATA RELATIONSHIP
Automatically merge all item CSV files into one master dataset.
Join using
items.ICODE
=
sales.BARCODE
The merged dataset should be treated as the central fact table.
--------------------------------------------------
# DATA LOADING
DO NOT hardcode filenames.
Automatically scan
dataset/items/
Load every CSV.
Merge all files.
Validate schema consistency.
Ignore empty files.
Report malformed files gracefully.
--------------------------------------------------
# PERFORMANCE REQUIREMENTS
The application must comfortably support over 1 million records.
DO NOT rely on naive pandas loading.
Prefer:
DuckDB or Polars
Use lazy loading wherever possible.
Create indexes on
ICODE
BARCODE
Division
Section
Department
PARTYNAME
Cache processed datasets.
Avoid browser freezing.
Avoid loading unnecessary columns.
Use vectorized operations.
Support future datasets with millions of rows.
--------------------------------------------------
# DATA CLEANING
Automatically
Trim whitespace.
Normalize text.
Handle NULL values.
Remove duplicate products.
Detect duplicate barcodes.
Convert MRP and RATE to numeric.
Convert all quantities to numeric.
Convert amounts to numeric.
Convert Nov-15-2013 and 01-05-2026 00:00 into proper datetime objects.
Standardize supplier names.
Infer correct data types.
Log every cleaning operation.
--------------------------------------------------
# DATA MODEL
Create an enterprise star schema.
Fact Table
Inventory Sales
Dimensions
Product
Supplier
Cateory
Department
Division
Section
Date
Store
Do NOT work with flat CSVs after loading.
--------------------------------------------------
# APPLICATION DESIGN
Theme
Premium Enterprise
Dark Theme
Luxury Purple
Indigo
Blue Accents
Minimal
Modern
Glassmorphism
Rounded Cards
Professional Typography
Excellent spacing
Smooth animations
Responsive
No clutter
Inspired by Power BI Tableau SAP Analytics Cloud Microsoft Fabric Linear Stripe Dashboard
--------------------------------------------------
# SIDEBAR
Dashboard
Sales Analytics
Inventory
Products
Suppliers
Categories
Departments
Stores
Reports
Forecasting
AI Assistant
Settings
--------------------------------------------------
# EXECUTIVE DASHBOARD
Large KPI cards.
Animated counters.
Cards include
Total Products
Inventory Value
Net Sales
Gross Profit
Gross Margin %
Closing Inventory
Opening Inventory
Goods Received
Goods Returned
Transfer In
Transfer Out
Dead Stock Value
Slow Moving Stock
Fast Moving Stock
Average Inventory
Top Supplier
Top Category
Top Department
--------------------------------------------------
# SALES ANALYTICS
Monthly Sales
Yearly Sales
Category Sales
Supplier Sales
Department Sales
Division Sales
Top Products
Bottom Products
Store Performance
Revenue Trends
Moving Average
Growth %
Sales Heatmaps
--------------------------------------------------
# INVENTORY ANALYTICS
Opening Stock
Closing Stock
Inventory Value
Transit Inventory
Stock Movement
Goods Received
Goods Returned
Adjustments
Inventory Flow
Warehouse Health
--------------------------------------------------
# PRODUCT ANALYTICS
Best Selling Products
Worst Selling Products
Zero Sales Products
High Value Products
Highest Margin Products
Product Lifecycle
Product Aging
Stock Aging
ABC Analysis
XYZ Analysis
Pareto Analysis
--------------------------------------------------
# SUPPLIER ANALYTICS
Supplier Contribution
Supplier Revenue
Supplier Profit
Supplier Inventory
Supplier Ranking
Top Suppliers
Inactive Suppliers
--------------------------------------------------
# CATEGORY ANALYTICS
Division Performance
Section Performance
Department Performance
Category hierarchy drill-down
Treemap
Sunburst
Hierarchy Charts
--------------------------------------------------
# PROFIT ANALYTICS
Use
MRP
RATE
NET_SALE_AMOUNT
NET_SALE_COGS_AMOUNT
Calculate
Gross Profit
Margin %
Markup %
COGS
Inventory Cost
Potential Revenue
Inventory Worth
--------------------------------------------------
# INVENTORY HEALTH
Dead Stock
Slow Moving
Fast Moving
High Inventory
Low Inventory
Reorder Suggestions
Overstock
Understock
Stock Turnover
Sell Through Rate
--------------------------------------------------
# REPORTS
Export PDF
Export Excel
Export CSV
Scheduled Reports
Saved Reports
Printable Reports
--------------------------------------------------
# FILTERS
Global Filters
Date Range
Division
Section
Department
Supplier
Store
Category
MRP Range
Inventory Value
Search Product
Barcode Search
Product Code Search
--------------------------------------------------
# SEARCH
Instant search.
Autocomplete.
Fuzzy search.
Search by
ICODE
BARCODE
Supplier
Category
Department
Division
--------------------------------------------------
# VISUALIZATIONS
Use professional charts.
Line
Area
Bar
Horizontal Bar
Stacked Bar
Treemap
Sunburst
Heatmap
Scatter
Bubble
Waterfall
Sankey
Donut
Pie
Table
Pivot Table
KPI Cards
Maps if location becomes available.
--------------------------------------------------
# AI ANALYST
Natural language interface.
Examples
Which supplier generated the highest profit?
Show products with zero sales.
Which department has declining sales?
Show inventory above ₹20 lakh.
Find products older than 365 days.
Which supplier has dead stock?
Forecast next month's inventory.
Which products should be reordered?
--------------------------------------------------
# FORECASTING
Forecast
Inventory
Sales
Demand
Moving Average
Linear Regression
Prophet if available.
--------------------------------------------------
# UX
Fast.
Fluid.
Professional.
Enterprise quality.
Loading skeletons.
Empty states.
Error boundaries.
Keyboard shortcuts.
Persistent filters.
Theme toggle.
Export buttons.
Breadcrumbs.
Responsive.
--------------------------------------------------
# CODE QUALITY
Strict TypeScript.
Reusable components.
Modular architecture.
No duplicated logic.
Strong typing.
Scalable folder structure.
Proper documentation.
Meaningful naming.
Error handling.
Logging.
--------------------------------------------------
# DELIVERABLE
Generate a complete production-ready application.
Not a prototype.
Not a demo.
Build it as if it will be deployed for a retail company managing millions of inventory records across multiple stores.
The final result should look like a premium enterprise analytics platform comparable to Power BI, Tableau, SAP Analytics Cloud, or Microsoft Fabric, while remaining fast, modern, and highly interactive.
