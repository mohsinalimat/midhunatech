<!-- Copyright (c) 2026, Midhunatech and Contributors — GPL-3.0 -->
<!-- Generic in-app workflow approvals: works with any doctype that has an
     active Workflow. List → preview (fields + line items) → Approve/Reject. -->
<template>
  <div class="ap-wrap">
    <div v-if="loading" class="empty-state" style="padding-top:60px;">
      <ion-spinner name="crescent" color="primary" style="font-size:36px;" />
      <p style="margin-top:10px;">Loading approvals…</p>
    </div>

    <div v-else-if="error" class="empty-state" style="padding-top:60px;" role="alert">
      <div class="empty-icon" aria-hidden="true">⚠</div>
      <h3>Could not load</h3>
      <p>{{ error }}</p>
      <ion-button fill="outline" size="small" @click="load">Try again</ion-button>
    </div>

    <div v-else-if="!items.length" class="empty-state" style="padding-top:60px;">
      <div class="empty-icon" aria-hidden="true">✅</div>
      <h3>Nothing to approve</h3>
      <p>No documents are waiting for your action.</p>
    </div>

    <template v-else>
      <div class="ap-count">{{ items.length }} document{{ items.length !== 1 ? "s" : "" }} waiting</div>
      <div class="ap-list">
        <div
          v-for="it in items"
          :key="it.doctype + it.name"
          class="ap-item"
          role="button"
          tabindex="0"
          @click="openDoc(it)"
          @keyup.enter="openDoc(it)"
        >
          <div class="ap-item-top">
            <span class="ap-chip">{{ it.doctype }}</span>
            <span class="ap-state">{{ it.state }}</span>
          </div>
          <div class="ap-title">{{ it.title }}</div>
          <div class="ap-sub">{{ it.name }}</div>
        </div>
      </div>
    </template>

    <!-- ── Preview + actions sheet ── -->
    <ion-modal :is-open="!!current" :initial-breakpoint="0.92" :breakpoints="[0, 0.92]" @didDismiss="current = null">
      <ion-content>
        <div v-if="detailLoading" class="empty-state" style="padding-top:60px;">
          <ion-spinner name="crescent" color="primary" style="font-size:36px;" />
        </div>

        <div v-else-if="detail" class="ap-detail">
          <div class="ap-d-head">
            <div>
              <div class="ap-d-title">{{ detail.title }}</div>
              <div class="ap-d-sub">{{ current.doctype }} · {{ detail.name }}</div>
            </div>
            <span v-if="detail.status" class="ap-state">{{ detail.status }}</span>
          </div>

          <!-- header fields -->
          <div class="ap-fields">
            <div v-for="f in detail.fields" :key="f.label" class="ap-field">
              <div class="ap-f-label">{{ f.label }}</div>
              <div class="ap-f-value">{{ f.value }}</div>
            </div>
          </div>

          <!-- child tables (line items) -->
          <div v-for="t in detail.tables" :key="t.label" class="ap-table-sec">
            <div class="ap-t-label">{{ t.label }}</div>
            <div class="ap-t-scroll">
              <table class="ap-t">
                <thead>
                  <tr><th v-for="c in t.columns" :key="c">{{ c }}</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in t.rows" :key="i">
                    <td v-for="(v, j) in r" :key="j">{{ v }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="actionError" class="ap-err" role="alert">{{ actionError }}</div>

          <!-- workflow actions -->
          <div class="ap-actions">
            <button
              v-for="a in detail.actions"
              :key="a.action"
              class="ap-btn"
              :class="btnClass(a.action)"
              :disabled="!!acting"
              @click="apply(a)"
            >
              <span v-if="acting === a.action" class="mt-spinner" />
              <span v-else>{{ a.action }}</span>
            </button>
            <div v-if="!detail.actions.length" class="ap-noact">No actions available for your role.</div>
          </div>
        </div>
      </ion-content>
    </ion-modal>

    <ion-toast
      :is-open="!!toast"
      :message="toast"
      :duration="2200"
      position="top"
      color="success"
      @didDismiss="toast = ''"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { IonButton, IonContent, IonModal, IonSpinner, IonToast } from "@ionic/vue";
import { apiFetch } from "@/data/session.js";

const loading = ref(true);
const error = ref(null);
const items = ref([]);
const current = ref(null);
const detail = ref(null);
const detailLoading = ref(false);
const acting = ref("");
const actionError = ref("");
const toast = ref("");

onMounted(load);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const r = await apiFetch("/api/method/midhunatech.api.approvals.get_pending");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    items.value = (await r.json()).message || [];
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function openDoc(it) {
  current.value = it;
  detail.value = null;
  detailLoading.value = true;
  actionError.value = "";
  try {
    const q = `doctype=${encodeURIComponent(it.doctype)}&name=${encodeURIComponent(it.name)}`;
    const r = await apiFetch(`/api/method/midhunatech.api.approvals.get_preview?${q}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    detail.value = (await r.json()).message;
  } catch (e) {
    actionError.value = e.message;
    detail.value = { title: it.title, name: it.name, fields: [], tables: [], actions: [] };
  } finally {
    detailLoading.value = false;
  }
}

async function apply(a) {
  acting.value = a.action;
  actionError.value = "";
  try {
    const r = await apiFetch("/api/method/midhunatech.api.approvals.take_action", {
      method: "POST",
      body: JSON.stringify({
        doctype: current.value.doctype,
        name: current.value.name,
        action: a.action,
      }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e._server_messages ? "Action failed — check document" : `HTTP ${r.status}`);
    }
    toast.value = `${a.action}: ${current.value.name} ✓`;
    current.value = null;
    await load();
  } catch (e) {
    actionError.value = e.message;
  } finally {
    acting.value = "";
  }
}

function btnClass(action) {
  const a = (action || "").toLowerCase();
  if (a.includes("reject") || a.includes("cancel")) return "danger";
  if (a.includes("approve") || a.includes("submit")) return "success";
  return "neutral";
}

defineExpose({ reload: load });
</script>

<style scoped>
.ap-wrap { padding: 12px 14px 30px; }
.ap-count { font-size: 12.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .4px; margin: 4px 2px 10px; }
.ap-list { display: flex; flex-direction: column; gap: 10px; }
.ap-item { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; cursor: pointer; }
.ap-item-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.ap-chip { font-size: 10.5px; font-weight: 800; color: #6366f1; background: #eef2ff; border-radius: 999px; padding: 3px 9px; }
.ap-state { font-size: 11px; font-weight: 800; color: #b45309; background: #fef3c7; border-radius: 999px; padding: 3px 9px; }
.ap-title { font-size: 15px; font-weight: 800; color: #1e293b; }
.ap-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }

.ap-detail { padding: 18px 16px 30px; }
.ap-d-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
.ap-d-title { font-size: 18px; font-weight: 900; color: #0f172a; letter-spacing: -.3px; }
.ap-d-sub { font-size: 12px; color: #94a3b8; margin-top: 2px; }
.ap-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.ap-field { background: #f8fafc; border-radius: 12px; padding: 9px 11px; min-width: 0; }
.ap-f-label { font-size: 10.5px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: .3px; }
.ap-f-value { font-size: 13.5px; font-weight: 600; color: #1e293b; margin-top: 2px; word-break: break-word; }

.ap-table-sec { margin-top: 16px; }
.ap-t-label { font-size: 12.5px; font-weight: 800; color: #475569; margin-bottom: 7px; }
.ap-t-scroll { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px; }
.ap-t { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.ap-t th { background: #f8fafc; text-align: left; padding: 8px 10px; font-weight: 700; color: #64748b; white-space: nowrap; }
.ap-t td { padding: 8px 10px; border-top: 1px solid #f1f5f9; color: #1e293b; white-space: nowrap; }

.ap-err { margin-top: 14px; background: #fef2f2; color: #dc2626; font-size: 13px; border-radius: 10px; padding: 10px 12px; }
.ap-actions {
  display: flex; gap: 10px; flex-wrap: wrap;
  position: sticky; bottom: 0; z-index: 5;
  margin: 18px -16px 0; padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: rgba(255, 255, 255, .96);
  backdrop-filter: blur(6px);
  border-top: 1px solid #eef2f7;
}
.ap-btn {
  flex: 1; min-width: 120px; height: 48px; border: none; border-radius: 14px;
  font-size: 15px; font-weight: 800; color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
}
.ap-btn.success { background: #16a34a; }
.ap-btn.danger  { background: #ef4444; }
.ap-btn.neutral { background: #6366f1; }
.ap-btn:disabled { opacity: .6; }
.ap-noact { font-size: 13px; color: #94a3b8; padding: 8px 0; }
</style>
