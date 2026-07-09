import pandas as pd
from openpyxl import Workbook
from openpyxl.styles import (
    PatternFill, Font, Alignment, Border, Side, numbers
)
from openpyxl.utils import get_column_letter
from openpyxl.styles.numbers import FORMAT_PERCENTAGE_00
import datetime

# ─────────────────────────────────────────────
# 1. Load data
# ─────────────────────────────────────────────
df = pd.read_excel("LCC Report Apr-26.xlsx")

# ─────────────────────────────────────────────
# 2. Calculate metrics per branch
# ─────────────────────────────────────────────
branches = sorted(df["Branch"].dropna().unique())

records = []
for branch in branches:
    mask = df["Branch"] == branch
    bdf  = df.loc[mask]

    opening_arrears    = bdf["Arrears"].sum()
    current_demand     = bdf["Month TBC"].sum()
    total_demand       = opening_arrears + current_demand

    pre_adv_col        = bdf["Prev Adv Coll"].sum()
    month_tbc_received = bdf["Month TBC Received"].sum()
    current_collection = month_tbc_received + pre_adv_col

    current_arrear     = current_demand - current_collection
    arrear_collection  = bdf["Arrear Received"].sum()
    total_arrear       = opening_arrears + current_arrear - arrear_collection

    current_pct        = (current_collection / current_demand * 100) if current_demand else 0
    total_pct          = ((current_collection + current_arrear) / total_demand * 100) if total_demand else 0
    cash_flow_pct      = ((current_collection + arrear_collection) / current_demand * 100) if current_demand else 0

    records.append({
        "Branch Name":          branch,
        "Opening Arrear":       opening_arrears,
        "Current Demand":       current_demand,
        "Total Demand":         total_demand,
        "Current Collection":   current_collection,
        "Current Arrear":       current_arrear,
        "Arrear Collection":    arrear_collection,
        "Total Arrear":         total_arrear,
        "Current Collection %": current_pct,
        "Total Collection %":   total_pct,
        "Cash Flow":            cash_flow_pct,
    })

# Grand total row
grand = {k: 0 for k in records[0]}
grand["Branch Name"] = "TOTAL"
num_keys = [k for k in grand if k != "Branch Name" and "%" not in k and k != "Cash Flow"]

for r in records:
    for k in num_keys:
        grand[k] += r[k]

# Recompute grand % from totals
grand["Current Collection %"] = (grand["Current Collection"] / grand["Current Demand"]  * 100) if grand["Current Demand"]  else 0
grand["Total Collection %"]   = ((grand["Current Collection"] + grand["Current Arrear"]) / grand["Total Demand"] * 100) if grand["Total Demand"] else 0
grand["Cash Flow"]            = ((grand["Current Collection"] + grand["Arrear Collection"]) / grand["Current Demand"] * 100) if grand["Current Demand"] else 0
records.append(grand)

# ─────────────────────────────────────────────
# 3. Build the Excel workbook
# ─────────────────────────────────────────────
wb = Workbook()
ws = wb.active
ws.title = "Collection Efficiency"

# ── Colour palette ──────────────────────────
C_HEADER_BG   = "A9D08E"   # light green requested by user
C_HEADER_FG   = "000000"   # dark black for premium contrast
C_SUBHDR_BG   = "A9D08E"   # same requested green
C_SUBHDR_FG   = "000000"
C_ALT1        = "DCE6F1"   # light blue tint
C_ALT2        = "FFFFFF"   # white
C_TOTAL_BG    = "FFC000"   # gold
C_TOTAL_FG    = "1F3864"
C_GOOD        = "70AD47"   # green
C_BAD         = "FF0000"   # red
C_LABEL_FG    = "1F3864"

def make_fill(hex_color):
    return PatternFill("solid", fgColor=hex_color)

def make_border(style="thin"):
    s = Side(style=style, color="000000")
    return Border(left=s, right=s, top=s, bottom=s)

def make_thick_border():
    thick = Side(style="medium", color="1F3864")
    thin  = Side(style="thin",   color="A0A0A0")
    return Border(left=thick, right=thick, top=thick, bottom=thick)



# ── Column headers ───────────────────────────
columns = [
    ("Branch Name",          18),
    ("Opening Arrear",       14),
    ("Current Demand",       14),
    ("Total Demand",         14),
    ("Current Collection",   14),
    ("Current Arrear",       13),
    ("Arrear Collection",    14),
    ("Total Arrear",         13),
    ("Current Collection %", 11),
    ("Total Collection %",   11),
    ("Cash Flow",            11),
]

col_keys = [
    "Branch Name",
    "Opening Arrear",
    "Current Demand",
    "Total Demand",
    "Current Collection",
    "Current Arrear",
    "Arrear Collection",
    "Total Arrear",
    "Current Collection %",
    "Total Collection %",
    "Cash Flow",
]

HDR_ROW = 1
for col_idx, (label, width) in enumerate(columns, start=1):
    cell = ws.cell(row=HDR_ROW, column=col_idx, value=label)
    cell.font      = Font(name="Calibri", bold=True, size=11, color=C_SUBHDR_FG)
    cell.fill      = make_fill(C_SUBHDR_BG)
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=False)
    cell.border    = make_border()
    ws.column_dimensions[get_column_letter(col_idx)].width = width

ws.row_dimensions[HDR_ROW].height = 24

# ── Data rows ────────────────────────────────
pct_col_indices = {col_keys.index("Current Collection %") + 1,
                   col_keys.index("Total Collection %")   + 1,
                   col_keys.index("Cash Flow")            + 1}

for row_idx, rec in enumerate(records):
    excel_row = HDR_ROW + 1 + row_idx
    is_total  = rec["Branch Name"] == "TOTAL"

    for col_idx, key in enumerate(col_keys, start=1):
        val  = rec[key]
        cell = ws.cell(row=excel_row, column=col_idx, value=val)

        cell.border = make_border()
        cell.font   = Font(
            name="Calibri",
            bold=is_total,
            size=11,
            color="000000",
        )
        if is_total:
            cell.fill = make_fill("E2EFDA")

        if col_idx == 1:   # Branch name
            cell.alignment = Alignment(horizontal="left", vertical="center", indent=1)
        elif col_idx in pct_col_indices:
            cell.number_format = '0.00"%"'
            cell.alignment = Alignment(horizontal="center", vertical="center")
        else:
            cell.number_format = '#,##0'
            cell.alignment = Alignment(horizontal="right", vertical="center")

    ws.row_dimensions[excel_row].height = 15

# Set column widths: branch column (1) is 30, remaining columns (2 to 11) are 15
ws.column_dimensions[get_column_letter(1)].width = 30
for col_idx in range(2, 12):
    ws.column_dimensions[get_column_letter(col_idx)].width = 15



# ─────────────────────────────────────────────
# 5. Save
# ─────────────────────────────────────────────
out_file = "Collection_Efficiency_Report.xlsx"
wb.save(out_file)
print(f"[OK] Report saved: {out_file}")
print(f"     Branches processed : {len(records) - 1}")
print(f"     Rows (incl. total) : {len(records)}")
