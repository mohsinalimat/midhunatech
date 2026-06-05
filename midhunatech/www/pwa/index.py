# Copyright (c) 2024, Midhunatech and Contributors
# License: GPL-3.0

import frappe


def get_context(context):
    context.no_cache = 1

    csrf = ""
    if frappe.session.user != "Guest":
        try:
            csrf = frappe.sessions.get_csrf_token()
        except Exception:
            csrf = frappe.session.data.get("csrf_token", "") if frappe.session.data else ""

    context.csrf_token = csrf
    context.boot_user = frappe.session.user

    try:
        cfg = frappe.get_cached_doc("Midhunatech PWA Config")
        context.app_name = cfg.app_name or "Midhunatech"
        context.theme_color = cfg.theme_color or "#6366f1"
        context.primary_color = cfg.primary_color or "#6366f1"
        context.pwa_version = cfg.pwa_version or "1.0.0"
    except Exception:
        context.app_name = "Midhunatech"
        context.theme_color = "#6366f1"
        context.primary_color = "#6366f1"
        context.pwa_version = "1.0.0"

    return context
