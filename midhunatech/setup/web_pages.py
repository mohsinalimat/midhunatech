# Copyright (c) 2024, Midhunatech and Contributors
# License: GPL-3.0
"""
Git-tracked setup for the PWA's native-looking portal Web Pages.

Run with:
    bench --site <site> execute midhunatech.setup.web_pages.create_pages

Each page is content_type=HTML, full_width, title hidden, and injects CSS that
hides the Frappe website navbar/footer so the page feels native when opened
inside the Midhunatech PWA (it is rendered in a full-screen iframe by
ModuleView.vue). The same pages are also reachable directly in the browser at
kali.local:8000/<route>.
"""

import frappe

# ── Shared chrome: hides website navbar/footer + sets the app's base look ──────
_BASE_CSS = """
<style>
  :root { --mt-primary:#6366f1; --mt-ink:#1e293b; --mt-sub:#64748b; --mt-bg:#f8fafc; }
  /* Strip the Frappe website chrome so the page looks native in the PWA */
  .navbar, .web-footer, footer, .footer, #navbar-collapse,
  .page-head, .breadcrumb-container, .navbar-fixed-top { display:none !important; }
  body, html { margin:0 !important; padding:0 !important; background:var(--mt-bg) !important; }
  .main-section, .page_content, .container, #page-san, [id^='page-'] {
    padding:0 !important; margin:0 !important; max-width:100% !important;
  }
  * { box-sizing:border-box; }
  .mt-page {
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif;
    color:var(--mt-ink); -webkit-font-smoothing:antialiased;
  }
</style>
"""


def _about_html() -> str:
    return _BASE_CSS + """
<div class="mt-page">
  <style>
    .mt-hero {
      background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 60%,#a855f7 100%);
      color:#fff; padding:46px 22px 40px; text-align:center; position:relative; overflow:hidden;
    }
    .mt-hero::after{content:"";position:absolute;inset:0;
      background:radial-gradient(circle at 20% 0%,rgba(255,255,255,.18),transparent 45%);}
    .mt-wordmark{font-size:30px;font-weight:900;letter-spacing:-.5px;position:relative;}
    .mt-wordmark .a{opacity:.85;}
    .mt-tag{margin-top:8px;font-size:14px;opacity:.92;font-weight:500;position:relative;}
    .mt-stats{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;
      margin:-26px 16px 0;position:relative;z-index:2;}
    .mt-stat{background:#fff;border:1px solid #eef2f7;border-radius:18px;
      padding:16px 20px;min-width:96px;text-align:center;box-shadow:0 6px 20px rgba(15,23,42,.06);}
    .mt-stat b{display:block;font-size:24px;font-weight:900;color:var(--mt-primary);letter-spacing:-1px;}
    .mt-stat span{font-size:11.5px;color:var(--mt-sub);font-weight:600;text-transform:uppercase;letter-spacing:.4px;}
    .mt-sec{padding:28px 18px 4px;}
    .mt-sec-title{font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:.6px;
      color:#94a3b8;margin-bottom:14px;}
    .mt-cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
    .mt-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;
      box-shadow:0 1px 10px rgba(15,23,42,.03);}
    .mt-ico{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;
      justify-content:center;font-size:21px;margin-bottom:10px;}
    .mt-card h3{margin:0 0 4px;font-size:14.5px;font-weight:800;}
    .mt-card p{margin:0;font-size:12.5px;color:var(--mt-sub);line-height:1.5;}
    .mt-body{padding:8px 20px 40px;font-size:14px;line-height:1.7;color:#475569;}
  </style>

  <div class="mt-hero">
    <div class="mt-wordmark">Midhuna<span class="a">tech</span></div>
    <div class="mt-tag">Building modern, native-feeling business apps</div>
  </div>

  <div class="mt-stats">
    <div class="mt-stat"><b>120+</b><span>Team</span></div>
    <div class="mt-stat"><b>15</b><span>Years</span></div>
    <div class="mt-stat"><b>40+</b><span>Clients</span></div>
  </div>

  <div class="mt-sec">
    <div class="mt-sec-title">What we do</div>
    <div class="mt-cards">
      <div class="mt-card">
        <div class="mt-ico" style="background:#eef2ff;color:#6366f1;">⚙️</div>
        <h3>ERP &amp; Automation</h3>
        <p>End-to-end Frappe/ERPNext solutions tailored to your operations.</p>
      </div>
      <div class="mt-card">
        <div class="mt-ico" style="background:#ecfdf5;color:#10b981;">📱</div>
        <h3>PWA &amp; Mobile</h3>
        <p>Installable, app-like experiences that work offline and on any device.</p>
      </div>
      <div class="mt-card">
        <div class="mt-ico" style="background:#fff7ed;color:#f59e0b;">📊</div>
        <h3>Live Dashboards</h3>
        <p>Real-time SCADA &amp; plant monitoring with rich, animated visuals.</p>
      </div>
      <div class="mt-card">
        <div class="mt-ico" style="background:#fdf2f8;color:#ec4899;">🤝</div>
        <h3>Support</h3>
        <p>Dedicated onboarding, training and ongoing maintenance.</p>
      </div>
    </div>
  </div>

  <div class="mt-body">
    Midhunatech crafts software that feels native and looks beautiful — from
    employee self-service portals to factory-floor monitoring. This page lives
    inside your PWA and is fully editable from the desk under
    <b>Web Page → About Midhunatech</b>.
  </div>
</div>
"""


def _notices_html() -> str:
    return _BASE_CSS + """
<div class="mt-page">
  <style>
    .nt-head{padding:26px 18px 6px;}
    .nt-head h1{margin:0;font-size:24px;font-weight:900;letter-spacing:-.5px;color:#0f172a;}
    .nt-head p{margin:4px 0 0;font-size:13px;color:var(--mt-sub);}
    .nt-list{padding:14px 16px 40px;display:flex;flex-direction:column;gap:12px;}
    .nt-item{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;
      box-shadow:0 1px 10px rgba(15,23,42,.03);position:relative;}
    .nt-item.pin{border-color:rgba(99,102,241,.4);}
    .nt-top{display:flex;align-items:center;gap:8px;margin-bottom:8px;}
    .nt-badge{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;
      padding:3px 9px;border-radius:999px;}
    .b-hr{background:#eef2ff;color:#6366f1;} .b-it{background:#ecfeff;color:#0891b2;}
    .b-event{background:#fef3c7;color:#b45309;} .b-policy{background:#fee2e2;color:#dc2626;}
    .nt-date{margin-left:auto;font-size:11.5px;color:#94a3b8;font-weight:600;}
    .nt-pinflag{font-size:11px;font-weight:800;color:#6366f1;}
    .nt-item h3{margin:0 0 4px;font-size:15px;font-weight:800;color:#1e293b;}
    .nt-item p{margin:0;font-size:13px;color:#475569;line-height:1.55;}
  </style>

  <div class="nt-head">
    <h1>📣 Company Notices</h1>
    <p>Latest announcements for the whole team</p>
  </div>

  <div class="nt-list">
    <div class="nt-item pin">
      <div class="nt-top">
        <span class="nt-pinflag">📌 Pinned</span>
        <span class="nt-badge b-policy">Policy</span>
        <span class="nt-date">Jun 02</span>
      </div>
      <h3>Updated attendance policy</h3>
      <p>Please use the in-app Check&nbsp;in / Check&nbsp;out from the Home screen.
         Daily worked hours are now tracked automatically.</p>
    </div>

    <div class="nt-item">
      <div class="nt-top">
        <span class="nt-badge b-event">Event</span>
        <span class="nt-date">Jun 14</span>
      </div>
      <h3>Quarterly town hall — Friday 4 PM</h3>
      <p>Join us in the main hall for the Q2 review and a team celebration afterwards.</p>
    </div>

    <div class="nt-item">
      <div class="nt-top">
        <span class="nt-badge b-it">IT</span>
        <span class="nt-date">Jun 10</span>
      </div>
      <h3>Scheduled maintenance window</h3>
      <p>Systems will be briefly unavailable Saturday 1–2 AM for upgrades. Plan accordingly.</p>
    </div>

    <div class="nt-item">
      <div class="nt-top">
        <span class="nt-badge b-hr">HR</span>
        <span class="nt-date">Jun 06</span>
      </div>
      <h3>Welcome to our new joiners</h3>
      <p>A warm welcome to everyone who joined this month. Say hello on the Team directory!</p>
    </div>
  </div>
</div>
"""


# ── Page definitions ───────────────────────────────────────────────────────────
PAGES = [
    {
        "route": "mt-about",
        "title": "About Midhunatech",
        "html": _about_html,
        "module": {"label": "About Us", "icon": "shield", "color": "#6366f1", "order": 20},
    },
    {
        "route": "mt-notices",
        "title": "Company Notices",
        "html": _notices_html,
        "module": {"label": "Notices", "icon": "bell", "color": "#ec4899", "order": 21},
    },
]


def create_pages():
    """Create/update the Web Pages and link them into the PWA config as iframe modules."""
    for p in PAGES:
        name = frappe.db.get_value("Web Page", {"route": p["route"]}, "name")
        doc = frappe.get_doc("Web Page", name) if name else frappe.new_doc("Web Page")
        doc.update({
            "title": p["title"],
            "route": p["route"],
            "published": 1,
            "content_type": "HTML",
            "full_width": 1,
            "show_title": 0,
            "show_sidebar": 0,
            "main_section_html": p["html"](),
        })
        doc.save(ignore_permissions=True)
        print(f"  ✔ Web Page  /{p['route']}  ->  {doc.name}")

    _link_modules()
    frappe.db.commit()
    print("Done. Visit /mt-about and /mt-notices, or open the PWA home grid.")


def _link_modules():
    """Add the pages as iframe_url modules in Midhunatech PWA Config (idempotent)."""
    cfg = frappe.get_doc("Midhunatech PWA Config")
    existing = {row.module_name for row in cfg.get("modules", [])}
    for p in PAGES:
        key = p["route"].replace("-", "_")
        if key in existing:
            continue
        m = p["module"]
        cfg.append("modules", {
            "module_name": key,
            "label": m["label"],
            "icon": m["icon"],
            "color": m["color"],
            "route_path": f"/{p['route']}",
            "module_type": "iframe_url",
            "target_url": f"/{p['route']}",
            "display_order": m["order"],
            "is_enabled": 1,
        })
        print(f"  ✔ Module    {m['label']}  ->  iframe /{p['route']}")
    cfg.save(ignore_permissions=True)
