<!-- Copyright (c) 2024, Midhunatech and Contributors — GPL-3.0 -->
<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-title>Attendance</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Attendance</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content refreshing-spinner="crescent" />
      </ion-refresher>

      <!-- Today's live card -->
      <div class="at-summary">
        <div>
          <div class="at-summary-lbl">Today</div>
          <div class="at-summary-num">{{ formatDuration(checkin.worked_seconds) }}</div>
        </div>
        <span class="ci-status-chip" :class="checkin.checked_in ? 'in' : 'out'">
          <span class="ci-dot" />{{ checkin.checked_in ? 'Checked in' : 'Checked out' }}
        </span>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="empty-state" style="padding-top:50px;">
        <ion-spinner name="crescent" color="primary" style="font-size:34px;" />
      </div>

      <!-- Empty -->
      <div v-else-if="!days.length" class="empty-state">
        <div class="empty-icon">🕐</div>
        <h3>No attendance yet</h3>
        <p>Your check-in and check-out logs will appear here.</p>
      </div>

      <!-- History grouped by day -->
      <template v-else>
        <div v-for="day in days" :key="day.date" class="at-day">
          <div class="at-day-head">
            <span class="at-day-date">{{ day.label }}</span>
            <span class="at-day-total">{{ formatDuration(day.worked) }}</span>
          </div>
          <div class="at-rows">
            <div v-for="log in day.logs" :key="log.name" class="at-row">
              <span class="ci-log-badge" :class="log.log_type === 'IN' ? 'in' : 'out'">
                {{ log.log_type === 'IN' ? '↓' : '↑' }}
              </span>
              <div class="at-row-main">
                <div class="at-row-type">{{ log.log_type === 'IN' ? 'Checked in' : 'Checked out' }}</div>
                <div v-if="log.latitude" class="at-row-geo">📍 {{ log.latitude.toFixed(4) }}, {{ log.longitude.toFixed(4) }}</div>
              </div>
              <div class="at-row-time">{{ formatTime(log.time) }}</div>
            </div>
          </div>
        </div>
      </template>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonRefresher, IonRefresherContent, IonSpinner,
} from "@ionic/vue";
import { checkin, loadDashboard, fetchHistory, formatDuration, formatTime } from "@/data/checkin.js";

const loading = ref(true);
const history = ref([]);

async function load() {
  loading.value = true;
  try {
    await loadDashboard(true);
    history.value = await fetchHistory(100);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

async function onRefresh(e) {
  await load();
  e.target.complete();
}

function dayKey(dt) {
  return String(dt).slice(0, 10);
}
function workedFor(logs) {
  // logs are most-recent-first; sort ascending to pair IN→OUT
  const asc = [...logs].sort((a, b) => a.time.localeCompare(b.time));
  let total = 0, openIn = null;
  for (const l of asc) {
    const t = new Date(String(l.time).replace(" ", "T")).getTime();
    if (l.log_type === "IN") openIn = t;
    else if (l.log_type === "OUT" && openIn) { total += (t - openIn) / 1000; openIn = null; }
  }
  return total;
}

const days = computed(() => {
  const map = {};
  for (const log of history.value) {
    const k = dayKey(log.time);
    (map[k] = map[k] || []).push(log);
  }
  return Object.keys(map)
    .sort((a, b) => b.localeCompare(a))
    .map((date) => {
      const d = new Date(date + "T00:00:00");
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const isToday = d.getTime() === today.getTime();
      return {
        date,
        label: isToday
          ? "Today"
          : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }),
        worked: workedFor(map[date]),
        logs: map[date], // already most-recent-first
      };
    });
});
</script>

<style scoped>
.at-summary {
  margin: 14px 16px 6px; padding: 16px 18px;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 18px;
  display: flex; align-items: center; justify-content: space-between;
}
.at-summary-lbl { font-size: 12px; color: #94a3b8; font-weight: 600; }
.at-summary-num { font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -1px; }

.ci-status-chip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px; font-weight: 700; padding: 5px 11px; border-radius: 999px;
}
.ci-status-chip.in  { background: #dcfce7; color: #15803d; }
.ci-status-chip.out { background: #f1f5f9; color: #64748b; }
.ci-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }

.at-day { margin: 14px 16px 0; }
.at-day-head {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 4px 8px;
}
.at-day-date { font-size: 13px; font-weight: 800; color: #334155; }
.at-day-total { font-size: 12px; font-weight: 700; color: var(--ion-color-primary); }

.at-rows {
  background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;
}
.at-row {
  display: flex; align-items: center; gap: 12px;
  padding: 12px 14px; border-bottom: 1px solid #f1f5f9;
}
.at-row:last-child { border-bottom: none; }
.at-row-main { flex: 1; min-width: 0; }
.at-row-type { font-size: 14px; font-weight: 600; color: #1e293b; }
.at-row-geo  { font-size: 11px; color: #94a3b8; margin-top: 1px; }
.at-row-time { font-size: 13px; font-weight: 700; color: #475569; }

.ci-log-badge {
  width: 30px; height: 30px; border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 15px; flex-shrink: 0;
}
.ci-log-badge.in  { background: #dcfce7; color: #16a34a; }
.ci-log-badge.out { background: #fee2e2; color: #ef4444; }
</style>
