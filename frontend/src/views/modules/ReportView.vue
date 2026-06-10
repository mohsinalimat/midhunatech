<!-- Copyright (c) 2026, Midhunatech and Contributors — GPL-3.0 -->
<!-- Native mobile renderer for any Frappe report (Report Builder / Query /
     Script). Optional default filters come from the module row (JSON). -->
<template>
  <div class="rp-wrap">
    <div v-if="loading" class="empty-state" style="padding-top:60px;">
      <ion-spinner name="crescent" color="primary" style="font-size:36px;" />
      <p style="margin-top:10px;">Running {{ report }}…</p>
    </div>

    <div v-else-if="error" class="empty-state" style="padding-top:60px;" role="alert">
      <div class="empty-icon" aria-hidden="true">⚠</div>
      <h3>Report failed</h3>
      <p>{{ error }}</p>
      <ion-button fill="outline" size="small" @click="run">Try again</ion-button>
    </div>

    <div v-else-if="!rows.length" class="empty-state" style="padding-top:60px;">
      <div class="empty-icon" aria-hidden="true">📑</div>
      <h3>No data</h3>
      <p>The report returned no rows.</p>
    </div>

    <template v-else>
      <div class="rp-meta">{{ rows.length }} row{{ rows.length !== 1 ? "s" : "" }}</div>
      <div class="rp-scroll">
        <table class="rp-t">
          <thead>
            <tr><th v-for="c in columns" :key="c.fieldname">{{ c.label }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="(r, i) in rows" :key="i">
              <td v-for="c in columns" :key="c.fieldname">{{ display(r[c.fieldname]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { IonButton, IonSpinner } from "@ionic/vue";
import { apiFetch } from "@/data/session.js";

const props = defineProps({
  report:  { type: String, required: true },
  filters: { type: [String, Object], default: "" },
});

const loading = ref(true);
const error = ref(null);
const columns = ref([]);
const rows = ref([]);

onMounted(run);

async function run() {
  loading.value = true;
  error.value = null;
  try {
    const r = await apiFetch("/api/method/midhunatech.api.reports.run", {
      method: "POST",
      body: JSON.stringify({ report_name: props.report, filters: props.filters || {} }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      throw new Error(e.exception ? e.exception.split(":").pop() : `HTTP ${r.status}`);
    }
    const d = (await r.json()).message;
    columns.value = d.columns || [];
    rows.value = d.rows || [];
  } catch (e) {
    error.value = e.message || "Could not run report";
  } finally {
    loading.value = false;
  }
}

function display(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isInteger(v) ? v : v.toFixed(2);
  return String(v);
}

defineExpose({ reload: run });
</script>

<style scoped>
.rp-wrap { padding: 12px 14px 30px; }
.rp-meta { font-size: 12.5px; font-weight: 700; color: #94a3b8; margin: 4px 2px 10px; }
.rp-scroll { overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 14px; background: #fff; }
.rp-t { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.rp-t th {
  position: sticky; top: 0; background: #f8fafc; text-align: left;
  padding: 9px 11px; font-weight: 700; color: #64748b; white-space: nowrap;
}
.rp-t td { padding: 8px 11px; border-top: 1px solid #f1f5f9; color: #1e293b; white-space: nowrap; }
</style>
