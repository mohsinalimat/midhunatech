# Copyright (c) 2026, Midhunatech and Contributors
# License: GPL-3.0
"""
Generic in-app workflow approvals for the PWA.

Works with ANY doctype that has an active Workflow (Purchase Order,
Sales Invoice, Delivery Note, Material Request, ...): lists documents
waiting in a state the current user's roles can act on, lets the user
preview them (via midhunatech.api.data.get_doc) and apply a transition
(Approve / Reject / ...) — all without ever opening the desk.
"""

import frappe
from frappe import _
from frappe.model.workflow import apply_workflow, get_transitions


def _active_workflows():
    """Active workflows whose doctype actually exists on this site."""
    for wf in frappe.get_all(
        "Workflow",
        filters={"is_active": 1},
        fields=["name", "document_type", "workflow_state_field"],
    ):
        if frappe.db.exists("DocType", wf.document_type):
            yield wf


@frappe.whitelist()
def get_pending(limit=50):
    """Documents the current user can act on, newest first."""
    user_roles = set(frappe.get_roles())
    out = []
    for wf in _active_workflows():
        try:
            if not frappe.has_permission(wf.document_type, "read"):
                continue
            transitions = frappe.get_all(
                "Workflow Transition",
                filters={"parent": wf.name},
                fields=["state", "allowed"],
            )
            states = sorted({t.state for t in transitions if t.allowed in user_roles})
            if not states:
                continue

            meta = frappe.get_meta(wf.document_type)
            sf = wf.workflow_state_field or "workflow_state"
            if not meta.has_field(sf):
                continue
            fields = ["name", sf, "modified"]
            title_field = meta.title_field if (meta.title_field and meta.has_field(meta.title_field)) else None
            if title_field and title_field not in fields:
                fields.append(title_field)

            docs = frappe.get_list(
                wf.document_type,
                filters={sf: ["in", states]},
                fields=fields,
                order_by="modified desc",
                limit_page_length=int(limit),
            )
            for d in docs:
                out.append({
                    "doctype": wf.document_type,
                    "name": d.name,
                    "title": (d.get(title_field) if title_field else None) or d.name,
                    "state": d.get(sf),
                    "modified": str(d.modified),
                })
        except Exception:
            # one broken workflow must never take the whole list down
            frappe.clear_messages()
            continue

    out.sort(key=lambda x: x["modified"], reverse=True)
    return out


@frappe.whitelist()
def pending_count():
    """Badge count for the Approvals tile / tab."""
    return len(get_pending())


@frappe.whitelist()
def get_actions(doctype, name):
    """Transitions the current user may apply to this document."""
    doc = frappe.get_doc(doctype, name)
    if not frappe.has_permission(doctype, "read", doc=doc):
        frappe.throw(_("Not permitted"), frappe.PermissionError)
    return [{"action": t.action, "next_state": t.next_state} for t in get_transitions(doc)]


@frappe.whitelist()
def get_preview(doctype, name):
    """Full mobile preview: header fields + child tables + allowed actions."""
    from midhunatech.api.data import _fmt, get_doc as data_get_doc

    out = data_get_doc(doctype, name)  # permission-checked, permlevel-safe
    doc = frappe.get_doc(doctype, name)
    meta = frappe.get_meta(doctype)

    tables = []
    for df in meta.fields:
        if df.fieldtype != "Table":
            continue
        rows = doc.get(df.fieldname) or []
        if not rows:
            continue
        cmeta = frappe.get_meta(df.options)
        cols = [c for c in cmeta.fields if c.in_list_view and c.fieldtype != "Table"][:4]
        if not cols:
            continue
        tables.append({
            "label": df.label or df.fieldname,
            "columns": [c.label or c.fieldname for c in cols],
            "rows": [[_fmt(c, r.get(c.fieldname)) for c in cols] for r in rows[:30]],
        })

    out["tables"] = tables
    out["actions"] = [{"action": t.action, "next_state": t.next_state} for t in get_transitions(doc)]
    return out


@frappe.whitelist()
def take_action(doctype, name, action):
    """Apply a workflow transition (permission-checked by apply_workflow)."""
    doc = frappe.get_doc(doctype, name)
    apply_workflow(doc, action)
    sf = (
        frappe.db.get_value("Workflow", {"document_type": doctype, "is_active": 1}, "workflow_state_field")
        or "workflow_state"
    )
    doc.reload()
    return {"ok": True, "state": doc.get(sf)}
