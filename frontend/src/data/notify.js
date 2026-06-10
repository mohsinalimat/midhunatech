// Copyright (c) 2026, Midhunatech and Contributors — GPL-3.0
// Reactive notification feed state for the PWA

import { reactive } from "vue";
import { apiFetch } from "@/data/session.js";

export const notify = reactive({
  unread: 0,
  items: [],
  loading: false,
  error: null,
});

export async function loadFeed(limit = 30) {
  notify.loading = true;
  try {
    const r = await apiFetch(`/api/method/midhunatech.api.notifications.get_feed?limit=${limit}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = (await r.json()).message;
    notify.unread = d.unread || 0;
    notify.items = d.items || [];
    notify.error = null;
  } catch (e) {
    notify.error = e.message || "Could not load notifications";
  } finally {
    notify.loading = false;
  }
}

export async function markRead(name = null) {
  try {
    await apiFetch("/api/method/midhunatech.api.notifications.mark_read", {
      method: "POST",
      body: JSON.stringify(name ? { name } : {}),
    });
    if (name) {
      const it = notify.items.find((i) => i.name === name);
      if (it && !it.read) {
        it.read = 1;
        notify.unread = Math.max(0, notify.unread - 1);
      }
    } else {
      notify.items.forEach((i) => (i.read = 1));
      notify.unread = 0;
    }
  } catch {
    /* non-fatal */
  }
}
