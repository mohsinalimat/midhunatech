# Copyright (c) 2024, Midhunatech and Contributors
# License: GPL-3.0
#
# Self-contained attendance check-in/out for the Midhunatech PWA.
# Does NOT depend on the HRMS app — stores logs in the "Midhunatech Checkin"
# DocType. Each user can only see and create their own logs (the API scopes
# everything to frappe.session.user and uses ignore_permissions for writes).

import frappe
from frappe import _
from frappe.utils import get_datetime, now_datetime, get_fullname

DOCTYPE = "Midhunatech Checkin"


def _today_bounds():
    today = frappe.utils.today()
    return f"{today} 00:00:00", f"{today} 23:59:59"


def _todays_logs(user):
    start, end = _today_bounds()
    return frappe.get_all(
        DOCTYPE,
        filters={"user": user, "time": ["between", [start, end]]},
        fields=["name", "log_type", "time"],
        order_by="time asc",
    )


def _worked_seconds(logs, checked_in_now):
    """Pair IN→OUT logs and sum the durations. If the user is currently
    checked in, count the open interval up to now."""
    total = 0
    open_in = None
    for log in logs:
        t = get_datetime(log.time)
        if log.log_type == "IN":
            open_in = t
        elif log.log_type == "OUT" and open_in:
            total += (t - open_in).total_seconds()
            open_in = None
    if checked_in_now and open_in:
        total += (now_datetime() - open_in).total_seconds()
    return int(max(total, 0))


def _status_for(user):
    logs = _todays_logs(user)
    last = logs[-1] if logs else None
    checked_in = bool(last and last.log_type == "IN")
    # worked_seconds counts only COMPLETED IN→OUT pairs. While the user is
    # checked in, the client adds the live open interval (now − last_time)
    # itself, so we must not include it here or it would be double-counted.
    return {
        "checked_in": checked_in,
        "last_log_type": last.log_type if last else None,
        "last_time": str(last.time) if last else None,
        "worked_seconds": _worked_seconds(logs, False),
        "logs": [
            {"name": l.name, "log_type": l.log_type, "time": str(l.time)} for l in logs
        ],
    }


@frappe.whitelist()
def get_status():
    """Return today's check-in status for the logged-in user."""
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Please log in."))
    return _status_for(user)


@frappe.whitelist()
def toggle(latitude=None, longitude=None, note=None):
    """Create the next log (IN if currently out, OUT if currently in)."""
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Please log in."))

    status = _status_for(user)
    next_type = "OUT" if status["checked_in"] else "IN"

    doc = frappe.new_doc(DOCTYPE)
    doc.user = user
    doc.log_type = next_type
    doc.time = now_datetime()
    if latitude not in (None, ""):
        doc.latitude = float(latitude)
    if longitude not in (None, ""):
        doc.longitude = float(longitude)
    if note:
        doc.note = note
    doc.device = (frappe.request.headers.get("User-Agent") or "")[:140] if frappe.request else ""
    doc.insert(ignore_permissions=True)
    frappe.db.commit()

    result = _status_for(user)
    result["just_logged"] = next_type
    return result


@frappe.whitelist()
def get_history(limit=30):
    """Return the user's recent check-in logs (most recent first), grouped by day."""
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Please log in."))
    rows = frappe.get_all(
        DOCTYPE,
        filters={"user": user},
        fields=["name", "log_type", "time", "latitude", "longitude", "note"],
        order_by="time desc",
        limit_page_length=int(limit),
    )
    return [
        {
            "name": r.name,
            "log_type": r.log_type,
            "time": str(r.time),
            "latitude": r.latitude,
            "longitude": r.longitude,
            "note": r.note,
        }
        for r in rows
    ]


@frappe.whitelist()
def get_dashboard():
    """Everything the Home screen needs in one round-trip: identity, greeting,
    today's check-in summary, and an unread-notification count."""
    user = frappe.session.user
    if user == "Guest":
        frappe.throw(_("Please log in."))

    hour = now_datetime().hour
    greeting = "Good morning" if hour < 12 else "Good afternoon" if hour < 18 else "Good evening"

    unread = frappe.db.count("Notification Log", filters={"for_user": user, "read": 0})

    return {
        "user": user,
        "fullname": get_fullname(user),
        "greeting": greeting,
        "today": frappe.utils.formatdate(frappe.utils.today(), "EEEE, d MMM"),
        "status": _status_for(user),
        "unread_notifications": int(unread or 0),
    }
