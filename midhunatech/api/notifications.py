# Copyright (c) 2026, Midhunatech and Contributors
# License: GPL-3.0
"""In-app notification feed for the PWA (reads Notification Log)."""

import frappe
from frappe.utils import pretty_date, strip_html_tags


@frappe.whitelist()
def get_feed(limit=30):
    """Latest notifications for the current user + unread count."""
    rows = frappe.get_all(
        "Notification Log",
        filters={"for_user": frappe.session.user},
        fields=["name", "subject", "email_content", "read", "creation", "document_type", "document_name", "type"],
        order_by="creation desc",
        limit_page_length=int(limit),
    )
    unread = frappe.db.count("Notification Log", {"for_user": frappe.session.user, "read": 0})
    items = []
    for r in rows:
        items.append({
            "name": r.name,
            "subject": strip_html_tags(r.subject or "").strip()[:200],
            "body": strip_html_tags(r.email_content or "").strip()[:400],
            "read": int(r.read or 0),
            "when": pretty_date(r.creation),
            "creation": str(r.creation),
            "document_type": r.document_type,
            "document_name": r.document_name,
            "type": r.type,
        })
    return {"unread": int(unread or 0), "items": items}


@frappe.whitelist()
def mark_read(name=None):
    """Mark one notification (or all, when name is empty) as read."""
    filters = {"for_user": frappe.session.user, "read": 0}
    if name:
        filters["name"] = name
    frappe.db.set_value("Notification Log", filters, "read", 1, update_modified=False)
    return {"ok": True}
