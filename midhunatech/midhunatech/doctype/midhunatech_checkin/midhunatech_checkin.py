# Copyright (c) 2024, Midhunatech and Contributors
# License: GPL-3.0

import frappe
from frappe.model.document import Document


class MidhunatechCheckin(Document):
    def validate(self):
        if not self.time:
            self.time = frappe.utils.now_datetime()
        if self.log_type not in ("IN", "OUT"):
            frappe.throw("Log Type must be IN or OUT")
