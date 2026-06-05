# Copyright (c) 2024, Midhunatech and Contributors
# License: GPL-3.0
"""
API for the single-file production PWA served at /pwa.

Everything the PWA renders is configured from the "Midhunatech PWA Config" Single
doctype. These endpoints expose the config and the data behind each tile type.
Reuses the permission-hardened helpers in midhunatech.api.data.
"""

import frappe
from frappe import _

from . import data as _data

# Config fields surfaced to the frontend
_CONFIG_FIELDS = [
    "app_name", "logo", "theme_color", "primary_color", "secondary_color",
    "accent_color", "bottom_nav_enabled", "splash_screen_enabled",
    "offline_mode_enabled", "pwa_version", "custom_css", "custom_js",
]

_MODULE_FIELDS = [
    "label", "module_name", "icon", "color", "gradient_from", "gradient_to",
    "module_type", "doctype_name", "doctype_filters", "doctype_fields",
    "report_name", "report_filters", "number_card_name", "dashboard_name",
    "webpage_route", "external_url", "custom_html_block", "open_in_modal",
    "badge_count_method", "show_in_bottom_nav", "bottom_nav_icon",
    "bottom_nav_label", "bottom_nav_order", "display_order", "is_enabled",
    "target_url",
]


# ── full config + modules + badge counts ────────────────────────────────────────

@frappe.whitelist()
def get_pwa_config():
    if frappe.session.user == "Guest":
        frappe.throw(_("Please sign in."), frappe.PermissionError)

    cfg = frappe.get_cached_doc("Midhunatech PWA Config")
    out = {f: cfg.get(f) for f in _CONFIG_FIELDS}
    out["logo"] = cfg.get("logo") or ""

    modules = []
    for row in cfg.get("modules", []):
        if not row.is_enabled:
            continue
        m = {f: row.get(f) for f in _MODULE_FIELDS}
        m["badge"] = _badge_count(row.get("badge_count_method"))
        modules.append(m)
    modules.sort(key=lambda x: int(x.get("display_order") or 0))
    out["modules"] = modules

    user = frappe.get_cached_doc("User", frappe.session.user)
    roles = [r.role for r in user.get("roles", [])]
    out["user"] = frappe.session.user
    out["fullname"] = user.full_name or frappe.session.user
    out["user_image"] = user.user_image or ""
    out["is_system_manager"] = "System Manager" in roles or "Administrator" in roles
    return out


def _badge_count(method):
    if not method:
        return None
    try:
        fn = frappe.get_attr(method)
        if not getattr(fn, "__wrapped__", None) and not getattr(fn, "whitelisted", False):
            # only allow whitelisted methods
            return None
        val = fn()
        return int(val) if val else 0
    except Exception:
        return None


# ── list data (smart fields) ────────────────────────────────────────────────────

@frappe.whitelist()
def get_list_data(doctype, fields=None, filters=None, limit=20, start=0):
    meta = _data._require_read(doctype)
    perm = _data._permitted_fields(meta)
    start = int(start or 0)
    limit = min(int(limit or 20), 100)

    title_field = meta.title_field or "name"
    if title_field not in perm:
        title_field = "name"
    status_field = _data._pick_status_field(meta)
    if status_field and status_field not in perm:
        status_field = None
    date_field = _data._pick_date_field(meta)
    if date_field not in perm:
        date_field = "modified"

    # smart field detection / explicit override
    chosen = _parse_json(fields, default=None)
    if not chosen:
        chosen = _smart_fields(meta, title_field, status_field, perm)
    chosen = [f for f in chosen if f == "name" or (meta.has_field(f) and f in perm)]

    wanted = ["name"]
    for f in [title_field, status_field, date_field, *chosen]:
        if f and f != "name" and f not in wanted and meta.has_field(f) and f in perm:
            wanted.append(f)

    flt = _parse_json(filters, default=[]) or []
    rows = frappe.get_list(
        doctype, fields=wanted, filters=flt,
        start=start, page_length=limit,
        order_by=f"{date_field} desc" if meta.has_field(date_field) else "modified desc",
    )

    columns = []
    for f in chosen[:5]:
        df = meta.get_field(f)
        if df:
            columns.append({"fieldname": f, "label": df.label or f, "fieldtype": df.fieldtype})

    out_rows = []
    for r in rows:
        item = {
            "name": r.get("name"),
            "title": str(r.get(title_field) or r.get("name")),
            "status": (str(r.get(status_field)) if status_field and r.get(status_field) else None),
            "cells": [],
        }
        for c in columns:
            item["cells"].append(_data._fmt(meta.get_field(c["fieldname"]), r.get(c["fieldname"])))
        out_rows.append(item)

    return {
        "doctype": doctype,
        "columns": columns,
        "rows": out_rows,
        "has_more": len(rows) == limit,
        "can_create": bool(frappe.has_permission(doctype, "create")),
    }


def _smart_fields(meta, title_field, status_field, perm):
    used = {title_field, status_field, "name"}
    out = []
    for df in meta.fields:
        if len(out) >= 4:
            break
        if df.fieldname in used or df.fieldname in _data._SKIP or df.fieldname not in perm:
            continue
        if df.fieldtype in _data._LAYOUT or df.hidden or not df.in_list_view:
            continue
        if df.fieldtype in ("Data", "Link", "Select", "Int", "Float", "Currency",
                            "Date", "Datetime", "Check", "Small Text"):
            out.append(df.fieldname)
            used.add(df.fieldname)
    return out


# ── single document ─────────────────────────────────────────────────────────────

@frappe.whitelist()
def get_doc_data(doctype, name):
    return _data.get_doc(doctype, name)


# ── number card value ───────────────────────────────────────────────────────────

@frappe.whitelist()
def get_number_card_value(number_card_name):
    from frappe.desk.doctype.number_card.number_card import get_result
    if not frappe.db.exists("Number Card", number_card_name):
        return {"label": number_card_name, "value": None}
    card = frappe.get_doc("Number Card", number_card_name)
    if not card.has_permission("read"):
        frappe.throw(_("Not permitted"), frappe.PermissionError)
    if (card.type or "Document Type") != "Document Type":
        return {"label": card.label, "value": "—"}
    if not frappe.has_permission(card.document_type, "read"):
        frappe.throw(_("Not permitted"), frappe.PermissionError)
    value = get_result(card.as_dict(), card.get("filters_json") or "[]")
    return {
        "name": card.name,
        "label": card.label or card.name,
        "value": _data._fmt_card_value(value, card),
        "color": card.get("color") or "#6366f1",
        "doctype": card.document_type,
        "function": card.function,
    }


# ── helpers ─────────────────────────────────────────────────────────────────────

def _parse_json(value, default=None):
    if value in (None, "", "null"):
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return frappe.parse_json(value)
    except Exception:
        return default
