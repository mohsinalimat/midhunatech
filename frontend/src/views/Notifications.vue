<!-- Copyright (c) 2026, Midhunatech and Contributors — GPL-3.0 -->
<template>
  <ion-page>
    <ion-header :translucent="true">
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/midhunatech/home" text="Back" />
        </ion-buttons>
        <ion-title>Notifications</ion-title>
        <ion-buttons slot="end">
          <ion-button v-if="notify.unread" @click="markAll" aria-label="Mark all read">
            Read all
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true">
      <ion-refresher slot="fixed" @ionRefresh="onRefresh">
        <ion-refresher-content refreshing-spinner="crescent" />
      </ion-refresher>

      <div v-if="notify.loading && !notify.items.length" class="empty-state" style="padding-top:80px;">
        <ion-spinner name="crescent" color="primary" style="font-size:36px;" />
      </div>

      <div v-else-if="notify.error" class="empty-state" style="padding-top:80px;" role="alert">
        <div class="empty-icon" aria-hidden="true">⚠</div>
        <h3>Could not load</h3>
        <p>{{ notify.error }}</p>
        <ion-button fill="outline" size="small" @click="loadFeed()">Try again</ion-button>
      </div>

      <div v-else-if="!notify.items.length" class="empty-state" style="padding-top:80px;">
        <div class="empty-icon" aria-hidden="true">🔔</div>
        <h3>All caught up</h3>
        <p>No notifications yet.</p>
      </div>

      <div v-else class="nf-list">
        <div
          v-for="n in notify.items"
          :key="n.name"
          class="nf-item"
          :class="{ unread: !n.read }"
          role="button"
          tabindex="0"
          @click="open(n)"
          @keyup.enter="open(n)"
        >
          <span class="nf-dot" :class="{ on: !n.read }" aria-hidden="true" />
          <div class="nf-body">
            <div class="nf-subject">{{ n.subject || "(no subject)" }}</div>
            <div v-if="expanded === n.name && n.body" class="nf-text">{{ n.body }}</div>
            <div class="nf-meta">
              <span v-if="n.document_type" class="nf-chip">{{ n.document_type }}</span>
              <span class="nf-when">{{ n.when }}</span>
            </div>
          </div>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup>
import { onMounted, ref } from "vue";
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButtons,
  IonBackButton, IonButton, IonSpinner, IonRefresher, IonRefresherContent,
} from "@ionic/vue";
import { notify, loadFeed, markRead } from "@/data/notify.js";

const expanded = ref(null);

onMounted(() => loadFeed());

async function onRefresh(e) {
  await loadFeed();
  e.target.complete();
}

function open(n) {
  expanded.value = expanded.value === n.name ? null : n.name;
  if (!n.read) markRead(n.name);
}

function markAll() {
  markRead(null);
}
</script>

<style scoped>
.nf-list { padding: 12px 14px 30px; display: flex; flex-direction: column; gap: 10px; }
.nf-item {
  display: flex; gap: 10px; align-items: flex-start;
  background: #fff; border: 1px solid #e2e8f0; border-radius: 16px;
  padding: 13px 14px; cursor: pointer;
}
.nf-item.unread { border-color: rgba(99, 102, 241, .45); background: #fbfbff; }
.nf-dot {
  width: 9px; height: 9px; border-radius: 50%;
  background: transparent; margin-top: 6px; flex-shrink: 0;
}
.nf-dot.on { background: var(--ion-color-primary, #6366f1); }
.nf-body { min-width: 0; flex: 1; }
.nf-subject { font-size: 14px; font-weight: 700; color: #1e293b; line-height: 1.4; }
.nf-text { font-size: 13px; color: #475569; margin-top: 6px; line-height: 1.5; white-space: pre-line; }
.nf-meta { display: flex; align-items: center; gap: 8px; margin-top: 7px; }
.nf-chip {
  font-size: 10.5px; font-weight: 700; color: #6366f1; background: #eef2ff;
  border-radius: 999px; padding: 2px 8px;
}
.nf-when { font-size: 11.5px; color: #94a3b8; }
</style>
