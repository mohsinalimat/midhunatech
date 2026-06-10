# Copyright (c) 2026, Midhunatech and Contributors
# License: GPL-3.0
"""Run any Frappe report and return mobile-friendly columns/rows."""

import json

import frappe
from frappe import _


@frappe.whitelist()
def run(report_name, filters=None):
    report = frappe.get_doc("Report", report_name)
    if not report.is_permitted():
        frappe.throw(_("Not permitted"), frappe.PermissionError)

    if isinstance(filters, str):
        filters = json.loads(filters or "{}")

    from frappe.desk.query_report import run as query_report_run

    res = query_report_run(report_name, filters=filters or {}, ignore_prepared_report=True)

    columns = []
    for c in res.get("columns") or []:
        if isinstance(c, str):
            label = c.split(":")[0]
            columns.append({"label": label, "fieldname": label})
        else:
            columns.append({
                "label": c.get("label") or c.get("fieldname"),
                "fieldname": c.get("fieldname") or c.get("label"),
                "fieldtype": c.get("fieldtype"),
            })

    rows = []
    for r in (res.get("result") or [])[:500]:
        if isinstance(r, (list, tuple)):
            rows.append({columns[i]["fieldname"]: r[i] for i in range(min(len(columns), len(r)))})
        elif isinstance(r, dict):
            rows.append(r)

    return {"columns": columns, "rows": rows}
