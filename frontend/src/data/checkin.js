// Copyright (c) 2024, Midhunatech and Contributors — GPL-3.0
// Check-in / attendance client for the self-contained Midhunatech Checkin API.

import { reactive } from "vue";
import { apiFetch } from "@/data/session.js";

const BASE = "/api/method/midhunatech.api.checkin";

export const checkin = reactive({
  loaded:        false,
  loading:       false,
  toggling:      false,
  error:         null,
  // dashboard
  greeting:      "",
  today:         "",
  fullname:      "",
  unread:        0,
  // status
  checked_in:    false,
  last_log_type: null,
  last_time:     null,
  worked_seconds: 0,
  logs:          [],
});

function applyStatus(s) {
  if (!s) return;
  checkin.checked_in     = s.checked_in;
  checkin.last_log_type  = s.last_log_type;
  checkin.last_time      = s.last_time;
  checkin.worked_seconds = s.worked_seconds || 0;
  checkin.logs           = s.logs || [];
}

/** Load the dashboard payload (identity + greeting + today's status). */
export async function loadDashboard(force = false) {
  if (checkin.loaded && !force) return;
  checkin.loading = true;
  checkin.error   = null;
  try {
    const r = await apiFetch(`${BASE}.get_dashboard`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = (await r.json()).message;
    checkin.greeting = d.greeting;
    checkin.today    = d.today;
    checkin.fullname = d.fullname;
    checkin.unread   = d.unread_notifications || 0;
    applyStatus(d.status);
    checkin.loaded = true;
  } catch (e) {
    checkin.error = e.message || "Could not load dashboard.";
  } finally {
    checkin.loading = false;
  }
}

/** Toggle check-in / check-out. Optionally attaches geolocation. */
export async function toggleCheckin(coords = null) {
  checkin.toggling = true;
  checkin.error    = null;
  try {
    const body = {};
    if (coords) {
      body.latitude  = coords.latitude;
      body.longitude = coords.longitude;
    }
    const r = await apiFetch(`${BASE}.toggle`, {
      method: "POST",
      body:   JSON.stringify(body),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.message || `HTTP ${r.status}`);
    }
    const d = (await r.json()).message;
    applyStatus(d);
    return d.just_logged;   // "IN" | "OUT"
  } catch (e) {
    checkin.error = e.message || "Check-in failed.";
    throw e;
  } finally {
    checkin.toggling = false;
  }
}

/** Fetch recent history (not stored in the shared reactive state). */
export async function fetchHistory(limit = 30) {
  const r = await apiFetch(`${BASE}.get_history?limit=${limit}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()).message || [];
}

/** Best-effort geolocation — resolves null if denied/unavailable. */
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

/** Format seconds → "8h 12m". */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Format an ISO-ish datetime → "9:05 AM". */
export function formatTime(dt) {
  if (!dt) return "—";
  const d = new Date(String(dt).replace(" ", "T"));
  if (isNaN(d)) return String(dt);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
