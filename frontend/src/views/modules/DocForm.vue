<!-- Copyright (c) 2024, Midhunatech and Contributors — GPL-3.0 -->
<!-- Generic native "create record" form for any doctype (meta-driven). -->
<template>
  <ion-modal :is-open="open" @didDismiss="$emit('close')">
    <ion-header>
      <ion-toolbar>
        <ion-title class="df-title">New {{ doctype }}</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="$emit('close')">Cancel</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- loading meta -->
      <div v-if="loading" class="df-center"><ion-spinner name="crescent" color="primary" /></div>

      <!-- not creatable here -->
      <div v-else-if="notCreatable" class="df-center df-note">
        <div class="df-note-ico">📝</div>
        <p>{{ notCreatable }}</p>
      </div>

      <!-- form -->
      <template v-else>
        <div v-for="f in fields" :key="f.fieldname" class="df-field">
          <label class="df-label">
            {{ f.label }} <span v-if="f.reqd" class="df-req">*</span>
          </label>

          <!-- Select -->
          <select v-if="f.fieldtype === 'Select'" v-model="form[f.fieldname]" class="df-input">
            <option value="">— select —</option>
            <option v-for="o in selectOptions(f)" :key="o" :value="o">{{ o }}</option>
          </select>

          <!-- Check -->
          <ion-toggle v-else-if="f.fieldtype === 'Check'" :checked="!!form[f.fieldname]"
            @ionChange="form[f.fieldname] = $event.detail.checked ? 1 : 0" />

          <!-- Link (autocomplete) -->
          <div v-else-if="f.fieldtype === 'Link'" class="df-link">
            <input class="df-input" :value="form[f.fieldname]"
              :placeholder="`Search ${f.options}`"
              @input="onLink(f, $event.target.value)" @focus="onLink(f, form[f.fieldname] || '')" />
            <ul v-if="linkFor === f.fieldname && linkResults.length" class="df-link-list">
              <li v-for="o in linkResults" :key="o.value" @mousedown.prevent="pickLink(f, o)">
                <b>{{ o.value }}</b><span v-if="o.label !== o.value"> — {{ o.label }}</span>
              </li>
            </ul>
          </div>

          <!-- Long text -->
          <textarea v-else-if="['Text','Small Text','Long Text','Text Editor'].includes(f.fieldtype)"
            v-model="form[f.fieldname]" class="df-input df-textarea" rows="3" />

          <!-- Numbers / dates / data -->
          <input v-else v-model="form[f.fieldname]" class="df-input" :type="inputType(f.fieldtype)" />
        </div>

        <div v-if="error" class="df-error" role="alert">{{ error }}</div>

        <button class="df-submit" :disabled="!canSubmit || saving" @click="submit">
          <ion-spinner v-if="saving" name="crescent" style="width:18px;height:18px;" />
          <span v-else>Create {{ doctype }}</span>
        </button>
      </template>
    </ion-content>
  </ion-modal>
</template>

<script setup>
import { ref, reactive, computed, watch } from "vue";
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonSpinner, IonToggle,
} from "@ionic/vue";
import { getCreateMeta, searchLink, createDoc } from "@/data/docdata.js";

const props = defineProps({
  open:    { type: Boolean, default: false },
  doctype: { type: String, required: true },
  label:   { type: String, default: "" },
});
const emit = defineEmits(["close", "created"]);

const loading = ref(false);
const saving = ref(false);
const error = ref(null);
const notCreatable = ref(null);
const fields = ref([]);
const form = reactive({});

const linkFor = ref(null);
const linkResults = ref([]);
let linkTimer = null;

watch(() => props.open, async (isOpen) => {
  if (!isOpen) return;
  // reset
  error.value = null; notCreatable.value = null; fields.value = [];
  Object.keys(form).forEach(k => delete form[k]);
  loading.value = true;
  try {
    const meta = await getCreateMeta(props.doctype);
    if (!meta.creatable) { notCreatable.value = meta.reason; return; }
    fields.value = meta.fields;
    for (const f of meta.fields) {
      form[f.fieldname] = f.fieldtype === "Check" ? (Number(f.default) ? 1 : 0) : (f.default || "");
    }
  } catch (e) {
    notCreatable.value = e.message;
  } finally {
    loading.value = false;
  }
});

function selectOptions(f) {
  return (f.options || "").split("\n").map(s => s.trim()).filter(Boolean);
}
function inputType(ft) {
  if (["Int", "Float", "Currency", "Percent"].includes(ft)) return "number";
  if (ft === "Date") return "date";
  if (ft === "Datetime") return "datetime-local";
  if (ft === "Time") return "time";
  if (ft === "Phone") return "tel";
  return "text";
}

function onLink(f, txt) {
  form[f.fieldname] = txt;
  linkFor.value = f.fieldname;
  clearTimeout(linkTimer);
  linkTimer = setTimeout(async () => {
    try { linkResults.value = await searchLink(f.options, txt); }
    catch { linkResults.value = []; }
  }, 250);
}
function pickLink(f, o) {
  form[f.fieldname] = o.value;
  linkResults.value = [];
  linkFor.value = null;
}

const canSubmit = computed(() =>
  fields.value.filter(f => f.reqd).every(f => form[f.fieldname] !== "" && form[f.fieldname] != null));

async function submit() {
  saving.value = true;
  error.value = null;
  try {
    const res = await createDoc(props.doctype, { ...form });
    emit("created", res.name);
    emit("close");
  } catch (e) {
    error.value = e.message || "Could not create.";
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.df-title { font-size: 16px; font-weight: 800; }
.df-center { display: flex; flex-direction: column; align-items: center; padding: 50px 20px; color: #64748b; }
.df-note-ico { font-size: 38px; margin-bottom: 10px; }
.df-note p { text-align: center; font-size: 14px; }

.df-field { margin-bottom: 16px; }
.df-label { display: block; font-size: 12.5px; font-weight: 700; color: #475569; margin-bottom: 6px; }
.df-req { color: #ef4444; }
.df-input {
  width: 100%; border: 1px solid #d8dee9; border-radius: 12px; padding: 12px 14px;
  font-size: 15px; background: #fff; color: #1e293b; -webkit-appearance: none; appearance: none;
  font-family: inherit;
}
.df-input:focus { outline: none; border-color: var(--ion-color-primary); }
.df-textarea { resize: vertical; }

.df-link { position: relative; }
.df-link-list {
  position: absolute; z-index: 30; top: 100%; left: 0; right: 0; margin: 4px 0 0; padding: 4px;
  list-style: none; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
  box-shadow: 0 8px 24px rgba(15,23,42,.12); max-height: 220px; overflow-y: auto;
}
.df-link-list li { padding: 9px 12px; font-size: 13.5px; border-radius: 8px; cursor: pointer; }
.df-link-list li:hover { background: #f1f5f9; }

.df-error { background: #fef2f2; color: #dc2626; font-size: 13px; border-radius: 10px;
  padding: 10px 12px; margin-bottom: 12px; }
.df-submit {
  width: 100%; height: 50px; border: none; border-radius: 14px; margin-top: 6px;
  background: var(--ion-color-primary); color: #fff; font-size: 15.5px; font-weight: 800;
  display: flex; align-items: center; justify-content: center; cursor: pointer;
}
.df-submit:disabled { opacity: .5; }
</style>
