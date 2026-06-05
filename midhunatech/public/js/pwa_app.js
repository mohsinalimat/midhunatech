/* Copyright (c) 2024, Midhunatech and Contributors — GPL-3.0
   Single-file production PWA logic for /pwa. Renders any tile type configured
   in "Midhunatech PWA Config". */
(function () {
  "use strict";
  var BOOT = window.PWA_BOOT || {};
  var state = { config: null, modules: [], current: null, search: "" };

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var scrub = function (s) { return String(s || "").toLowerCase().replace(/ /g, "-"); };

  var ICON_MAP = {
    calendar: "📅", "check-circle": "✅", clipboard: "📋", users: "👥", briefcase: "💼",
    dollar: "💰", clock: "🕐", file: "📄", settings: "⚙️", star: "⭐", bell: "🔔",
    location: "📍", chart: "📊", box: "📦", shield: "🛡️", heart: "❤️", mail: "✉️",
    phone: "📞", home: "🏠", "trend-up": "📈", task: "✔️", report: "📑", grid: "⊞"
  };
  function iconOf(m) {
    var ic = m.icon || "";
    if (ICON_MAP[ic]) return ICON_MAP[ic];
    return ic || "⊞";
  }
  function typeChip(t) {
    return ({
      doctype: "List", list_view: "List", doc_list: "List", form_view: "Form",
      report: "Report", number_card: "KPI", dashboard: "Dashboard", webpage: "Web",
      custom_html: "HTML", url: "Link", frappe_page: "Desk", iframe_url: "Web",
      custom_view: "Built-in"
    })[t] || t;
  }
  function dtOf(m) { return m.doctype_name || m.target_url || ""; }
  function badgeClass(s) {
    s = (s || "").toLowerCase();
    if (/(submit|approv|complet|paid|active|present|success|closed|open|done|enabled)/.test(s)) return "b-ok";
    if (/(draft|pending|to |unpaid|requested|review|hold|queued)/.test(s)) return "b-warn";
    if (/(cancel|reject|fail|overdue|absent|expired|error|disabled)/.test(s)) return "b-bad";
    return "b-neu";
  }

  /* ── API ───────────────────────────────────────────────────────────────── */
  function api(method, args, httpMethod) {
    var headers = { "X-Frappe-CSRF-Token": BOOT.csrf || "", "Accept": "application/json" };
    var url = "/api/method/" + method;
    var opts = { credentials: "include", headers: headers };
    if (httpMethod === "GET") {
      var qs = new URLSearchParams();
      Object.keys(args || {}).forEach(function (k) {
        if (args[k] != null) qs.append(k, typeof args[k] === "object" ? JSON.stringify(args[k]) : args[k]);
      });
      var q = qs.toString();
      if (q) url += "?" + q;
    } else {
      headers["Content-Type"] = "application/json";
      opts.method = "POST";
      opts.body = JSON.stringify(args || {});
    }
    return fetch(url, opts).then(function (r) {
      if (r.status === 401 || r.status === 403) { handleAuth(); throw new Error("Not authenticated"); }
      return r.json().then(function (d) {
        if (!r.ok) {
          var msg = "Error";
          try { msg = JSON.parse(d._server_messages || "[]")[0]; msg = JSON.parse(msg).message || msg; } catch (e) {}
          throw new Error(msg || d.message || ("HTTP " + r.status));
        }
        return d.message;
      });
    });
  }
  function handleAuth() {
    location.href = "/login?redirect-to=" + encodeURIComponent("/pwa");
  }

  /* ── theming ───────────────────────────────────────────────────────────── */
  function applyTheme(c) {
    var r = document.documentElement.style;
    r.setProperty("--primary", c.primary_color || "#6366f1");
    r.setProperty("--secondary", c.secondary_color || "#8b5cf6");
    r.setProperty("--accent", c.accent_color || "#22c55e");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", c.theme_color || c.primary_color || "#6366f1");
    if (c.custom_css) { var s = el("style"); s.textContent = c.custom_css; document.head.appendChild(s); }
    if (c.custom_js) { try { var sc = el("script"); sc.textContent = c.custom_js; document.body.appendChild(sc); } catch (e) {} }
  }
  function initTheme() {
    var t = localStorage.getItem("mt_pwa_theme") || "light";
    document.documentElement.setAttribute("data-theme", t);
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme");
    var nxt = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nxt);
    localStorage.setItem("mt_pwa_theme", nxt);
  }

  /* ── boot ──────────────────────────────────────────────────────────────── */
  function boot() {
    initTheme();
    api("midhunatech.api.pwa_api.get_pwa_config", {}, "GET").then(function (c) {
      state.config = c;
      state.modules = c.modules || [];
      applyTheme(c);
      $("hTitle").textContent = c.app_name || "Midhunatech";
      if (c.logo) {
        $("hLogo").innerHTML = '<img src="' + esc(c.logo) + '">';
        $("splashLogo").innerHTML = '<img src="' + esc(c.logo) + '" style="width:100%;height:100%;border-radius:24px;object-fit:cover;">';
      } else {
        var ini = (c.app_name || "M").trim()[0].toUpperCase();
        $("hLogo").textContent = ini; $("splashLogo").textContent = ini;
      }
      buildBottomNav();
      route();
      $("app").style.display = "flex";
      if (c.offline_mode_enabled) registerSW();
      setTimeout(function () {
        if (c.splash_screen_enabled === 0) { $("splash").style.display = "none"; }
        else { $("splash").classList.add("hide"); setTimeout(function () { $("splash").style.display = "none"; }, 480); }
      }, 550);
    }).catch(function (e) {
      if (String(e.message).indexOf("authenticated") > -1) return;
      $("splash").classList.add("hide");
      $("app").style.display = "flex";
      $("main").innerHTML = "";
      $("main").appendChild(emptyState("⚠", "Couldn't load", e.message, "Retry", boot));
    });
  }

  /* ── router ────────────────────────────────────────────────────────────── */
  function route() {
    var h = location.hash.replace(/^#/, "");
    var main = $("main");
    closeSheet();
    setSearch(false);
    if (!h || h === "home") { state.current = null; renderHome(); setBack(false); return; }
    var parts = h.split("/");
    if (parts[0] === "m") {
      var key = decodeURIComponent(parts[1] || "");
      var m = state.modules.filter(function (x) { return x.module_name === key; })[0];
      if (!m) { renderHome(); return; }
      state.current = m;
      setBack(true);
      setHeader(m.label);
      renderModule(m, main, false);
    } else if (parts[0] === "doc") {
      setBack(true);
      renderDetail(main, decodeURIComponent(parts[1]), decodeURIComponent(parts[2]));
    } else { renderHome(); setBack(false); }
  }
  function go(hash) { location.hash = hash; }
  function setBack(show) { $("backBtn").classList.toggle("show", !!show); $("fab").style.display = "none"; }
  function setHeader(t) { $("hTitle").textContent = t || state.config.app_name; }

  /* ── home ──────────────────────────────────────────────────────────────── */
  function renderHome() {
    setHeader(state.config.app_name);
    var main = $("main");
    main.innerHTML = "";
    var scr = el("div", "screen");
    if (!state.modules.length) {
      scr.appendChild(emptyState("⊞", "No tiles yet", "Add modules in Midhunatech PWA Config.", null, null));
      main.appendChild(scr); return;
    }
    var grid = el("div", "grid");
    state.modules.forEach(function (m) {
      var from = m.gradient_from || m.color || "#6366f1";
      var to = m.gradient_to || m.color || "#8b5cf6";
      var t = el("div", "tile");
      t.style.background = "linear-gradient(135deg," + from + "," + to + ")";
      var badge = (m.badge != null && m.badge > 0) ? '<span class="tile-badge">' + m.badge + "</span>" : "";
      t.innerHTML = badge +
        '<span class="tile-chip">' + esc(typeChip(m.module_type)) + "</span>" +
        '<div class="tile-ico">' + esc(iconOf(m)) + "</div>" +
        '<div class="tile-label">' + esc(m.label) + "</div>";
      t.onclick = function () {
        if (m.open_in_modal) openSheet(m.label, function (body) { renderModule(m, body, true); });
        else go("#m/" + encodeURIComponent(m.module_name));
      };
      grid.appendChild(t);
    });
    scr.appendChild(grid);
    main.appendChild(scr);
  }

  /* ── dispatch ──────────────────────────────────────────────────────────── */
  function renderModule(m, container, inSheet) {
    var t = m.module_type;
    if (t === "doctype" || t === "list_view" || t === "doc_list") return renderList(container, dtOf(m), m);
    if (t === "form_view") return renderIframe(container, m.target_url || ("/app/" + scrub(dtOf(m)) + "/new"), false);
    if (t === "report") return renderReport(container, m.report_name, m);
    if (t === "number_card") return renderCardBig(container, m.number_card_name);
    if (t === "dashboard") {
      if (m.dashboard_name) return renderIframe(container, "/app/dashboard-view/" + encodeURIComponent(m.dashboard_name), false);
      return renderDashboard(container, cardNames(m));
    }
    if (t === "webpage" || t === "iframe_url" || t === "frappe_page") return renderIframe(container, resolveUrl(m), false);
    if (t === "url") return renderIframe(container, m.external_url, true);
    if (t === "custom_html" || t === "custom_view") return renderHtml(container, m.custom_html_block || "<div class='empty'><div class='empty-ico'>🔧</div><h3>" + esc(m.label) + "</h3></div>");
    return renderIframe(container, m.target_url, false);
  }
  function resolveUrl(m) {
    if (m.target_url) return m.target_url;
    if (m.webpage_route) return m.webpage_route[0] === "/" ? m.webpage_route : "/" + m.webpage_route;
    return "/";
  }
  function cardNames(m) {
    var s = m.target_url || m.external_url || "";
    if (s.indexOf("/app") === 0) return [];
    return s.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  }

  /* ── list ──────────────────────────────────────────────────────────────── */
  function renderList(container, doctype, m) {
    container.innerHTML = "";
    var scr = el("div", "screen");
    container.appendChild(scr);
    if (!doctype) { scr.appendChild(emptyState("⚠", "No doctype", "This tile has no DocType set.", null, null)); return; }
    var listBox = el("div", "list");
    scr.appendChild(skeletonList(scr));
    var st = { start: 0, all: [], cols: [], canCreate: false, doctype: doctype };

    function load(reset) {
      return api("midhunatech.api.pwa_api.get_list_data", {
        doctype: doctype, fields: m.doctype_fields || null, filters: m.doctype_filters || null,
        limit: 20, start: st.start
      }, "GET").then(function (d) {
        st.cols = d.columns; st.canCreate = d.can_create;
        if (reset) st.all = [];
        st.all = st.all.concat(d.rows);
        st.hasMore = d.has_more; st.start += d.rows.length;
        paint();
      }).catch(function (e) {
        scr.innerHTML = ""; scr.appendChild(emptyState("⚠", "Couldn't load", e.message, "Retry", function () { st.start = 0; renderList(container, doctype, m); }));
      });
    }
    function paint() {
      scr.innerHTML = "";
      scr.appendChild(listBox);
      listBox.innerHTML = "";
      var rows = filterRows(st.all, state.search);
      if (!rows.length) { listBox.appendChild(emptyState("🗂️", "Nothing here", "No " + esc(doctype) + " records" + (state.search ? " match your search." : "."), null, null)); }
      rows.forEach(function (r) {
        var row = el("div", "row");
        var cells = "";
        (r.cells || []).forEach(function (v, i) {
          if (v) cells += '<span class="row-cell"><b>' + esc((st.cols[i] || {}).label || "") + ":</b> " + esc(v) + "</span>";
        });
        row.innerHTML =
          '<div class="row-top"><div class="row-title">' + esc(r.title) + "</div>" +
          (r.status ? '<span class="badge ' + badgeClass(r.status) + '">' + esc(r.status) + "</span>" : "") + "</div>" +
          (cells ? '<div class="row-cells">' + cells + "</div>" : "");
        row.onclick = function () { go("#doc/" + encodeURIComponent(doctype) + "/" + encodeURIComponent(r.name)); };
        listBox.appendChild(row);
      });
      if (st.hasMore && !state.search) {
        var lm = el("button", "load-more", "Load more");
        lm.onclick = function () { lm.textContent = "Loading…"; load(false); };
        listBox.appendChild(lm);
      }
      if (st.canCreate) showFab(function () {
        openSheet("New " + doctype, function (body) { renderIframe(body, "/app/" + scrub(doctype) + "/new", false); });
      });
    }
    enablePTR(container, function () { st.start = 0; return load(true); });
    load(true);
  }
  function filterRows(rows, q) {
    if (!q) return rows;
    q = q.toLowerCase();
    return rows.filter(function (r) {
      if ((r.title || "").toLowerCase().indexOf(q) > -1) return true;
      return (r.cells || []).some(function (c) { return (c || "").toLowerCase().indexOf(q) > -1; });
    });
  }

  /* ── detail ────────────────────────────────────────────────────────────── */
  function renderDetail(container, doctype, name) {
    container.innerHTML = "";
    var scr = el("div", "screen"); container.appendChild(scr);
    scr.appendChild(skeletonList(scr));
    api("midhunatech.api.pwa_api.get_doc_data", { doctype: doctype, name: name }, "GET").then(function (d) {
      setHeader(d.title || name);
      scr.innerHTML = "";
      var box = el("div", "detail");
      if (d.status) { var b = el("span", "badge " + badgeClass(d.status), esc(d.status)); b.style.marginBottom = "12px"; b.style.display = "inline-block"; box.appendChild(b); }
      (d.fields || []).forEach(function (f) {
        var fl = el("div", "field");
        fl.innerHTML = '<div class="field-lbl">' + esc(f.label) + '</div><div class="field-val">' + esc(f.value) + "</div>";
        box.appendChild(fl);
      });
      scr.appendChild(box);
    }).catch(function (e) { scr.innerHTML = ""; scr.appendChild(emptyState("⚠", "Couldn't open", e.message, null, null)); });
  }

  /* ── report ────────────────────────────────────────────────────────────── */
  function renderReport(container, reportName, m) {
    container.innerHTML = "";
    var scr = el("div", "screen"); container.appendChild(scr);
    scr.appendChild(skeletonList(scr));
    if (!reportName) { scr.innerHTML = ""; scr.appendChild(emptyState("⚠", "No report", "This tile has no Report set.", null, null)); return; }
    var filters = {};
    try { filters = m.report_filters ? JSON.parse(m.report_filters) : {}; } catch (e) {}
    api("frappe.desk.query_report.run", { report_name: reportName, filters: filters }, "POST").then(function (d) {
      scr.innerHTML = "";
      var cols = (d.columns || []).map(function (c) { return typeof c === "string" ? { label: c, fieldname: c } : c; });
      var rows = d.result || [];
      if (!rows.length) { scr.appendChild(emptyState("📑", "No data", "Report returned no rows.", null, null)); return; }
      var wrap = el("div", "list");
      rows.slice(0, 200).forEach(function (r) {
        if (Array.isArray(r) && !r.length) return;
        var row = el("div", "row"); var html = "";
        cols.slice(0, 6).forEach(function (c, i) {
          var v = Array.isArray(r) ? r[i] : r[c.fieldname];
          if (v != null && v !== "") html += '<span class="row-cell"><b>' + esc(c.label || c.fieldname) + ":</b> " + esc(v) + "</span>";
        });
        row.innerHTML = '<div class="row-cells" style="margin:0">' + html + "</div>";
        wrap.appendChild(row);
      });
      scr.appendChild(wrap);
    }).catch(function (e) { scr.innerHTML = ""; scr.appendChild(emptyState("⚠", "Couldn't run report", e.message, null, null)); });
  }

  /* ── number card (big) ─────────────────────────────────────────────────── */
  function renderCardBig(container, cardName) {
    container.innerHTML = "";
    var scr = el("div", "screen"); container.appendChild(scr);
    api("midhunatech.api.pwa_api.get_number_card_value", { number_card_name: cardName }, "GET").then(function (c) {
      var box = el("div", "kpi-grid");
      var k = el("div", "kpi kpi-big");
      k.innerHTML = '<div class="kpi-bar" style="background:' + (c.color || "#6366f1") + '"></div>' +
        '<div class="kpi-val" style="color:' + (c.color || "#6366f1") + '">' + esc(c.value) + "</div>" +
        '<div class="kpi-lbl">' + esc(c.label) + "</div>" +
        '<div class="kpi-meta">' + esc((c.function || "") + " · " + (c.doctype || "")) + "</div>";
      box.appendChild(k); scr.appendChild(box);
    }).catch(function (e) { scr.appendChild(emptyState("⚠", "Couldn't load card", e.message, null, null)); });
  }

  /* ── dashboard (KPI grid) ──────────────────────────────────────────────── */
  function renderDashboard(container, names) {
    container.innerHTML = "";
    var scr = el("div", "screen"); container.appendChild(scr);
    var grid = el("div", "kpi-grid"); scr.appendChild(grid);
    var p = names && names.length
      ? Promise.all(names.map(function (n) { return api("midhunatech.api.pwa_api.get_number_card_value", { number_card_name: n }, "GET").catch(function () { return null; }); })).then(function (a) { return { cards: a.filter(Boolean) }; })
      : api("midhunatech.api.data.get_dashboard", {}, "GET");
    p.then(function (d) {
      var cards = d.cards || [];
      if (!cards.length) { scr.innerHTML = ""; scr.appendChild(emptyState("📊", "No cards", "Create Number Cards in the desk.", null, null)); return; }
      cards.forEach(function (c) {
        var k = el("div", "kpi");
        k.innerHTML = '<div class="kpi-bar" style="background:' + (c.color || "#6366f1") + '"></div>' +
          '<div class="kpi-val">' + esc(c.value) + "</div>" +
          '<div class="kpi-lbl">' + esc(c.label) + "</div>" +
          '<div class="kpi-meta">' + esc((c.function || "") + " · " + (c.doctype || "")) + "</div>";
        grid.appendChild(k);
      });
    }).catch(function (e) { scr.appendChild(emptyState("⚠", "Couldn't load", e.message, null, null)); });
  }

  /* ── iframe ────────────────────────────────────────────────────────────── */
  function renderIframe(container, url, showExt) {
    container.innerHTML = "";
    if (!url) { container.appendChild(emptyState("⚠", "No URL", "This tile has no link set.", null, null)); return; }
    var wrap = el("div", "frame-wrap");
    var f = el("iframe", "frame");
    f.src = url; f.setAttribute("allow", "camera;microphone;geolocation;clipboard-read;clipboard-write");
    wrap.appendChild(f);
    if (showExt) {
      var b = el("button", "ext-btn", "Open in browser ↗");
      b.onclick = function () { window.open(url, "_blank", "noopener"); };
      wrap.appendChild(b);
    }
    container.appendChild(wrap);
  }

  /* ── custom html ───────────────────────────────────────────────────────── */
  function renderHtml(container, html) {
    container.innerHTML = "";
    var scr = el("div", "screen html-block");
    scr.innerHTML = html || "";
    container.appendChild(scr);
  }

  /* ── bottom nav ────────────────────────────────────────────────────────── */
  function buildBottomNav() {
    var nav = $("bottomNav");
    if (!state.config.bottom_nav_enabled) { nav.style.display = "none"; return; }
    var items = state.modules.filter(function (m) { return m.show_in_bottom_nav; })
      .sort(function (a, b) { return (a.bottom_nav_order || 0) - (b.bottom_nav_order || 0); }).slice(0, 5);
    nav.innerHTML = "";
    var home = el("button"); home.innerHTML = '<span class="nav-ico">🏠</span><span>Home</span>';
    home.onclick = function () { go("#home"); }; nav.appendChild(home);
    items.forEach(function (m) {
      var b = el("button");
      b.innerHTML = '<span class="nav-ico">' + esc(m.bottom_nav_icon || iconOf(m)) + "</span><span>" + esc(m.bottom_nav_label || m.label) + "</span>";
      b.onclick = function () {
        if (m.open_in_modal) openSheet(m.label, function (body) { renderModule(m, body, true); });
        else go("#m/" + encodeURIComponent(m.module_name));
      };
      nav.appendChild(b);
    });
    nav.style.display = items.length ? "flex" : "none";
    if (!items.length) nav.style.display = "none";
  }

  /* ── sheet / fab / toast / states ──────────────────────────────────────── */
  function openSheet(title, builder) {
    $("sheetTitle").textContent = title;
    var body = $("sheetBody"); body.innerHTML = ""; body.style.minHeight = "40vh";
    builder(body);
    $("sheetBg").classList.add("show"); $("sheet").classList.add("show");
  }
  function closeSheet() { $("sheetBg").classList.remove("show"); $("sheet").classList.remove("show"); }
  function showFab(onClick) { var f = $("fab"); f.style.display = "block"; f.onclick = onClick; }
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.classList.add("show"); setTimeout(function () { t.classList.remove("show"); }, 2200); }

  function emptyState(ico, title, sub, btn, onBtn) {
    var e = el("div", "empty");
    e.innerHTML = '<div class="empty-ico">' + ico + '</div><h3>' + esc(title) + "</h3><p>" + esc(sub) + "</p>";
    if (btn) { var b = el("button", "load-more", esc(btn)); b.style.margin = "14px auto 0"; b.onclick = onBtn; e.appendChild(b); }
    return e;
  }
  function skeletonList(scr) {
    var w = el("div"); w.style.paddingTop = "8px";
    for (var i = 0; i < 5; i++) w.appendChild(el("div", "sk sk-row"));
    return w;
  }

  /* ── pull to refresh ───────────────────────────────────────────────────── */
  function enablePTR(container, onRefresh) {
    var startY = 0, pulling = false;
    container.ontouchstart = function (e) { if (container.scrollTop <= 0) { startY = e.touches[0].clientY; pulling = true; } };
    container.ontouchmove = function (e) {
      if (!pulling) return;
      var dy = e.touches[0].clientY - startY;
      if (dy > 70) { pulling = false; toast("Refreshing…"); onRefresh(); }
    };
    container.ontouchend = function () { pulling = false; };
  }

  /* ── search ────────────────────────────────────────────────────────────── */
  function setSearch(show) {
    $("searchBar").style.display = show ? "block" : "none";
    if (!show) { state.search = ""; $("searchInput").value = ""; }
  }

  /* ── service worker ────────────────────────────────────────────────────── */
  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/pwa/sw.js", { scope: "/pwa/" }).catch(function () {});
  }

  /* ── events ────────────────────────────────────────────────────────────── */
  window.addEventListener("hashchange", route);
  document.addEventListener("DOMContentLoaded", function () {
    $("backBtn").onclick = function () { if (state.current || location.hash.indexOf("doc") > -1) history.back(); else go("#home"); };
    $("themeBtn").onclick = toggleTheme;
    $("sheetClose").onclick = closeSheet;
    $("sheetBg").onclick = closeSheet;
    $("searchBtn").onclick = function () {
      var showing = $("searchBar").style.display !== "none";
      setSearch(!showing);
      if (!showing) $("searchInput").focus();
    };
    $("searchInput").oninput = function () { state.search = this.value; if (state.current) renderModule(state.current, $("main"), false); };
    boot();
  });
})();
