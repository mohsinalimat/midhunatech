// Copyright (c) 2024, Midhunatech and Contributors — GPL-3.0
// HRMS client for the Midhunatech PWA. Talks to the real HRMS app
// (hrms.api.* methods) + standard Frappe document CRUD, so the PWA behaves
// like the native Frappe HR mobile app.

import { reactive } from "vue";
import { apiFetch } from "@/data/session.js";

// ── Low-level helpers ──────────────────────────────────────────────────────────

function qs(params = {}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    sp.append(k, typeof v === "object" ? JSON.stringify(v) : v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function apiGet(method, params = {}) {
  const r = await apiFetch(`/api/method/${method}${qs(params)}`);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(extractError(d) || `HTTP ${r.status}`);
  return d.message;
}

export async function apiPost(method, body = {}) {
  const r = await apiFetch(`/api/method/${method}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(extractError(d) || `HTTP ${r.status}`);
  return d.message;
}

export function extractError(d) {
  try {
    if (d?._server_messages) {
      const m = JSON.parse(d._server_messages);
      if (m.length) return JSON.parse(m[0]).message?.replace(/<[^>]*>/g, "") || null;
    }
  } catch { /* ignore */ }
  return (d?.exception || d?.message || "").toString().replace(/<[^>]*>/g, "") || null;
}

// Document CRUD via standard Frappe endpoints
export const getList = (doctype, opts = {}) =>
  apiGet("frappe.client.get_list", {
    doctype,
    fields: opts.fields || ["name"],
    filters: opts.filters || {},
    order_by: opts.order_by || "modified desc",
    limit_page_length: opts.limit ?? 20,
  });

export const getDoc = (doctype, name) =>
  apiGet("frappe.client.get", { doctype, name });

export const insertDoc = (doc) => apiPost("frappe.client.insert", { doc });
export const submitDoc = (doc) => apiPost("frappe.client.submit", { doc });
export const setValue = (doctype, name, fieldname, value) =>
  apiPost("frappe.client.set_value", { doctype, name, fieldname, value });

// ── Reactive store ─────────────────────────────────────────────────────────────

export const hrms = reactive({
  employee: null,        // {name, employee_name, designation, ...}
  isEmployee: false,
  loaded: false,
  loading: false,
  error: null,
  leaveBalance: {},      // {leave_type: {allocated_leaves, balance_leaves, ...}}
  unread: 0,
  company: null,
});

let employeePromise = null;

/** Load current employee + company + unread count. Cached. */
export async function loadEmployee(force = false) {
  if (hrms.loaded && !force) return hrms.employee;
  if (employeePromise && !force) return employeePromise;
  hrms.loading = true;
  hrms.error = null;
  employeePromise = (async () => {
    try {
      const emp = await apiGet("hrms.api.get_current_employee_info");
      hrms.employee = emp || null;
      hrms.isEmployee = !!(emp && emp.name);
      hrms.company = emp?.company || null;
      hrms.loaded = true;
      return emp;
    } catch (e) {
      hrms.error = e.message;
      hrms.isEmployee = false;
      hrms.loaded = true;
      return null;
    } finally {
      hrms.loading = false;
    }
  })();
  return employeePromise;
}

export async function loadLeaveBalance() {
  try {
    const map = await apiGet("hrms.api.get_leave_balance_map");
    // add percentage
    for (const v of Object.values(map || {})) {
      v.balance_percentage = v.allocated_leaves
        ? (v.balance_leaves / v.allocated_leaves) * 100
        : 0;
    }
    hrms.leaveBalance = map || {};
    return hrms.leaveBalance;
  } catch {
    return {};
  }
}

export async function loadUnread() {
  try {
    hrms.unread = (await apiGet("hrms.api.get_unread_notifications_count")) || 0;
  } catch { hrms.unread = 0; }
  return hrms.unread;
}

// ── Leave ───────────────────────────────────────────────────────────────────────

export const getLeaveApplications = (opts = {}) =>
  apiGet("hrms.api.get_leave_applications", {
    employee: hrms.employee?.name,
    limit: opts.limit ?? 20,
    for_approval: opts.forApproval ? 1 : 0,
    approver_id: opts.forApproval ? hrms.employee?.user_id : undefined,
  });

export const getLeaveTypes = (date) =>
  apiGet("hrms.api.get_leave_types", { employee: hrms.employee?.name, date });

export const getLeaveApprovalDetails = () =>
  apiGet("hrms.api.get_leave_approval_details", { employee: hrms.employee?.name });

// ── Expense Claims ────────────────────────────────────────────────────────────

export const getExpenseClaims = (opts = {}) =>
  apiGet("hrms.api.get_expense_claims", {
    employee: hrms.employee?.name,
    limit: opts.limit ?? 20,
    for_approval: opts.forApproval ? 1 : 0,
    approver_id: opts.forApproval ? hrms.employee?.user_id : undefined,
  });

export const getExpenseClaimSummary = () =>
  apiGet("hrms.api.get_expense_claim_summary");

export const getExpenseClaimTypes = () =>
  apiGet("hrms.api.get_expense_claim_types");

export const getExpenseApprovalDetails = () =>
  apiGet("hrms.api.get_expense_approval_details", { employee: hrms.employee?.name });

// ── Salary ───────────────────────────────────────────────────────────────────────

export const getSalarySlips = () =>
  getList("Salary Slip", {
    fields: ["name", "posting_date", "start_date", "end_date", "gross_pay", "net_pay", "total_deduction", "status", "currency"],
    filters: { employee: hrms.employee?.name, docstatus: 1 },
    order_by: "start_date desc",
    limit: 24,
  });

// ── Attendance / Check-in ──────────────────────────────────────────────────────

export const getCheckins = (limit = 30) =>
  getList("Employee Checkin", {
    fields: ["name", "log_type", "time", "latitude", "longitude"],
    filters: { employee: hrms.employee?.name },
    order_by: "time desc",
    limit,
  });

export const addCheckin = (logType, coords = null) =>
  insertDoc({
    doctype: "Employee Checkin",
    employee: hrms.employee?.name,
    log_type: logType,
    time: nowStr(),
    ...(coords ? { latitude: coords.latitude, longitude: coords.longitude } : {}),
  });

export const getAttendanceRequests = (opts = {}) =>
  apiGet("hrms.api.get_attendance_requests", {
    employee: hrms.employee?.name,
    limit: opts.limit ?? 20,
    for_approval: opts.forApproval ? 1 : 0,
  });

// ── Utilities ──────────────────────────────────────────────────────────────────

export function nowStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function fmtDate(v) {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateShort(v) {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (isNaN(d)) return String(v);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function fmtTime(v) {
  if (!v) return "—";
  const d = new Date(String(v).replace(" ", "T"));
  if (isNaN(d)) return String(v);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function fmtMoney(v, currency = "INR") {
  const n = Number(v || 0);
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
  } catch {
    return n.toLocaleString();
  }
}

const STATUS_COLORS = {
  Approved: "green", Open: "amber", Rejected: "red", Cancelled: "gray",
  Draft: "gray", Submitted: "blue", Paid: "green", Pending: "amber",
};
export function statusColor(status) {
  return STATUS_COLORS[status] || "gray";
}

export function getCoords() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 5000, maximumAge: 60000 }
    );
  });
}
