# Copyright (c) 2024, Midhunatech and Contributors
# License: GPL-3.0
"""
Convert the desk-iframe (frappe_page) modules in Midhunatech PWA Config into
native `doc_list` modules, so each opens the simple mobile UI instead of the
full ERPNext desk.

Run with:
    bench --site <site> execute midhunatech.setup.native_modules.convert
"""

import frappe

# module_name (slug)  ->  Doctype to show natively
MAP = {
    "sales_order":   "Sales Order",
    "stock_entry":   "Stock Entry",
    "attendance":    "Attendance",
    "leave_request": "Leave Application",
    "expense_claim": "Expense Claim",
    "my_tasks":      "Task",
    "team":          "Employee",
}


def convert():
    cfg = frappe.get_doc("Midhunatech PWA Config")
    changed = 0
    for row in cfg.get("modules", []):
        doctype = MAP.get(row.module_name)
        if not doctype:
            continue
        if not frappe.db.exists("DocType", doctype):
            print(f"  ⚠ skip {row.module_name}: doctype '{doctype}' not installed")
            continue
        row.module_type = "doc_list"
        row.target_url = doctype
        changed += 1
        print(f"  ✔ {row.label:<16} -> native doc_list ({doctype})")

    cfg.save(ignore_permissions=True)
    frappe.db.commit()
    print(f"Done. {changed} module(s) now use the native mobile UI.")
