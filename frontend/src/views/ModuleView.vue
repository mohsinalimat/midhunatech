<!-- Copyright (c) 2024, Midhunatech and Contributors — GPL-3.0 -->
<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <!-- iOS swipe-back is handled by Ionic automatically -->
          <ion-back-button
            default-href="/midhunatech/home"
            text="Back"
            :icon="chevronBackOutline"
          />
        </ion-buttons>
        <ion-title>{{ currentMod?.label || "Loading…" }}</ion-title>
        <!-- Open in new tab — useful for frappe_page / iframe_url only -->
        <ion-buttons
          v-if="currentMod?.url && (currentMod.type === 'frappe_page' || currentMod.type === 'iframe_url')"
          slot="end"
        >
          <ion-button @click="openExternal" aria-label="Open in browser">
            <ion-icon slot="icon-only" :icon="openOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">

      <!-- Pull to refresh — native doc_list only -->
      <ion-refresher
        v-if="currentMod && ['doc_list', 'dashboard', 'report', 'custom_view'].includes(currentMod.type)"
        slot="fixed"
        @ionRefresh="onDocRefresh"
      >
        <ion-refresher-content refreshing-spinner="crescent" />
      </ion-refresher>

      <!-- ── Config not loaded ── -->
      <div v-if="!appConfig.loaded" class="empty-state" style="padding-top:80px;">
        <ion-spinner name="crescent" color="primary" style="font-size:36px;" />
        <p style="margin-top:12px;">Loading…</p>
      </div>

      <!-- ── Module not found ── -->
      <div v-else-if="!currentMod" class="empty-state" style="padding-top:80px;" role="alert">
        <div class="empty-icon" aria-hidden="true">⚠</div>
        <h3>Module not found</h3>
        <p>No module with key "{{ slug }}" is configured in PWA App Config.</p>
        <ion-button fill="outline" size="small" router-link="/midhunatech/home" style="margin-top:12px;">
          Go home
        </ion-button>
      </div>

      <!-- ── IFRAME: frappe_page or iframe_url ── -->
      <template v-else-if="currentMod.type === 'frappe_page' || currentMod.type === 'iframe_url'">
        <!-- Loading overlay until iframe fires @load -->
        <div v-if="!iframeReady" class="iframe-overlay">
          <ion-spinner name="crescent" color="primary" style="font-size:36px;" />
          <p style="margin-top:10px;font-size:13px;color:#94a3b8;">Opening {{ currentMod.label }}…</p>
        </div>
        <iframe
          :src="currentMod.url"
          class="full-iframe"
          :style="{ opacity: iframeReady ? 1 : 0 }"
          allow="camera; microphone; geolocation; clipboard-read; clipboard-write"
          :title="`${currentMod.label} frame`"
          @load="iframeReady = true"
        />
      </template>

      <!-- ── NATIVE DOC LIST: one generic UI for any doctype ── -->
      <DocList
        v-else-if="currentMod.type === 'doc_list'"
        ref="docListRef"
        :key="currentMod.url"
        :doctype="currentMod.url"
        :label="currentMod.label"
      />

      <!-- ── KPI DASHBOARD: Frappe Number Cards ── -->
      <DashboardView
        v-else-if="currentMod.type === 'dashboard'"
        ref="docListRef"
        :key="currentMod.url"
        :target="currentMod.url"
      />

      <!-- ── NATIVE REPORT: any Frappe report as a mobile table ── -->
      <ReportView
        v-else-if="currentMod.type === 'report'"
        ref="docListRef"
        :key="currentMod.report || currentMod.url"
        :report="currentMod.report || currentMod.url"
        :filters="parsedReportFilters"
      />

      <!-- ── CUSTOM VIEW: dynamic Vue component ── -->
      <Suspense v-else-if="currentMod.type === 'custom_view'">
        <!-- Loaded component -->
        <component :is="dynComponent" v-if="dynComponent" />
        <!-- No component file found yet -->
        <div v-else class="empty-state" style="padding-top:80px;">
          <div class="empty-icon" aria-hidden="true">🔧</div>
          <h3>{{ currentMod.label }}</h3>
          <p>
            Create a Vue file at:<br>
            <code>src/views/modules/{{ compFilename }}.vue</code>
          </p>
        </div>
        <!-- Suspense fallback while importing -->
        <template #fallback>
          <div class="empty-state" style="padding-top:80px;">
            <ion-spinner name="crescent" color="primary" style="font-size:36px;" />
          </div>
        </template>
      </Suspense>

    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref, computed, defineAsyncComponent, watch } from "vue";
import { useRoute } from "vue-router";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonButtons, IonBackButton, IonButton, IonIcon, IonSpinner,
  IonRefresher, IonRefresherContent,
} from "@ionic/vue";
import { openOutline, chevronBackOutline } from "ionicons/icons";
import { appConfig } from "@/data/session.js";
import DocList from "@/views/modules/DocList.vue";
import DashboardView from "@/views/modules/DashboardView.vue";
import ReportView from "@/views/modules/ReportView.vue";

const route       = useRoute();
const iframeReady = ref(false);
const docListRef  = ref(null);

async function onDocRefresh(e) {
  try { await docListRef.value?.reload(); } finally { e.target.complete(); }
}

const slug = computed(() => decodeURIComponent(route.params.slug || ""));

const currentMod = computed(() =>
  appConfig.modules.find(m => m.name === slug.value) || null
);

// optional default filters for report modules (JSON string in config)
const parsedReportFilters = computed(() => {
  try { return JSON.parse(currentMod.value?.report_filters || "{}"); }
  catch { return {}; }
});

// Reset iframe loaded state whenever we navigate to a different module
watch(slug, () => { iframeReady.value = false; });

// PascalCase filename from module_name key
// e.g. leave_request → LeaveRequest
const compFilename = computed(() =>
  slug.value
    .split(/[_-]/)
    .map(w => w[0]?.toUpperCase() + w.slice(1))
    .join("")
);

// Dynamically import the Vue component for custom_view type
const dynComponent = computed(() => {
  if (currentMod.value?.type !== "custom_view") return null;
  const name = compFilename.value;
  return defineAsyncComponent({
    loader:          () => import(`../views/modules/${name}.vue`),
    errorComponent:  null,   // fall back to placeholder on 404
    suspensible:     true,
    timeout:         5000,
  });
});

function openExternal() {
  const url = currentMod.value?.url;
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}
</script>

<style scoped>
.full-iframe {
  display: block;
  width: 100%; height: 100%;
  border: none;
  transition: opacity .25s ease;
}
.iframe-overlay {
  position: absolute; inset: 0;
  display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  background: var(--ion-background-color);
  z-index: 10;
}
</style>
