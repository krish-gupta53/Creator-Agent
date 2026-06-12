export const APP_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Creator Agent</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap" rel="stylesheet">
<style>
:root{
  --bg:#0c0d10;
  --surface:#131519;
  --surface2:#1a1d23;
  --surface3:#21252d;
  --panel:#161a20;
  --ink:#edeef2;
  --ink2:#b0b5c0;
  --muted:#6b7280;
  --line:#252932;
  --line2:#2e333d;
  --accent:#c8f135;
  --accent-dim:#9eb828;
  --accent-bg:rgba(200,241,53,.07);
  --accent-bg2:rgba(200,241,53,.12);
  --blue:#4f8ef7;
  --blue-bg:rgba(79,142,247,.08);
  --red:#f75f5f;
  --red-bg:rgba(247,95,95,.09);
  --good:#4ade80;
  --good-bg:rgba(74,222,128,.08);
  --warn:#fbbf24;
  --warn-bg:rgba(251,191,36,.08);
  --shadow:0 24px 60px rgba(0,0,0,.55);
  --shadow-sm:0 4px 20px rgba(0,0,0,.3);
  --radius:16px;
  --radius-sm:10px;
  --radius-xs:7px;
  --font-display:'Syne', sans-serif;
  --font-body:'DM Sans', sans-serif;
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
body{font:15px/1.6 var(--font-body);color:var(--ink);background:var(--bg);min-height:100vh}
button,input,textarea,select{font:inherit;color:inherit}
button{cursor:pointer}
a{color:inherit;text-decoration:none}
.hidden{display:none!important}
.muted{color:var(--muted)}
.tiny{font-size:12px;line-height:1.5}
.good{color:var(--good)}
.warn{color:var(--warn)}
.bad{color:var(--red)}
h1,h2,h3{font-family:var(--font-display);letter-spacing:-.02em;line-height:1.2}
h2{font-size:20px;font-weight:700}
h3{font-size:15px;font-weight:600}

/* ── LOGIN ──────────────────────────────── */
.login{
  min-height:100vh;display:grid;place-items:center;padding:24px;
  background:var(--bg);
  background-image:
    radial-gradient(ellipse 700px 500px at 60% 20%, rgba(200,241,53,.04) 0%, transparent 70%),
    radial-gradient(ellipse 500px 400px at 10% 80%, rgba(79,142,247,.04) 0%, transparent 70%);
}
.login-card{
  width:min(420px,100%);
  background:var(--surface);
  border:1px solid var(--line2);
  box-shadow:var(--shadow);
  padding:44px 40px;
  border-radius:24px;
  position:relative;
  overflow:hidden;
}
.login-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(200,241,53,.4),transparent);
}
.brand-mark{
  width:52px;height:52px;border-radius:14px;
  background:var(--accent);
  display:grid;place-items:center;
  font-family:var(--font-display);
  font-weight:800;font-size:18px;
  color:#0c0d10;
  box-shadow:0 8px 32px rgba(200,241,53,.25);
  letter-spacing:-.03em;
}
.login h1{
  margin:20px 0 6px;
  font-family:var(--font-display);
  font-size:28px;font-weight:800;
  color:var(--ink);
}
.login p.muted{font-size:14px;color:var(--muted);margin-bottom:8px}
.field{display:grid;gap:8px;margin:18px 0}
.field label{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.input,.textarea,.select{
  width:100%;
  border:1px solid var(--line2);
  background:var(--surface2);
  border-radius:var(--radius-sm);
  padding:12px 14px;
  outline:none;
  color:var(--ink);
  transition:border-color .18s,box-shadow .18s;
  font-size:14px;
}
.textarea{min-height:100px;resize:vertical}
.input::placeholder,.textarea::placeholder{color:var(--muted)}
.input:focus,.textarea:focus,.select:focus{
  border-color:rgba(200,241,53,.45);
  box-shadow:0 0 0 3px rgba(200,241,53,.08);
}
.select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px;cursor:pointer}

/* ── BUTTONS ─────────────────────────────── */
.btn{
  border:0;border-radius:var(--radius-sm);
  padding:10px 18px;
  background:var(--accent);
  color:#0c0d10;
  font-family:var(--font-body);
  font-weight:600;font-size:14px;
  transition:filter .15s,transform .12s,box-shadow .15s;
  white-space:nowrap;
  box-shadow:0 4px 16px rgba(200,241,53,.2);
}
.btn:hover{filter:brightness(1.06);transform:translateY(-1px);box-shadow:0 6px 20px rgba(200,241,53,.28)}
.btn:active{transform:translateY(0);filter:brightness(.96)}
.btn.secondary{
  background:var(--surface3);
  color:var(--ink2);
  border:1px solid var(--line2);
  box-shadow:none;
}
.btn.secondary:hover{background:var(--surface2);color:var(--ink);border-color:var(--line2);filter:none;box-shadow:none}
.btn.ghost{background:transparent;color:var(--muted);box-shadow:none;border:1px solid transparent}
.btn.ghost:hover{color:var(--ink2);background:var(--surface2);filter:none;transform:none}
.btn.danger{background:var(--red-bg);color:var(--red);border:1px solid rgba(247,95,95,.2);box-shadow:none}
.btn.danger:hover{background:rgba(247,95,95,.15);filter:none}
.btn.small{font-size:12px;padding:6px 11px;border-radius:var(--radius-xs)}
.btn:disabled{opacity:.35;cursor:not-allowed;transform:none!important;filter:none!important}

/* ── LAYOUT ──────────────────────────────── */
.row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.spread{justify-content:space-between}
.stack{display:grid;gap:12px}
.app{display:grid;grid-template-columns:220px 1fr;min-height:100vh}

/* ── SIDEBAR ─────────────────────────────── */
.rail{
  padding:20px 12px;
  border-right:1px solid var(--line);
  background:var(--surface);
  position:sticky;top:0;height:100vh;
  display:flex;flex-direction:column;
  gap:0;
}
.rail-brand{
  display:flex;align-items:center;gap:12px;
  padding:6px 8px 28px;
}
.rail-brand .brand-mark{width:36px;height:36px;border-radius:10px;font-size:13px}
.rail-brand-text strong{
  display:block;
  font-family:var(--font-display);
  font-size:15px;font-weight:700;
  color:var(--ink);
}
.rail-brand-text .tiny{color:var(--muted);font-size:11px}
.nav{display:grid;gap:2px;flex:1}
.nav button{
  border:0;background:transparent;
  text-align:left;padding:10px 12px;
  border-radius:var(--radius-xs);
  color:var(--muted);
  font-size:13px;font-weight:500;
  display:flex;align-items:center;gap:9px;
  transition:background .12s,color .12s;
}
.nav button .nav-icon{
  width:18px;height:18px;opacity:.6;
  display:grid;place-items:center;
  font-size:14px;
  transition:opacity .12s;
}
.nav button:hover{background:var(--surface2);color:var(--ink2)}
.nav button:hover .nav-icon{opacity:.8}
.nav button.active{background:var(--accent-bg2);color:var(--accent)}
.nav button.active .nav-icon{opacity:1}
.rail-bottom{margin-top:auto;padding-top:16px;border-top:1px solid var(--line)}

/* ── MAIN CONTENT ──────────────────────────── */
.main{padding:28px 32px 60px;min-width:0;background:var(--bg)}
.topbar{
  max-width:1600px;margin:0 auto 24px;
  display:flex;justify-content:space-between;align-items:flex-start;
}
.eyebrow{
  text-transform:uppercase;letter-spacing:.1em;
  color:var(--accent);font-size:10px;font-weight:700;
  margin-bottom:4px;
}
.page-title{
  font-family:var(--font-display);
  font-size:26px;font-weight:800;
  color:var(--ink);
}
.view{max-width:1600px;margin:auto}

/* ── CARDS ───────────────────────────────── */
.card{
  background:var(--surface);
  border:1px solid var(--line);
  border-radius:var(--radius);
  padding:20px;
}
.card h2{margin-bottom:4px}
.card>p.muted{font-size:13px;margin-bottom:16px}
.subtle{background:var(--surface2)}

/* ── BADGES ──────────────────────────────── */
.badge{
  display:inline-flex;align-items:center;gap:5px;
  border:1px solid var(--line2);border-radius:999px;
  padding:4px 10px;font-size:11px;font-weight:600;
  color:var(--muted);background:var(--surface2);
  font-family:var(--font-body);
  letter-spacing:.02em;
}
.badge.good{background:var(--good-bg);border-color:rgba(74,222,128,.2);color:var(--good)}
.badge.warn{background:var(--warn-bg);border-color:rgba(251,191,36,.2);color:var(--warn)}
.badge.accent{background:var(--accent-bg2);border-color:rgba(200,241,53,.25);color:var(--accent)}

/* ── CREATE VIEW ─────────────────────────── */
.create-grid{display:grid;grid-template-columns:260px minmax(0,1fr) 300px;gap:16px;min-height:calc(100vh - 120px)}
.conversation-list{height:calc(100vh - 180px);overflow:auto;display:grid;gap:4px;align-content:start;padding-right:4px;margin-top:12px}
.conversation-list::-webkit-scrollbar{width:4px}
.conversation-list::-webkit-scrollbar-track{background:transparent}
.conversation-list::-webkit-scrollbar-thumb{background:var(--line2);border-radius:4px}
.conversation-item{
  padding:11px 13px;border-radius:var(--radius-xs);
  border:1px solid transparent;cursor:pointer;
  transition:background .12s,border-color .12s;
}
.conversation-item:hover{background:var(--surface2)}
.conversation-item.active{background:var(--accent-bg);border-color:rgba(200,241,53,.2)}
.conversation-item strong{
  display:block;white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;font-size:13px;font-weight:500;
  color:var(--ink);
}
.conversation-item .tiny.muted{margin-top:2px}

/* ── CHAT ────────────────────────────────── */
.chat-card{
  display:grid;grid-template-rows:auto 1fr auto;
  min-height:650px;height:calc(100vh - 120px);
  padding:0;overflow:hidden;
  background:var(--surface);
}
.chat-head{
  padding:16px 20px;
  border-bottom:1px solid var(--line);
  background:var(--surface);
}
.chat-head strong{font-size:14px;font-weight:600;color:var(--ink)}
.messages{
  overflow:auto;padding:24px 22px;
  display:grid;gap:14px;align-content:start;
  background:var(--bg);
}
.messages::-webkit-scrollbar{width:4px}
.messages::-webkit-scrollbar-thumb{background:var(--line2);border-radius:4px}
.message{
  max-width:82%;border-radius:16px;
  padding:12px 16px;white-space:pre-wrap;
  font-size:14px;line-height:1.65;
  animation:msgIn .2s ease;
}
@keyframes msgIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
.message.user{
  justify-self:end;
  background:var(--accent);
  color:#0c0d10;
  border-bottom-right-radius:4px;
  font-weight:500;
}
.message.assistant{
  justify-self:start;
  background:var(--surface2);
  color:var(--ink);
  border:1px solid var(--line);
  border-bottom-left-radius:4px;
}
.message .meta{font-size:11px;opacity:.5;margin-top:8px}
.options{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
.option{
  border:1px solid rgba(200,241,53,.25);
  background:rgba(200,241,53,.06);
  color:var(--accent);
  border-radius:999px;padding:6px 12px;
  font-size:12px;font-weight:500;
  transition:background .12s,border-color .12s;
  cursor:pointer;
}
.option:hover{background:rgba(200,241,53,.12);border-color:rgba(200,241,53,.4)}
.attachment-chip{
  display:inline-flex;gap:5px;align-items:center;
  border-radius:6px;padding:3px 8px;
  font-size:11px;margin-top:5px;
  background:rgba(255,255,255,.1);
  color:rgba(255,255,255,.7);
}
.assistant .attachment-chip{background:var(--surface3);color:var(--muted)}
.composer{
  border-top:1px solid var(--line);
  padding:14px 16px;
  background:var(--surface);
}
.composer-box{
  border:1px solid var(--line2);
  border-radius:14px;padding:12px;
  background:var(--surface2);
  transition:border-color .18s;
}
.composer-box:focus-within{border-color:rgba(200,241,53,.3)}
.composer textarea{
  border:0;width:100%;
  min-height:68px;resize:none;outline:none;
  background:transparent;
  color:var(--ink);font-size:14px;
  line-height:1.6;
}
.composer textarea::placeholder{color:var(--muted)}

/* ── DECISION PANEL ───────────────────────── */
.decision-panel{height:calc(100vh - 120px);overflow:auto}
.decision-panel::-webkit-scrollbar{width:4px}
.decision-panel::-webkit-scrollbar-thumb{background:var(--line2);border-radius:4px}
.decision-grid{display:grid;gap:0}
.decision-row{
  border-bottom:1px solid var(--line);
  padding:9px 0;
}
.decision-row:last-child{border-bottom:0}
.decision-row span{
  display:block;font-size:10px;font-weight:700;
  text-transform:uppercase;letter-spacing:.07em;
  color:var(--muted);margin-bottom:2px;
}
.decision-row strong{font-size:13px;color:var(--ink)}

/* ── GRIDS AND LISTS ──────────────────────── */
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.list{display:grid;gap:8px}
.list-item{
  border:1px solid var(--line);border-radius:var(--radius-xs);
  padding:14px;background:var(--surface2);
  font-size:14px;
}
.list-item strong{font-size:13px;font-weight:600;color:var(--ink)}
.source-row{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:start}

/* ── PACKAGES ─────────────────────────────── */
.package-layout{display:grid;grid-template-columns:250px minmax(0,1fr);gap:16px}
.package-version{
  padding:12px;border-radius:var(--radius-xs);cursor:pointer;
  border:1px solid transparent;
  transition:background .12s,border-color .12s;
}
.package-version:hover{background:var(--surface2)}
.package-version.active{background:var(--accent-bg);border-color:rgba(200,241,53,.2)}
.package-version strong{font-size:13px;font-weight:600;color:var(--ink)}

/* ── SCRIPT / SHOT / TABS ─────────────────── */
.script{
  white-space:pre-wrap;font-size:15px;line-height:1.8;
  background:var(--surface2);
  border:1px solid var(--line);
  border-radius:var(--radius-sm);padding:18px;
  color:var(--ink2);
}
.shot{
  display:grid;grid-template-columns:72px 1fr;gap:12px;
  border-top:1px solid var(--line);padding:14px 0;
}
.shot strong{font-size:13px;font-weight:700;color:var(--accent);font-family:var(--font-display)}
.metric{
  padding:18px;border-radius:var(--radius-sm);
  background:var(--surface2);
  border:1px solid var(--line);
}
.metric span.muted{font-size:12px;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
.metric strong{display:block;font-size:28px;font-family:var(--font-display);font-weight:800;color:var(--ink)}
.tabs{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:18px;padding:4px;background:var(--surface2);border-radius:10px;border:1px solid var(--line)}
.tabs button{
  border:0;background:transparent;
  border-radius:7px;padding:7px 14px;
  font-size:13px;font-weight:500;
  color:var(--muted);
  transition:background .12s,color .12s;
}
.tabs button.active{background:var(--surface);color:var(--ink);box-shadow:0 2px 8px rgba(0,0,0,.2)}
.notice{
  padding:12px 16px;border-radius:var(--radius-xs);
  background:rgba(251,191,36,.06);
  color:var(--warn);
  border:1px solid rgba(251,191,36,.2);
  font-size:13px;
}

/* ── TOAST ───────────────────────────────── */
.toast{
  position:fixed;right:20px;bottom:20px;z-index:30;
  background:var(--surface2);
  color:var(--ink);
  border:1px solid var(--line2);
  border-radius:var(--radius-sm);
  padding:12px 18px;
  box-shadow:var(--shadow);
  max-width:360px;font-size:14px;
  animation:toastIn .22s ease;
}
@keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

/* ── MODAL ───────────────────────────────── */
.modal-backdrop{
  position:fixed;inset:0;
  background:rgba(0,0,0,.65);
  backdrop-filter:blur(4px);
  z-index:20;display:grid;
  place-items:center;padding:20px;
}
.modal{
  width:min(650px,100%);max-height:90vh;overflow:auto;
  background:var(--surface);
  border:1px solid var(--line2);
  border-radius:20px;padding:28px;
  box-shadow:var(--shadow);
}
.modal::-webkit-scrollbar{width:4px}
.modal::-webkit-scrollbar-thumb{background:var(--line2);border-radius:4px}

/* ── MISC ────────────────────────────────── */
.code{
  font-family:ui-monospace,SFMono-Regular,Consolas,monospace;
  font-size:12px;background:var(--surface2);
  border:1px solid var(--line);
  border-radius:var(--radius-xs);padding:12px;overflow:auto;
  color:var(--ink2);
}
.divider{height:1px;background:var(--line);margin:18px 0}
.empty{padding:48px 20px;text-align:center;color:var(--muted);font-size:14px}
p{margin-top:0}
p.muted{font-size:13px;color:var(--muted)}

/* ── STATUS DOT ──────────────────────────── */
#statusDot{position:relative;padding-left:20px}
#statusDot::before{
  content:'';position:absolute;left:8px;top:50%;
  transform:translateY(-50%);
  width:6px;height:6px;border-radius:50%;
  background:var(--good);
  box-shadow:0 0 6px var(--good);
  animation:pulse 2.5s ease infinite;
}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}


/* ── INTERACTION ENHANCEMENTS ─────────────── */
.stage-badge{display:inline-flex;align-items:center;border-radius:999px;padding:2px 7px;font-size:10px;font-weight:700;text-transform:capitalize;border:1px solid var(--line2);color:var(--muted);background:var(--surface3)}
.stage-badge.planning{color:var(--blue);background:var(--blue-bg);border-color:rgba(79,142,247,.25)}
.stage-badge.awaiting_approval{color:var(--warn);background:var(--warn-bg);border-color:rgba(251,191,36,.25)}
.stage-badge.approved{color:var(--good);background:var(--good-bg);border-color:rgba(74,222,128,.25)}
.conversation-meta{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-top:4px}
.package-jump{border:0;background:transparent;color:var(--accent);font-size:13px;padding:0;box-shadow:none}
.decision-chips{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.decision-chip{border:1px solid rgba(79,142,247,.28);background:var(--blue-bg);color:var(--blue);border-radius:999px;padding:6px 10px;font-size:11px;font-weight:600}
.decision-chip:hover{background:rgba(79,142,247,.14)}
.plan-progress{margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}
.progress-shell{height:7px;border-radius:999px;background:var(--surface3);overflow:hidden;margin-top:6px}
.progress-bar{height:100%;background:var(--accent);border-radius:999px;transition:width .25s ease}
.job-inline{margin-top:10px;padding:10px 12px;border:1px solid var(--line);border-radius:var(--radius-xs);background:var(--surface2)}
.job-inline .progress-shell{height:5px}
.spinner{display:inline-block;width:12px;height:12px;border:2px solid rgba(12,13,16,.35);border-top-color:#0c0d10;border-radius:50%;animation:spin .7s linear infinite;vertical-align:-2px;margin-right:6px}
.btn.secondary .spinner{border-color:rgba(237,238,242,.25);border-top-color:var(--ink)}
@keyframes spin{to{transform:rotate(360deg)}}
.section-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.copy-btn{font-size:11px;padding:4px 8px}
.script-stats{display:flex;gap:7px;flex-wrap:wrap}
.beat-timeline{display:flex;min-height:52px;border:1px solid var(--line);border-radius:var(--radius-xs);overflow:hidden;margin-top:16px;background:var(--surface2)}
.beat-segment{min-width:28px;padding:7px 5px;font-size:10px;line-height:1.25;border-right:1px solid rgba(255,255,255,.08);overflow:hidden;cursor:help}
.beat-segment.hook{background:var(--accent-bg2);color:var(--accent)}
.beat-segment.cta{background:var(--warn-bg);color:var(--warn)}
.beat-segment.main{background:var(--blue-bg);color:var(--blue)}
.beat-segment.other{background:var(--surface3);color:var(--ink2)}
.toast{border-left:4px solid var(--line2)}
.toast.success{border-left-color:var(--good)}
.toast.warning{border-left-color:var(--warn);color:var(--warn)}
.toast.error{border-left-color:var(--red);color:var(--red);background:rgba(247,95,95,.12)}
.toast-close{border:0;background:transparent;color:inherit;font-size:18px;line-height:1;padding:0 0 0 12px}
.integration-row{display:flex;gap:10px;align-items:flex-start}
.integration-dot{width:9px;height:9px;border-radius:50%;margin-top:6px;background:var(--muted);box-shadow:0 0 0 3px rgba(107,114,128,.08)}
.integration-dot.on{background:var(--good);box-shadow:0 0 0 3px var(--good-bg)}
.integration-dot.off{background:var(--warn);box-shadow:0 0 0 3px var(--warn-bg)}
.toggle-row{display:flex;align-items:center;gap:10px;margin-top:14px;cursor:pointer}
.toggle-row input{width:18px;height:18px;accent-color:var(--accent)}
.compare-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.compare-section{border:1px solid var(--line);border-radius:var(--radius-xs);padding:12px;background:var(--surface2)}
.audio-preview{width:100%;margin-top:10px}

/* ── RESPONSIVE ──────────────────────────── */
@media(max-width:1180px){
  .create-grid{grid-template-columns:230px minmax(0,1fr)}
  .decision-panel{grid-column:1/-1;height:auto}
  .decision-panel .decision-grid{grid-template-columns:repeat(3,1fr)}
  .chat-card{height:720px}
  .conversation-list{height:720px}
}
@media(max-width:780px){
  .app{display:block}
  .rail{height:auto;position:static;border-right:0;border-bottom:1px solid var(--line);padding:12px;flex-direction:row;align-items:center;flex-wrap:wrap}
  .rail-brand{padding:2px 5px 0;flex:1}
  .nav{display:flex;overflow:auto;gap:2px;flex:none;max-width:100%}
  .nav button{white-space:nowrap;padding:8px 10px}
  .rail-bottom{margin-top:0;padding-top:0;border-top:0}
  .main{padding:16px}
  .create-grid,.package-layout,.grid2,.grid3{grid-template-columns:1fr}
  .conversation-list{height:auto;max-height:240px}
  .chat-card{height:680px;min-height:0}
  .decision-panel{height:auto}
  .decision-panel .decision-grid{grid-template-columns:1fr}
  .message{max-width:95%}
}

@media(max-width:640px){
  .grid2,.grid3,.compare-grid{grid-template-columns:1fr}
  .package-layout{grid-template-columns:1fr}
  .topbar{gap:12px;flex-wrap:wrap}
  .chat-head .row.spread{align-items:flex-start}
  .beat-timeline{overflow-x:auto}
  .beat-segment{flex-basis:90px!important;flex-shrink:0}
}

</style>
</head>
<body>
<section id="loginView" class="login">
  <form id="loginForm" class="login-card">
    <div class="brand-mark">CA</div>
    <h1>Creator Agent</h1>
    <p class="muted">Your private planning, production, research, and performance workspace.</p>
    <div class="field">
      <label>Password</label>
      <input id="password" class="input" type="password" autocomplete="current-password" required autofocus placeholder="Enter your workspace password">
    </div>
    <button class="btn" style="width:100%;margin-top:8px;padding:13px">Open workspace</button>
    <p id="loginError" class="bad tiny" style="margin-top:12px"></p>
  </form>
</section>
<div id="appView" class="app hidden">
  <aside class="rail">
    <div class="rail-brand">
      <div class="brand-mark" style="width:36px;height:36px;border-radius:10px;font-size:13px">CA</div>
      <div class="rail-brand-text">
        <strong>Creator Agent</strong>
        <div class="tiny">Version 4</div>
      </div>
    </div>
    <nav class="nav" id="nav">
      <button data-view="create" class="active"><span class="nav-icon">✦</span>Create</button>
      <button data-view="sources"><span class="nav-icon">▤</span>Sources</button>
      <button data-view="packages"><span class="nav-icon">◫</span>Packages</button>
      <button data-view="published"><span class="nav-icon">↗</span>Published</button>
      <button data-view="insights"><span class="nav-icon">⌁</span>Insights</button>
      <button data-view="memory"><span class="nav-icon">◎</span>Memory</button>
      <button data-view="usage"><span class="nav-icon">◌</span>Usage</button>
      <button data-view="settings"><span class="nav-icon">⚙</span>Settings</button>
    </nav>
    <div class="rail-bottom"><button id="logoutBtn" class="btn secondary" style="width:100%;font-size:13px">Sign out</button></div>
  </aside>
  <main class="main">
    <header class="topbar">
      <div>
        <div class="eyebrow" id="pageEyebrow">Collaborative studio</div>
        <h1 class="page-title" id="pageTitle">Create</h1>
      </div>
      <div class="row">
        <span id="statusDot" class="badge good">Connected</span>
        <button id="refreshBtn" class="btn secondary small">Refresh</button>
      </div>
    </header>
    <div id="viewRoot" class="view"></div>
  </main>
</div>
<div id="modalRoot"></div>
<div id="toast" class="toast hidden"></div>
<script>
(function(){
'use strict';
var state={boot:null,view:'create',activeConversation:null,activePackage:null,packageTab:'script',pollers:{},jobs:{},conversationQuery:'',searchResults:null,searchTimer:null,sourcePoller:null,sourcePollConversationId:null,copyMap:{},copySequence:0,integrationHealth:null,insightsAutoRefresh:null};
var root=document.getElementById('viewRoot');
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function api(path,options){options=options||{};options.headers=options.headers||{};if(options.body&&!(options.body instanceof FormData)&&typeof options.body!=='string'){options.headers['Content-Type']='application/json';options.body=JSON.stringify(options.body)}return fetch(path,options).then(async function(r){var data;try{data=await r.json()}catch(e){data={error:'Invalid server response'}}if(r.status===401){showLogin();throw new Error('Authentication required.')}if(!r.ok)throw new Error(data.error||('Request failed: '+r.status));return data})}
function toast(msg,type){var kind=type===true?'error':(type||'success');var el=document.getElementById('toast');clearTimeout(el._t);el.className='toast '+kind;el.innerHTML='<div class="row spread" style="align-items:flex-start"><span>'+esc(msg)+'</span>'+(kind==='error'?'<button type="button" class="toast-close" aria-label="Close">×</button>':'')+'</div>';el.classList.remove('hidden');var close=el.querySelector('.toast-close');if(close)close.onclick=function(){el.classList.add('hidden')};if(kind!=='error'){el._t=setTimeout(function(){el.classList.add('hidden')},kind==='warning'?5000:3000)}}
function fmtDate(v){if(!v)return '—';try{return new Date(v).toLocaleString()}catch(e){return v}}
function hasValue(value){if(typeof value==='boolean')return true;if(typeof value==='number')return Number.isFinite(value);if(Array.isArray(value))return value.length>0;return Boolean(String(value==null?'':value).trim())}
function planCompleteness(c){var d=c.decision_snapshot||{};var keys=['topic','core_message','objective','audience','platform','language','tone','duration_seconds','aspect_ratio','format','research_mode','visual_strategy','image_count','tts_required','cta'];var done=keys.filter(function(k){return hasValue(d[k])}).length;var missing=(c.missing_decisions||[]).filter(Boolean);return {score:Math.round(done/keys.length*100),missingText:missing.join(', ')}}
function conversationItemsHtml(){var base=state.searchResults||((state.boot&&state.boot.conversations)||[]);var q=state.conversationQuery.trim().toLowerCase();var list=state.searchResults?base:base.filter(function(c){return !q||String(c.title||'').toLowerCase().includes(q)});return list.length?list.map(function(c){var id=c.id||c.conversation_id;var title=c.title||c.conversation_title||'Untitled conversation';var stage=c.stage||'discovery';var snippet=c.snippet||c.match_snippet||'';var hasPackage=Boolean(c.has_package||Number(c.package_count||0)>0);return '<div class="conversation-item '+(state.activeConversation&&id===state.activeConversation.id?'active':'')+'" data-chat="'+esc(id)+'"><div class="row spread" style="flex-wrap:nowrap"><strong>'+esc(title)+'</strong>'+(hasPackage?'<button class="package-jump" title="Open packages" data-open-package="'+esc(id)+'">📦</button>':'')+'</div><div class="conversation-meta"><span class="stage-badge '+esc(stage)+'">'+esc(stage.replace(/_/g,' '))+'</span><span class="tiny muted">'+esc(c.message_count||0)+' msgs · '+esc(c.package_count||0)+' ver</span></div>'+(snippet?'<div class="tiny muted" style="margin-top:5px">'+esc(snippet)+'</div>':'')+'</div>'}).join(''):'<div class="empty">No matching conversations.</div>'}
function bindConversationRows(){document.querySelectorAll('[data-chat]').forEach(function(el){el.onclick=async function(e){if(e.target.closest('[data-open-package]'))return;await openConversation(el.dataset.chat,true)}});document.querySelectorAll('[data-open-package]').forEach(function(b){b.onclick=async function(e){e.stopPropagation();await openConversation(b.dataset.openPackage,false);state.view='packages';document.querySelectorAll('#nav button').forEach(function(x){x.classList.toggle('active',x.dataset.view==='packages')});render()}})}
function renderConversationItems(){var holder=document.getElementById('conversationItems');if(!holder)return;holder.innerHTML=conversationItemsHtml();bindConversationRows()}
async function searchConversations(){var q=state.conversationQuery.trim();if(q.length<3)return;try{var d=await api('/api/search?q='+encodeURIComponent(q));var rows=d.results||d.conversations||[];state.searchResults=rows.map(function(r){return {id:r.conversation_id||r.id,title:r.conversation_title||r.title,stage:r.stage,message_count:r.message_count,package_count:r.package_count,has_package:r.has_package,snippet:r.snippet||r.match_snippet||r.content_snippet}});renderConversationItems()}catch(e){state.searchResults=null;renderConversationItems()}}
async function submitConversationMessage(text,files,button){if(!String(text||'').trim()&&!files.length)return;var fd=new FormData();fd.append('message',text||'');files.forEach(function(f){fd.append('files',f)});try{if(button)button.disabled=true;var d=await api('/api/conversations/'+encodeURIComponent(state.activeConversation.id)+'/messages',{method:'POST',body:fd});sessionStorage.removeItem('draft:'+state.activeConversation.id);state.activeConversation=d.conversation;await refreshLists();render()}catch(err){toast(err.message,true)}finally{if(button&&document.body.contains(button))button.disabled=false}}
function sendQuickMessage(text,button){return submitConversationMessage(text,[],button)}
async function duplicateConversation(){try{var d=await api('/api/conversations/'+encodeURIComponent(state.activeConversation.id)+'/duplicate',{method:'POST',body:{}});await refreshLists();await openConversation((d.conversation&&d.conversation.id)||d.id,true);toast('Conversation duplicated')}catch(e){toast(e.message,true)}}
async function saveConversationTemplate(){var name=prompt('Template name',state.activeConversation.title||'Content plan');if(!name)return;try{var d=await api('/api/templates',{method:'POST',body:{name:name,decision_snapshot:state.activeConversation.decision_snapshot||{}}});state.boot.templates=state.boot.templates||[];state.boot.templates.unshift(d.template||d);toast('Template saved')}catch(e){toast(e.message,true)}}
function progressPercent(job){var match=String(job&&job.progress||'').match(/\((\d+)\s*\/\s*(\d+)\)/);if(match&&Number(match[2])>0)return Math.max(3,Math.min(100,Math.round(Number(match[1])/Number(match[2])*100)));if(job&&job.state==='queued')return 8;if(job&&job.state==='running')return 45;if(job&&job.state==='completed')return 100;return 12}
function findActiveJob(scope,id){var jobs=Object.keys(state.jobs).map(function(k){return state.jobs[k]}).filter(function(j){return j.state!=='completed'&&j.state!=='failed'});return jobs.find(function(j){if(scope==='package')return j.meta&&j.meta.packageId===id;if(scope==='conversation')return j.meta&&j.meta.conversationId===id;return true})||null}
function jobProgressHtml(scope,id){var job=findActiveJob(scope,id);if(!job)return '';return '<div class="job-inline" data-active-job="'+esc(job.id)+'"><div class="row spread tiny"><strong>'+esc(job.progress||'Working…')+'</strong><span>'+esc(job.state)+'</span></div><div class="progress-shell"><div class="progress-bar" style="width:'+progressPercent(job)+'%"></div></div></div>'}
function updateJobUi(){var jobs=Object.keys(state.jobs).map(function(k){return state.jobs[k]}).filter(function(j){return j.state!=='completed'&&j.state!=='failed'});var latest=jobs[jobs.length-1];var dot=document.getElementById('statusDot');if(dot){dot.textContent=latest?(latest.progress||latest.state):'Connected';dot.classList.toggle('warn',Boolean(latest));dot.classList.toggle('good',!latest)}document.querySelectorAll('[data-job-progress="conversation"]').forEach(function(el){el.innerHTML=state.activeConversation?jobProgressHtml('conversation',state.activeConversation.id):''});document.querySelectorAll('[data-job-progress="package"]').forEach(function(el){el.innerHTML=state.activePackage?jobProgressHtml('package',state.activePackage.id):''});var rb=document.getElementById('regenBtn');if(rb&&state.activePackage){var running=findActiveJob('package',state.activePackage.id);rb.disabled=Boolean(running);rb.classList.toggle('loading',Boolean(running));rb.innerHTML=running?'<span class="spinner"></span> '+esc(running.progress||'Working…'):'Create new version'}}
function needsSourcePolling(a){return ['queued','processing','extracting','indexing','uploaded'].includes(String(a&&a.status||'').toLowerCase())}
function startSourcePolling(conversationId){if(state.sourcePoller&&state.sourcePollConversationId===conversationId)return;stopSourcePolling();state.sourcePollConversationId=conversationId;state.sourcePoller=setInterval(async function(){try{await openConversation(conversationId,false);var list=(state.activeConversation.messages||[]).flatMap(function(m){return m.attachments||[]});if(!list.some(needsSourcePolling)){stopSourcePolling();toast('Source processing completed')}if(state.view==='sources')renderSources()}catch(e){console.warn('[source-poll]',e.message)}},5000)}
function stopSourcePolling(){if(state.sourcePoller)clearInterval(state.sourcePoller);state.sourcePoller=null;state.sourcePollConversationId=null}
function registerCopy(text){var id='copy_'+(++state.copySequence);state.copyMap[id]=String(text||'');return id}
function copyHeading(label,text,marginTop){var id=registerCopy(text);return '<div class="section-heading" style="'+(marginTop?'margin-top:'+marginTop+';':'')+'"><h3>'+esc(label)+'</h3><button type="button" class="btn secondary copy-btn" data-copy-id="'+id+'">Copy</button></div>'}
async function copyText(text){try{await navigator.clipboard.writeText(text);toast('Copied to clipboard')}catch(e){toast('Clipboard access failed. Select and copy the text manually.','warning')}}
function scriptStatsHtml(pkg){var script=pkg.script&&pkg.script.spoken_script||'';var words=script.trim()?script.trim().split(/\s+/).length:0;var seconds=Math.round(words/130*60);var target=Number(pkg.final_brief&&pkg.final_brief.duration_seconds||pkg.script&&pkg.script.estimated_duration_seconds||0);var mismatch=target>0&&Math.abs(seconds-target)/target>.2;return '<div class="script-stats"><span class="badge">'+esc(words)+' words</span><span class="badge">~'+esc(seconds)+' sec at 130 wpm</span>'+(target?'<span class="badge '+(mismatch?'warn':'good')+'">Target '+esc(target)+' sec</span>':'')+'</div>'}
function timelineHtml(beats,total){beats=Array.isArray(beats)?beats:[];if(!beats.length)return '';var duration=Number(total)||Math.max.apply(null,beats.map(function(b){return Number(b.end_second)||0}));if(!duration)return '';return '<div style="margin-top:18px"><h3 style="margin-bottom:8px">Beat timeline</h3><div class="beat-timeline">'+beats.map(function(b){var length=Math.max(1,(Number(b.end_second)||0)-(Number(b.start_second)||0));var purpose=String(b.purpose||'').toLowerCase();var kind=purpose.includes('hook')?'hook':purpose.includes('cta')?'cta':(purpose.includes('main')||purpose.includes('point')||purpose.includes('explain'))?'main':'other';var width=Math.max(6,length/duration*100);return '<div class="beat-segment '+kind+'" style="flex-basis:'+width+'%" title="'+esc((b.spoken_point||'')+' · '+b.start_second+'–'+b.end_second+'s')+'"><strong>'+esc(b.start_second)+'–'+esc(b.end_second)+'s</strong><br>'+esc(b.purpose||'Beat')+'</div>'}).join('')+'</div></div>'}
function getTtsAsset(p){if(p.assets&&p.assets.tts)return p.assets.tts;if(Array.isArray(p.assets))return p.assets.find(function(a){return a.asset_type==='tts'})||null;return null}
function ttsHtml(p){var asset=getTtsAsset(p);if(!asset)return '';var url=asset.url||asset.download_url||(asset.key?'/api/assets?inline=1&key='+encodeURIComponent(asset.key):'');if(!url)return '';return '<div style="margin-top:20px"><h3>TTS preview</h3><audio class="audio-preview" controls preload="none" src="'+esc(url)+'"></audio></div>'}
function openCompareModal(){var packages=(state.activeConversation&&state.activeConversation.packages)||[];if(packages.length<2)return;var a=packages[0],b=packages[1];var rootModal=document.getElementById('modalRoot');rootModal.innerHTML='<div class="modal-backdrop" id="compareBackdrop"><div class="modal"><div class="row spread"><h2>Compare package versions</h2><button id="closeCompare" class="btn ghost">×</button></div><div class="grid2" style="margin-top:16px"><select id="compareA" class="select">'+packages.map(function(p){return '<option value="'+esc(p.id)+'">Version '+esc(p.version_number)+'</option>'}).join('')+'</select><select id="compareB" class="select">'+packages.map(function(p,i){return '<option value="'+esc(p.id)+'" '+(i===1?'selected':'')+'>Version '+esc(p.version_number)+'</option>'}).join('')+'</select></div><div id="compareContent" style="margin-top:16px"></div></div></div>';var renderCompare=function(){var pa=packages.find(function(p){return p.id===document.getElementById('compareA').value})||a;var pb=packages.find(function(p){return p.id===document.getElementById('compareB').value})||b;document.getElementById('compareContent').innerHTML=comparePackagesHtml(pa,pb)};document.getElementById('compareA').onchange=renderCompare;document.getElementById('compareB').onchange=renderCompare;document.getElementById('closeCompare').onclick=function(){rootModal.innerHTML=''};document.getElementById('compareBackdrop').onclick=function(e){if(e.target.id==='compareBackdrop')rootModal.innerHTML=''};renderCompare()}
function comparePackagesHtml(a,b){var pa=a.package||{},pb=b.package||{};function row(label,left,right){return '<h3 style="margin:16px 0 8px">'+esc(label)+'</h3><div class="compare-grid"><div class="compare-section"><div class="tiny muted">Version '+esc(a.version_number)+'</div><div class="script" style="margin-top:6px">'+esc(left||'')+'</div></div><div class="compare-section"><div class="tiny muted">Version '+esc(b.version_number)+'</div><div class="script" style="margin-top:6px">'+esc(right||'')+'</div></div></div>'}return row('Selected hook',pa.selected_hook,pb.selected_hook)+row('Spoken script',pa.script&&pa.script.spoken_script,pb.script&&pb.script.spoken_script)+row('Caption',pa.post_copy&&pa.post_copy.caption,pb.post_copy&&pb.post_copy.caption)}
function integrationHealthHtml(health){var items=[['vectorize','Vectorize','Semantic source retrieval'],['tavily','Tavily','Quick verification and deep research'],['ocr_processor','OCR processor','Scanned document extraction'],['media_processor','Video processor','Uploaded video analysis'],['sarvam_tts','Sarvam TTS','Audio generation'],['ai_gateway','AI Gateway','Centralized AI analytics and policies']];if(!health)return '<div class="list-item"><span class="spinner"></span> Checking integrations…</div>';return items.map(function(item){var on=Boolean(health[item[0]]);return '<div class="list-item integration-row"><span class="integration-dot '+(on?'on':'off')+'"></span><div><strong>'+esc(item[1])+'</strong><div class="tiny muted">'+esc(item[2])+' · '+(on?'configured':'not configured')+'</div></div></div>'}).join('')}
async function loadIntegrationHealth(){try{var d=await api('/api/health/integrations');state.integrationHealth=d.integrations||d;if(state.view==='settings')renderSettings()}catch(e){state.integrationHealth={};if(state.view==='settings')renderSettings();toast('Integration health endpoint is unavailable.','warning')}}
function showLogin(){document.getElementById('loginView').classList.remove('hidden');document.getElementById('appView').classList.add('hidden')}
function showApp(){document.getElementById('loginView').classList.add('hidden');document.getElementById('appView').classList.remove('hidden')}
async function bootstrap(){var data=await api('/api/bootstrap');state.boot=data;showApp();if(!state.activeConversation&&data.conversations.length)await openConversation(data.conversations[0].id,false);render()}
async function start(){try{var s=await api('/api/auth/status');if(s.authenticated)await bootstrap();else showLogin()}catch(e){showLogin()}}
document.getElementById('loginForm').addEventListener('submit',async function(e){e.preventDefault();document.getElementById('loginError').textContent='';try{await api('/api/auth/login',{method:'POST',body:{password:document.getElementById('password').value}});await bootstrap()}catch(err){document.getElementById('loginError').textContent=err.message}});
document.getElementById('logoutBtn').onclick=async function(){await api('/api/auth/logout',{method:'POST'});state.boot=null;state.activeConversation=null;showLogin()};
document.getElementById('refreshBtn').onclick=async function(){try{await bootstrap();toast('Workspace refreshed')}catch(e){toast(e.message,true)}};
document.getElementById('nav').addEventListener('click',function(e){var b=e.target.closest('button[data-view]');if(!b)return;state.view=b.dataset.view;document.querySelectorAll('#nav button').forEach(function(x){x.classList.toggle('active',x===b)});render()});
function render(){if(state.view!=='sources')stopSourcePolling();var titles={create:['Collaborative studio','Create'],sources:['Knowledge base','Sources'],packages:['Versioned production','Packages'],published:['Closed feedback loop','Published'],insights:['Performance review','Insights'],memory:['Controlled learning','Memory'],usage:['Operations','Usage'],settings:['Deployment and migration','Settings']};document.getElementById('pageEyebrow').textContent=titles[state.view][0];document.getElementById('pageTitle').textContent=titles[state.view][1];({create:renderCreate,sources:renderSources,packages:renderPackages,published:renderPublished,insights:renderInsights,memory:renderMemory,usage:renderUsage,settings:renderSettings}[state.view]||renderCreate)();updateJobUi()}
async function openConversation(id,doRender){var data=await api('/api/conversations/'+encodeURIComponent(id));state.activeConversation=data.conversation;state.activePackage=data.conversation.final_package||data.conversation.packages&&data.conversation.packages[0]||null;if(doRender!==false)render()}
function conversationList(){var templates=(state.boot&&state.boot.templates)||[];return '<div class="row spread"><strong style="font-size:13px;font-weight:600">Conversations</strong><button class="btn small" id="newChatBtn">+ New</button></div><div class="field" style="margin:12px 0 8px"><input id="conversationSearch" class="input" type="search" placeholder="Search conversations" value="'+esc(state.conversationQuery)+'"></div>'+(templates.length?'<div class="field" style="margin:0 0 10px"><label>Start from template</label><select id="templateSelect" class="select"><option value="">Blank conversation</option>'+templates.map(function(t){return '<option value="'+esc(t.id)+'">'+esc(t.name||t.title||'Template')+'</option>'}).join('')+'</select></div>':'')+'<div id="conversationItems" class="conversation-list">'+conversationItemsHtml()+'</div>'}
function renderCreate(){var c=state.activeConversation;root.innerHTML='<div class="create-grid"><section class="card">'+conversationList()+'</section><section class="card chat-card">'+(c?chatHtml(c):'<div class="empty">Create a conversation to start planning.</div>')+'</section><aside class="card decision-panel">'+(c?decisionHtml(c):'<div class="empty">Your approved plan will appear here.</div>')+'</aside></div>';bindCreate()}
function chatHtml(c){var plan=planCompleteness(c);var missing=c.missing_decisions||[];var approve=c.stage==='awaiting_approval'&&!missing.length&&!c.ready_to_generate;return '<div class="chat-head"><div class="row spread"><div style="min-width:0"><strong>'+esc(c.title)+'</strong><div class="tiny muted">'+esc(c.stage)+' · updated '+esc(fmtDate(c.updated_at))+'</div></div><div class="row"><a class="btn ghost small" href="/api/conversations/'+encodeURIComponent(c.id)+'/export">Export</a><button id="duplicateChatBtn" class="btn ghost small">Duplicate</button><span class="badge '+(c.ready_to_generate?'good':'accent')+'">'+(c.ready_to_generate?'Approved':'Planning')+'</span></div></div><div class="plan-progress" title="'+esc(plan.missingText)+'"><div class="row spread tiny"><span>Plan completeness</span><strong>'+esc(plan.score)+'%</strong></div><div class="progress-shell"><div class="progress-bar" style="width:'+esc(plan.score)+'%"></div></div>'+(plan.missingText?'<div class="tiny muted" style="margin-top:4px">Missing: '+esc(plan.missingText)+'</div>':'')+'</div><div data-job-progress="conversation">'+jobProgressHtml('conversation',c.id)+'</div></div><div class="messages" id="messages">'+(c.messages||[]).map(messageHtml).join('')+'</div><form id="messageForm" class="composer">'+(missing.length?'<div class="decision-chips" style="margin-bottom:10px">'+missing.map(function(x){return '<button type="button" class="decision-chip" data-missing-decision="'+esc(x)+'">'+esc(x)+'</button>'}).join('')+'</div>':'')+(approve?'<button id="approvePlanBtn" type="button" class="btn" style="width:100%;margin-bottom:10px">Approve plan & generate</button>':'')+'<div class="composer-box"><textarea id="messageInput" placeholder="Share your idea, answer the agent, or approve the final plan..."></textarea><div class="row spread" style="margin-top:8px"><div class="row"><label class="btn secondary small">Attach files<input id="files" type="file" multiple hidden></label><button type="button" class="btn secondary small" id="addUrlBtn">Add URL</button></div><button id="sendBtn" type="submit" class="btn small">Send</button></div><div id="fileNames" class="tiny muted" style="margin-top:6px"></div></div></form>'}
function messageHtml(m){var opts=(m.metadata&&m.metadata.options)||[];var missing=(m.metadata&&m.metadata.missing_decisions)||[];var atts=(m.attachments||[]).map(function(a){return '<div class="attachment-chip">📎 '+esc(a.name)+' · '+esc(a.status)+'</div>'}).join('');return '<article class="message '+esc(m.role)+'"><div>'+esc(m.content)+'</div>'+atts+(opts.length?'<div class="options">'+opts.map(function(o){return '<button class="option" data-option="'+esc(o.value||o.label)+'">'+esc(o.label)+'</button>'}).join('')+'</div>':'')+(missing.length?'<div class="decision-chips">'+missing.map(function(d){return '<button type="button" class="decision-chip" data-missing-decision="'+esc(d)+'">'+esc(d)+'</button>'}).join('')+'</div>':'')+'<div class="meta">'+esc(fmtDate(m.at))+'</div></article>'}
function decisionHtml(c){var d=c.decision_snapshot||{};var keys=[['topic','Topic'],['core_message','Core message'],['objective','Objective'],['audience','Audience'],['platform','Platform'],['language','Language'],['tone','Tone'],['duration_seconds','Duration'],['aspect_ratio','Aspect ratio'],['format','Format'],['research_mode','Research'],['visual_strategy','Visual strategy'],['image_count','AI images'],['tts_required','TTS'],['cta','CTA']];var pins=(c.pins||[]).map(function(p){return '<div class="list-item tiny"><div class="row spread"><span style="flex:1">'+esc(p.text)+'</span><div class="row"><button class="btn ghost small" data-edit-pin="'+esc(p.id)+'" data-pin-text="'+esc(p.text)+'">Edit</button><button class="btn ghost small" data-delete-pin="'+esc(p.id)+'">×</button></div></div></div>'}).join('');return '<div class="row spread"><strong style="font-size:13px;font-weight:600">Production decision</strong><span class="badge">v'+esc(c.version)+'</span></div><div class="decision-grid" style="margin-top:12px">'+keys.map(function(k){var value=d[k[0]];if(typeof value==='boolean')value=value?'Yes':'No';if(k[0]==='duration_seconds'&&value)value=value+' sec';return '<div class="decision-row"><span>'+esc(k[1])+'</span><strong>'+esc(value===0?'0':value||'Not decided')+'</strong></div>'}).join('')+'</div>'+(c.missing_decisions&&c.missing_decisions.length?'<div class="notice" style="margin-top:14px"><strong>Still needed</strong><br>'+esc(c.missing_decisions.join(', '))+'</div>':'')+'<div class="divider"></div><div class="row spread"><strong style="font-size:13px;font-weight:600">Pinned notes</strong><button id="addPinBtn" class="btn secondary small">+ Pin</button></div><div class="list" style="margin-top:9px">'+(pins||'<div class="tiny muted" style="padding:8px 0">Pin important constraints so they are always included.</div>')+'</div><div class="divider"></div><div class="stack"><button id="generateBtn" class="btn" style="width:100%;padding:13px" '+(c.ready_to_generate?'':'disabled')+'>Generate package</button><button id="saveTemplateBtn" class="btn secondary" style="width:100%">Save plan as template</button></div>'+(c.generation_job_id?'<div class="tiny muted" style="margin-top:8px">Latest job: '+esc(c.generation_job_id)+'</div>':'')}
function bindCreate(){var newBtn=document.getElementById('newChatBtn');if(newBtn)newBtn.onclick=async function(){var template=document.getElementById('templateSelect');var body={title:'New content idea'};if(template&&template.value)body.template_id=template.value;var d=await api('/api/conversations',{method:'POST',body:body});state.boot.conversations.unshift(d.conversation);state.activeConversation=d.conversation;state.searchResults=null;render()};bindConversationRows();var search=document.getElementById('conversationSearch');if(search){search.oninput=function(){state.conversationQuery=search.value;state.searchResults=null;renderConversationItems();clearTimeout(state.searchTimer);if(state.conversationQuery.trim().length>=3){state.searchTimer=setTimeout(searchConversations,350)}}}if(!state.activeConversation)return;var input=document.getElementById('messageInput');input.value=sessionStorage.getItem('draft:'+state.activeConversation.id)||'';input.addEventListener('input',function(){sessionStorage.setItem('draft:'+state.activeConversation.id,input.value)});var files=document.getElementById('files');files.onchange=function(){document.getElementById('fileNames').textContent=Array.from(files.files).map(function(f){return f.name}).join(', ')};document.getElementById('messageForm').onsubmit=sendMessage;document.querySelectorAll('[data-option]').forEach(function(b){b.onclick=function(){input.value=b.dataset.option;input.dispatchEvent(new Event('input'));input.focus()}});document.querySelectorAll('[data-missing-decision]').forEach(function(b){b.onclick=function(){input.value='Let\'s decide '+b.dataset.missingDecision+': ';input.dispatchEvent(new Event('input'));input.focus()}});var approve=document.getElementById('approvePlanBtn');if(approve)approve.onclick=function(){sendQuickMessage('Approved.',approve)};document.getElementById('addUrlBtn').onclick=addUrl;document.getElementById('addPinBtn').onclick=addPin;document.querySelectorAll('[data-edit-pin]').forEach(function(b){b.onclick=async function(){var text=prompt('Edit pinned note',b.dataset.pinText||'');if(!text||text.trim()===b.dataset.pinText)return;await api('/api/conversations/'+encodeURIComponent(state.activeConversation.id)+'/pins/'+encodeURIComponent(b.dataset.editPin),{method:'PUT',body:{text:text}});await openConversation(state.activeConversation.id,true);toast('Pinned note updated')}});document.querySelectorAll('[data-delete-pin]').forEach(function(b){b.onclick=async function(){await api('/api/conversations/'+encodeURIComponent(state.activeConversation.id)+'/pins/'+encodeURIComponent(b.dataset.deletePin),{method:'DELETE'});await openConversation(state.activeConversation.id,true)}});var duplicate=document.getElementById('duplicateChatBtn');if(duplicate)duplicate.onclick=duplicateConversation;var saveTemplate=document.getElementById('saveTemplateBtn');if(saveTemplate)saveTemplate.onclick=saveConversationTemplate;document.getElementById('generateBtn').onclick=generatePackage;var m=document.getElementById('messages');m.scrollTop=m.scrollHeight}
async function sendMessage(e){e.preventDefault();var input=document.getElementById('messageInput');var files=document.getElementById('files').files;return submitConversationMessage(input.value,Array.from(files),e.target.querySelector('button[type=submit]'))}
async function addUrl(){var url=prompt('Paste a public HTTPS URL');if(!url)return;try{await api('/api/conversations/'+encodeURIComponent(state.activeConversation.id)+'/urls',{method:'POST',body:{url:url}});toast('URL added and queued for indexing');await openConversation(state.activeConversation.id,true)}catch(e){toast(e.message,true)}}
async function addPin(){var text=prompt('What should this chat always remember?');if(!text)return;await api('/api/conversations/'+encodeURIComponent(state.activeConversation.id)+'/pins',{method:'POST',body:{text:text}});await openConversation(state.activeConversation.id,true)}
async function generatePackage(){try{var button=document.getElementById('generateBtn');if(button)button.disabled=true;var d=await api('/api/conversations/'+encodeURIComponent(state.activeConversation.id)+'/generate',{method:'POST',body:{}});toast('Generation queued');pollJob(d.job_id,function(){return openConversation(state.activeConversation.id,true)},{kind:'generation',conversationId:state.activeConversation.id})}catch(e){toast(e.message,true);var button=document.getElementById('generateBtn');if(button)button.disabled=false}}
async function refreshLists(){var d=await api('/api/conversations');state.boot.conversations=d.conversations}
function pollJob(id,onDone,meta){if(state.pollers[id])return;state.jobs[id]={id:id,state:'queued',progress:'Queued',meta:meta||{}};updateJobUi();var tick=async function(){try{var d=await api('/api/jobs/'+encodeURIComponent(id));var job=d.job||d;state.jobs[id]={id:id,state:job.state||'running',progress:job.progress||job.state||'Working…',error:job.error,meta:meta||{}};updateJobUi();if(job.state==='completed'||job.state==='failed'){clearInterval(state.pollers[id]);delete state.pollers[id];if(job.state==='completed'){toast('Job completed');await refreshAll();if(onDone)await onDone()}else toast(job.error||'Job failed',true);delete state.jobs[id];updateJobUi()}}catch(e){console.warn('[job-poll]',e.message)}};state.pollers[id]=setInterval(tick,2000);tick()}
async function refreshAll(){var old=state.activeConversation&&state.activeConversation.id;state.boot=await api('/api/bootstrap');if(old)await openConversation(old,false);render()}
function renderSources(){var c=state.activeConversation;if(!c){root.innerHTML='<div class="card empty">Open a conversation first.</div>';return}var list=(c.messages||[]).flatMap(function(m){return m.attachments||[]});root.innerHTML='<div class="grid2"><section class="card"><div class="row spread"><div><h2>Conversation sources</h2><p class="muted">Files and URLs are chunked, embedded, and retrieved only inside this chat.</p></div><span class="badge">'+esc(list.length)+' sources</span></div><div class="list" style="margin-top:14px">'+(list.length?list.map(sourceHtml).join(''):'<div class="empty">Upload files or add a URL from the Create tab.</div>')+'</div></section><section class="card"><h2>How retrieval works</h2><div class="stack" style="margin-top:12px"><div class="list-item"><strong>1. Extract</strong><div class="muted" style="margin-top:4px;font-size:13px">PDF pages, documents, images, and audio become text or descriptions.</div></div><div class="list-item"><strong>2. Chunk and index</strong><div class="muted" style="margin-top:4px;font-size:13px">Source passages are stored in D1 and embedded in Vectorize.</div></div><div class="list-item"><strong>3. Retrieve</strong><div class="muted" style="margin-top:4px;font-size:13px">Only passages relevant to your current message are sent to the planner.</div></div></div></section></div>';document.querySelectorAll('[data-delete-source]').forEach(function(b){b.onclick=async function(){if(!confirm('Delete this source and its vector chunks?'))return;await api('/api/attachments/'+encodeURIComponent(b.dataset.deleteSource),{method:'DELETE'});await openConversation(c.id,false);renderSources()}});if(list.some(needsSourcePolling))startSourcePolling(c.id);else stopSourcePolling()}
function sourceHtml(a){var pending=needsSourcePolling(a);var badge=pending?'warn':(a.status==='ready'?'good':'');return '<div class="list-item source-row"><div><strong>'+esc(a.name)+'</strong><div class="tiny muted" style="margin-top:3px">'+esc(a.type)+' · <span class="badge '+badge+'">'+esc(a.status)+'</span> · '+Math.round((a.size||0)/1024)+' KB</div><p style="margin:8px 0 0;font-size:13px;color:var(--ink2)">'+esc(a.summary||'No summary')+'</p></div><div class="stack"><a class="btn secondary small" href="'+esc(a.download_url)+'">Download</a><button class="btn danger small" data-delete-source="'+esc(a.id)+'">Delete</button></div></div>'}
function renderPackages(){var c=state.activeConversation;if(!c){root.innerHTML='<div class="card empty">Open a conversation to view packages.</div>';return}var packages=c.packages||[];if((!state.activePackage||state.activePackage.conversation_id!==c.id)&&packages.length)state.activePackage=c.final_package||packages[0];if(!packages.length)state.activePackage=null;var p=state.activePackage;state.copyMap={};state.copySequence=0;root.innerHTML='<div class="package-layout"><aside class="card"><div class="row spread"><strong style="font-size:13px;font-weight:600">Versions</strong><span class="badge">'+esc(packages.length)+'</span></div>'+(packages.length>1?'<button id="comparePackagesBtn" class="btn secondary small" style="width:100%;margin-top:10px">Compare versions</button>':'')+'<div class="list" style="margin-top:10px">'+(packages.length?packages.map(function(x){return '<div class="package-version '+(p&&x.id===p.id?'active':'')+'" data-package="'+esc(x.id)+'"><strong>Version '+esc(x.version_number)+'</strong><div class="tiny muted">'+esc(x.change_type)+' · '+esc(fmtDate(x.created_at))+'</div></div>'}).join(''):'<div class="empty">No generated package yet.</div>')+'</div></aside><section>'+(p?packageDetail(p):'<div class="card empty">Approve a plan and generate a package.</div>')+'</section></div>';bindPackages()}
function packageDetail(p){var pkg=p.package||{};return '<div class="card"><div class="row spread"><div><div class="eyebrow">Package v'+esc(p.version_number)+'</div><h2>'+esc(pkg.package_title||pkg.final_brief&&pkg.final_brief.topic||'Untitled package')+'</h2></div><div class="row"><span class="badge '+(p.review&&p.review.approved?'good':'warn')+'">Review '+esc(p.review&&p.review.score||'—')+'</span><button id="restoreBtn" class="btn secondary small">Use this version</button></div></div><div data-job-progress="package">'+jobProgressHtml('package',p.id)+'</div><div class="divider"></div><div class="tabs"><button data-ptab="script" class="'+(state.packageTab==='script'?'active':'')+'">Script</button><button data-ptab="visuals" class="'+(state.packageTab==='visuals'?'active':'')+'">Visuals</button><button data-ptab="review" class="'+(state.packageTab==='review'?'active':'')+'">Review</button><button data-ptab="actions" class="'+(state.packageTab==='actions'?'active':'')+'">Revise & publish</button></div>'+packageTab(p)+'</div>'}
function packageTab(p){var pkg=p.package||{};if(state.packageTab==='script'){var script=pkg.script&&pkg.script.spoken_script||'';var caption=pkg.post_copy&&pkg.post_copy.caption||'';var hashtags=(pkg.post_copy&&pkg.post_copy.hashtags||[]).join(' ');var cta=pkg.post_copy&&pkg.post_copy.cta||'';return '<div class="grid2"><div>'+copyHeading('Selected hook',pkg.selected_hook||'')+'<div class="script">'+esc(pkg.selected_hook)+'</div>'+copyHeading('Spoken script',script,'20px')+'<div class="row" style="margin-bottom:10px">'+scriptStatsHtml(pkg)+'</div><div class="script">'+esc(script)+'</div>'+timelineHtml(pkg.script&&pkg.script.beat_sheet,pkg.script&&pkg.script.estimated_duration_seconds)+'</div><div><h3 style="margin-bottom:10px">Delivery notes</h3><div class="list">'+((pkg.script&&pkg.script.delivery_notes)||[]).map(function(x){return '<div class="list-item">'+esc(x)+'</div>'}).join('')+'</div>'+copyHeading('Caption',caption,'20px')+'<div class="script">'+esc(caption)+'</div>'+copyHeading('Hashtags',hashtags,'20px')+'<div class="script">'+esc(hashtags)+'</div>'+copyHeading('CTA',cta,'20px')+'<div class="script">'+esc(cta)+'</div>'+ttsHtml(p)+'<div class="row" style="margin-top:14px">'+downloadLinks(p)+'</div></div></div>'}if(state.packageTab==='visuals')return '<div><h3 style="margin-bottom:6px">'+esc(pkg.visual_plan&&pkg.visual_plan.strategy)+'</h3><p class="muted">'+esc(pkg.visual_plan&&pkg.visual_plan.image_count||0)+' generated images · '+esc(pkg.visual_plan&&pkg.visual_plan.aspect_ratio)+'</p>'+((pkg.visual_plan&&pkg.visual_plan.shots)||[]).map(function(s){var asset=((p.assets&&p.assets.images)||[]).find(function(a){return a.shot_id===s.id});return '<div class="shot"><strong>'+esc(s.start_second)+'–'+esc(s.end_second)+'s</strong><div><div class="row spread"><strong style="font-size:13px">'+esc(s.type)+' · '+esc(s.purpose)+'</strong>'+'<div class="row">'+(asset&&asset.url?'<a class="btn secondary small" href="'+esc(asset.url)+'" target="_blank">View asset</a>':'')+(s.type==='generated_image'?'<button class="btn ghost small" data-regen-shot="'+esc(s.id)+'">Regenerate image</button>':'')+'</div></div><div class="muted" style="font-size:13px;margin-top:4px">'+esc(s.description)+'</div><div class="tiny" style="margin-top:4px;color:var(--muted)">'+esc(s.on_screen_text||'')+'</div></div></div>'}).join('')+'</div>';if(state.packageTab==='review'){var r=p.review||{};return '<div class="grid2"><div><div class="metric"><span class="muted">Critic score</span><strong>'+esc(r.score||'—')+'</strong></div><h3 style="margin-top:20px;margin-bottom:10px">Strengths</h3><div class="list">'+(r.strengths||[]).map(function(x){return '<div class="list-item">'+esc(x)+'</div>'}).join('')+'</div></div><div><h3 style="margin-bottom:10px">Issues</h3><div class="list">'+(r.issues||[]).map(function(x){return '<div class="list-item"><div class="row" style="margin-bottom:6px"><span class="badge '+(x.severity==='critical'||x.severity==='major'?'warn':'')+'">'+esc(x.severity)+'</span> <strong>'+esc(x.area)+'</strong></div><div style="font-size:13px">'+esc(x.problem)+'</div><div class="tiny muted" style="margin-top:4px">Fix: '+esc(x.fix)+'</div></div>'}).join('')+'</div><h3 style="margin-top:20px;margin-bottom:10px">Claim ledger</h3><div class="list">'+(pkg.claim_ledger||[]).map(function(x){return '<div class="list-item"><div class="row" style="margin-bottom:4px"><span class="badge">'+esc(x.status)+'</span></div>'+esc(x.claim)+'<div class="tiny muted">'+esc((x.source_refs||[]).join(', '))+'</div></div>'}).join('')+'</div></div>'+researchHtml(p)}return actionsTab(p)}
function researchHtml(p){var r=p.research||{};var sources=r.sources||[];if(!sources.length)return '';return '<div class="divider"></div><h3 style="margin-bottom:8px">Research evidence</h3><p class="muted">'+esc(r.note||r.status||'Research sources used for this version.')+'</p><div class="list" style="margin-top:10px">'+sources.map(function(x){return '<div class="list-item"><div class="row spread"><strong>'+esc(x.title||x.domain||'Source')+'</strong><span class="badge">'+esc(x.source_type||x.domain||'web')+'</span></div><div class="tiny muted">'+esc(x.url||'')+'</div><p style="margin-top:6px;font-size:13px">'+esc(x.excerpt||'')+'</p></div>'}).join('')+'</div>'}
function downloadLinks(p){return [['Script',p.downloads.script],['Shot list',p.downloads.shot_list],['Manifest',p.downloads.manifest]].filter(function(x){return x[1]}).map(function(x){return '<a class="btn secondary small" href="'+esc(x[1])+'">'+esc(x[0])+'</a>'}).join('')}
function ratingSelect(id){return '<select id="'+id+'" class="select"><option value="">—</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option><option value="5">5</option></select>'}
function actionsTab(p){var running=findActiveJob('package',p.id);var presets=['Make it more conversational and shorter','Rewrite for a younger audience','Add more specificity and concrete examples','Tighten the hook','Improve clarity while preserving all verified claims'];return '<div class="grid2"><div class="stack"><div class="list-item"><h3 style="margin-bottom:12px">Selective regeneration</h3><div class="field"><label>Sections <span class="muted" style="font-weight:400;font-size:12px">(select one or more)</span></label><div id="regenTargets" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">'+[['hook','Hook'],['spoken_script','Spoken script'],['caption','Caption'],['hashtags','Hashtags'],['cta','CTA'],['delivery_notes','Delivery notes'],['beat_sheet','Beat sheet'],['visual_plan','Visual plan'],['full_package','Full package']].map(function(o){return '<label style="display:flex;align-items:center;gap:5px;cursor:pointer;font-size:13px;padding:5px 10px;border:1px solid var(--line2);border-radius:6px;user-select:none"><input type="checkbox" value="'+o[0]+'" style="accent-color:var(--accent)"> '+o[1]+'</label>'}).join('')+'</div></div><div class="field"><label>Preset</label><select id="regenPreset" class="select"><option value="">Choose a common instruction…</option>'+presets.map(function(x){return '<option value="'+esc(x)+'">'+esc(x)+'</option>'}).join('')+'</select></div><div class="field"><label>Instruction</label><textarea id="regenInstruction" class="textarea" placeholder="Make it more direct while preserving the core message."></textarea></div><button id="regenBtn" class="btn '+(running?'loading':'')+'" '+(running?'disabled':'')+'>'+(running?'<span class="spinner"></span> Working…':'Create new version')+'</button>'+jobProgressHtml('package',p.id)+'</div><div class="list-item"><h3 style="margin-bottom:8px">Locks</h3><p class="muted">Comma-separated JSON paths that regeneration must preserve.</p><input id="locksInput" class="input" style="margin-top:8px" value="'+esc((p.locked_paths||[]).join(', '))+'"><button id="locksBtn" class="btn secondary" style="margin-top:9px">Save locks</button></div><div class="list-item"><h3 style="margin-bottom:8px">Manual script edit</h3><p class="muted">Creates a new version while preserving all other package fields.</p><textarea id="manualScript" class="textarea" style="min-height:220px;margin-top:8px">'+esc(p.package&&p.package.script&&p.package.script.spoken_script||'')+'</textarea><button id="manualEditBtn" class="btn secondary" style="margin-top:9px">Save as new version</button></div></div><div class="stack"><div class="list-item"><h3 style="margin-bottom:12px">Feedback</h3><div class="grid3"><div class="field"><label>Hook</label>'+ratingSelect('ratingHook')+'</div><div class="field"><label>Naturalness</label>'+ratingSelect('ratingNaturalness')+'</div><div class="field"><label>Accuracy</label>'+ratingSelect('ratingAccuracy')+'</div><div class="field"><label>Voice match</label>'+ratingSelect('ratingVoice')+'</div><div class="field"><label>Visual usefulness</label>'+ratingSelect('ratingVisuals')+'</div></div><div class="field"><label>What worked?</label><textarea id="liked" class="textarea"></textarea></div><div class="field"><label>What should change?</label><textarea id="changeRequested" class="textarea"></textarea></div><button id="feedbackBtn" class="btn secondary">Save and propose preferences</button></div><div class="list-item"><h3 style="margin-bottom:12px">Mark as published</h3><div class="field"><label>Instagram reel permalink</label><input id="permalink" class="input" placeholder="https://www.instagram.com/reel/..."></div><div class="field"><label>Actual changes</label><textarea id="actualChanges" class="textarea" placeholder="What changed before publishing?"></textarea></div><button id="publishBtn" class="btn">Link publication</button></div></div></div>'}
function bindPackages(){document.querySelectorAll('[data-package]').forEach(function(el){el.onclick=async function(){var d=await api('/api/packages/'+encodeURIComponent(el.dataset.package));state.activePackage=d.package;renderPackages()}});document.querySelectorAll('[data-ptab]').forEach(function(b){b.onclick=function(){state.packageTab=b.dataset.ptab;renderPackages()}});document.querySelectorAll('[data-copy-id]').forEach(function(b){b.onclick=function(){copyText(state.copyMap[b.dataset.copyId]||'')}});document.querySelectorAll('[data-regen-shot]').forEach(function(b){b.onclick=async function(){try{var d=await api('/api/packages/'+encodeURIComponent(state.activePackage.id)+'/regenerate',{method:'POST',body:{target:'single_visual',shot_id:b.dataset.regenShot,instruction:'Regenerate only this visual while preserving its purpose and the approved visual style.'}});pollJob(d.job_id,refreshAll,{kind:'regeneration',packageId:state.activePackage.id});toast('Visual regeneration queued')}catch(e){toast(e.message,true)}}});var compare=document.getElementById('comparePackagesBtn');if(compare)compare.onclick=openCompareModal;if(!state.activePackage)return;var restore=document.getElementById('restoreBtn');if(restore)restore.onclick=async function(){await api('/api/conversations/'+encodeURIComponent(state.activePackage.conversation_id)+'/packages/'+encodeURIComponent(state.activePackage.id)+'/restore',{method:'POST'});toast('Active version changed');await openConversation(state.activePackage.conversation_id,false);renderPackages()};var preset=document.getElementById('regenPreset');if(preset)preset.onchange=function(){if(preset.value){document.getElementById('regenInstruction').value=preset.value;document.getElementById('regenInstruction').focus()}};var rb=document.getElementById('regenBtn');if(rb)rb.onclick=async function(){try{var checked=Array.from(document.querySelectorAll('#regenTargets input[type=checkbox]:checked')).map(function(cb){return cb.value});if(!checked.length){toast('Select at least one section to regenerate.','warning');return}rb.disabled=true;rb.classList.add('loading');rb.innerHTML='<span class="spinner"></span> Queuing…';var d=await api('/api/packages/'+encodeURIComponent(state.activePackage.id)+'/regenerate',{method:'POST',body:{targets:checked,instruction:document.getElementById('regenInstruction').value}});pollJob(d.job_id,refreshAll,{kind:'regeneration',packageId:state.activePackage.id});toast(checked.length===1?'New version queued':'New version queued ('+checked.length+' sections)')}catch(e){rb.disabled=false;rb.classList.remove('loading');rb.textContent='Create new version';toast(e.message,true)}};var regenTargetsEl=document.getElementById('regenTargets');if(regenTargetsEl)regenTargetsEl.addEventListener('change',function(e){var cb=e.target;if(cb.type!=='checkbox')return;if(cb.value==='full_package'&&cb.checked){regenTargetsEl.querySelectorAll('input[type=checkbox]').forEach(function(x){if(x.value!=='full_package')x.checked=false})}else if(cb.value!=='full_package'&&cb.checked){var fp=regenTargetsEl.querySelector('input[value=full_package]');if(fp)fp.checked=false}});var lb=document.getElementById('locksBtn');if(lb)lb.onclick=async function(){var paths=document.getElementById('locksInput').value.split(',').map(function(x){return x.trim()}).filter(Boolean);var d=await api('/api/packages/'+encodeURIComponent(state.activePackage.id)+'/locks',{method:'PUT',body:{paths:paths}});state.activePackage=d.package;toast('Locks saved');renderPackages()};var me=document.getElementById('manualEditBtn');if(me)me.onclick=async function(){var next=JSON.parse(JSON.stringify(state.activePackage.package));next.script.spoken_script=document.getElementById('manualScript').value;var d=await api('/api/packages/'+encodeURIComponent(state.activePackage.id)+'/edit',{method:'POST',body:{package:next,changed_paths:['script.spoken_script'],note:'Manual script edit'}});state.activePackage=d.package;toast('Manual edit saved as a new version');await openConversation(state.activePackage.conversation_id,false);renderPackages()};var fb=document.getElementById('feedbackBtn');if(fb)fb.onclick=async function(){await api('/api/packages/'+encodeURIComponent(state.activePackage.id)+'/feedback',{method:'POST',body:{ratings:{hook:Number(document.getElementById('ratingHook').value)||null,naturalness:Number(document.getElementById('ratingNaturalness').value)||null,accuracy:Number(document.getElementById('ratingAccuracy').value)||null,voice_match:Number(document.getElementById('ratingVoice').value)||null,visual_usefulness:Number(document.getElementById('ratingVisuals').value)||null},liked:document.getElementById('liked').value,change_requested:document.getElementById('changeRequested').value}});toast('Feedback saved. Any durable preference is waiting for your approval.')};var pb=document.getElementById('publishBtn');if(pb)pb.onclick=async function(){await api('/api/packages/'+encodeURIComponent(state.activePackage.id)+'/publish',{method:'POST',body:{platform:'instagram',permalink:document.getElementById('permalink').value,published_at:new Date().toISOString(),actual_changes:document.getElementById('actualChanges').value}});toast('Publication linked');await bootstrap();state.view='published';render()}}
function renderPublished(){var list=state.boot.publications||[];root.innerHTML='<div class="card"><div class="row spread"><div><h2>Published content</h2><p class="muted">Link generated packages to actual reels so performance can be tied to creative decisions.</p></div><span class="badge">'+esc(list.length)+' linked</span></div><div class="list" style="margin-top:16px">'+(list.length?list.map(function(p){return '<div class="list-item"><div class="row spread"><div><strong>'+esc(p.platform)+' · package v'+esc(p.version_number)+'</strong><div class="tiny muted" style="margin-top:3px">'+esc(fmtDate(p.published_at))+'</div></div>'+(p.permalink?'<a class="btn secondary small" href="'+esc(p.permalink)+'" target="_blank">Open</a>':'')+'</div><p style="margin-top:8px;font-size:13px">'+esc(p.hook_used||'No hook recorded')+'</p><div class="tiny muted" style="margin-top:4px">'+esc(p.actual_changes||'No publishing changes recorded.')+'</div></div>'}).join(''):'<div class="empty">Mark a package as published from the Packages tab.</div>')+'</div></div>'}
function renderInsights(){var list=state.boot.insights||[];var latest=list[0];root.innerHTML='<div class="row spread" style="margin-bottom:20px"><div><h2>Daily insights</h2><p class="muted">Latest three reels, metric snapshots, and careful experiments.</p></div><button id="insightsRefresh" class="btn">Refresh Instagram</button></div>'+(latest?insightHtml(latest):'<div class="card empty">No insight report yet.</div>');document.getElementById('insightsRefresh').onclick=async function(){var d=await api('/api/insights/refresh',{method:'POST'});pollJob(d.job_id,bootstrap);toast('Insights refresh queued')}}
function insightHtml(r){var a=r.analysis||{};return '<div class="stack"><section class="card"><div class="row spread"><div><div class="eyebrow">'+esc(fmtDate(r.created_at))+'</div><h2>'+esc(a.headline)+'</h2></div><span class="badge">'+esc(r.status)+'</span></div><p style="margin-top:8px">'+esc(a.summary)+'</p><div class="grid3" style="margin-top:16px">'+(r.reels||[]).map(function(x){return '<div class="metric"><span class="muted">'+esc(x.timestamp)+'</span><strong>'+esc(x.metrics&&x.metrics.views||'—')+'</strong><span style="font-size:12px;color:var(--muted)">views · '+esc(x.metrics&&x.metrics.calculated_interactions||0)+' interactions</span></div>'}).join('')+'</div></section><div class="grid3"><section class="card"><h3 style="margin-bottom:12px">Wins</h3><div class="list">'+(a.wins||[]).map(function(x){return '<div class="list-item">'+esc(x)+'</div>'}).join('')+'</div></section><section class="card"><h3 style="margin-bottom:12px">Improve</h3><div class="list">'+(a.improvements||[]).map(function(x){return '<div class="list-item">'+esc(x)+'</div>'}).join('')+'</div></section><section class="card"><h3 style="margin-bottom:12px">Next experiments</h3><div class="list">'+(a.next_reel_experiments||[]).map(function(x){return '<div class="list-item">'+esc(x)+'</div>'}).join('')+'</div></section></div></div>'}
function renderMemory(){var c=state.boot.context||{};var suggestions=state.boot.suggestions||[];var approved=state.boot.learnings||[];var proposed=state.boot.proposed_learnings||[];root.innerHTML='<div class="grid2"><section class="card"><h2>Page Memory</h2><p class="muted" style="margin-bottom:16px">Global editorial constitution shared by every conversation.</p><form id="memoryForm">'+memoryFields(c)+'<button class="btn" style="margin-top:8px">Save Page Memory</button></form></section><div class="stack"><section class="card"><h2>Pending preference suggestions</h2><p class="muted">Nothing is learned globally without your approval.</p><div class="list" style="margin-top:12px">'+(suggestions.length?suggestions.map(function(s){return '<div class="list-item"><strong>'+esc(s.suggestion)+'</strong><div class="tiny muted" style="margin-top:3px">Target: '+esc(s.target_field||'non-negotiables')+'</div><div class="row" style="margin-top:10px"><button class="btn small" data-suggestion="'+esc(s.id)+'" data-decision="approve">Approve</button><button class="btn secondary small" data-suggestion="'+esc(s.id)+'" data-decision="reject">Reject</button></div></div>'}).join(''):'<div class="empty">No pending suggestions.</div>')+'</div></section><section class="card"><h2>Proposed performance learnings</h2><div class="list" style="margin-top:12px">'+(proposed.length?proposed.map(function(l){return '<div class="list-item"><strong>'+esc(l.statement)+'</strong><div class="tiny muted" style="margin-top:3px">'+esc(l.observation)+' · confidence '+esc(Math.round((l.confidence||0)*100))+'%</div><div class="row" style="margin-top:10px"><button class="btn small" data-learning="'+esc(l.id)+'" data-decision="approve">Approve</button><button class="btn secondary small" data-learning="'+esc(l.id)+'" data-decision="reject">Reject</button></div></div>'}).join(''):'<div class="empty">No proposed performance learnings.</div>')+'</div></section><section class="card"><h2>Approved performance memory</h2><div class="list" style="margin-top:12px">'+(approved.length?approved.map(function(l){return '<div class="list-item"><strong>'+esc(l.statement)+'</strong><div class="tiny muted" style="margin-top:3px">Confidence '+esc(Math.round((l.confidence||0)*100))+'% · '+esc(l.evidence_count)+' examples</div></div>'}).join(''):'<div class="empty">No approved performance learnings yet.</div>')+'</div></section></div></div>';document.getElementById('memoryForm').onsubmit=saveMemory;document.querySelectorAll('[data-suggestion]').forEach(function(b){b.onclick=async function(){await api('/api/memory-suggestions/'+encodeURIComponent(b.dataset.suggestion)+'/'+b.dataset.decision,{method:'POST'});await bootstrap();state.view='memory';render()}});document.querySelectorAll('[data-learning]').forEach(function(b){b.onclick=async function(){await api('/api/performance-learnings/'+encodeURIComponent(b.dataset.learning)+'/'+b.dataset.decision,{method:'POST'});await bootstrap();state.view='memory';render()}})}
function memoryFields(c){function val(k){return esc(c[k]||'')}function arr(k){return esc((c[k]||[]).join('\n'))}return '<div class="field"><label>Page name</label><input class="input" name="page_name" value="'+val('page_name')+'"></div><div class="field"><label>Mission</label><textarea class="textarea" name="mission">'+val('mission')+'</textarea></div><div class="field"><label>Intended impact</label><textarea class="textarea" name="intended_impact">'+val('intended_impact')+'</textarea></div><div class="field"><label>Audience</label><textarea class="textarea" name="audience">'+val('audience')+'</textarea></div><div class="field"><label>Voice</label><textarea class="textarea" name="voice">'+val('voice')+'</textarea></div><div class="grid2"><div class="field"><label>Content pillars (one per line)</label><textarea class="textarea" name="content_pillars">'+arr('content_pillars')+'</textarea></div><div class="field"><label>Languages</label><textarea class="textarea" name="language_preferences">'+arr('language_preferences')+'</textarea></div></div><div class="grid2"><div class="field"><label>Non-negotiables</label><textarea class="textarea" name="non_negotiables">'+arr('non_negotiables')+'</textarea></div><div class="field"><label>Avoid</label><textarea class="textarea" name="avoid">'+arr('avoid')+'</textarea></div></div><div class="field"><label>Evidence policy</label><textarea class="textarea" name="evidence_policy">'+val('evidence_policy')+'</textarea></div><div class="field"><label>Visual preferences</label><textarea class="textarea" name="visual_preferences">'+val('visual_preferences')+'</textarea></div><div class="field"><label>CTA style</label><input class="input" name="cta_style" value="'+val('cta_style')+'"></div><div class="grid3"><div class="field"><label>Default duration</label><input class="input" name="default_duration_seconds" type="number" value="'+esc(c.default_duration_seconds||60)+'"></div><div class="field"><label>Aspect ratio</label><input class="input" name="default_aspect_ratio" value="'+val('default_aspect_ratio')+'"></div><div class="field"><label>Format</label><input class="input" name="default_format" value="'+val('default_format')+'"></div></div>'}
async function saveMemory(e){e.preventDefault();var fd=new FormData(e.target);var obj={};fd.forEach(function(v,k){obj[k]=v});['content_pillars','language_preferences','non_negotiables','avoid'].forEach(function(k){obj[k]=String(obj[k]||'').split(/\n|,/).map(function(x){return x.trim()}).filter(Boolean)});obj.default_duration_seconds=Number(obj.default_duration_seconds||60);var d=await api('/api/context',{method:'PUT',body:obj});state.boot.context=d.context;toast('Page Memory saved')}
function renderUsage(){var u=state.boot.usage||{};var rows=u.totals||[];root.innerHTML='<div class="grid3"><div class="card metric"><span class="muted">AI calls</span><strong>'+esc(u.total_calls||u.calls||0)+'</strong></div><div class="card metric"><span class="muted">Estimated input tokens</span><strong>'+esc(u.input_tokens||u.total_input_tokens||0)+'</strong></div><div class="card metric"><span class="muted">Estimated output tokens</span><strong>'+esc(u.output_tokens||u.total_output_tokens||0)+'</strong></div></div><div class="card" style="margin-top:16px"><h2 style="margin-bottom:16px">Usage by task</h2><div class="list">'+(Array.isArray(rows)&&rows.length?rows.map(function(x){return '<div class="list-item row spread"><strong>'+esc(x.task)+'</strong><span class="muted" style="font-size:13px">'+esc(x.calls||x.count)+' calls · '+esc(x.avg_latency_ms||x.latency_ms||0)+' ms avg</span></div>'}).join(''):'<div class="empty">Usage appears after AI calls are made.</div>')+'</div></div>'}
function renderSettings(){var health=state.integrationHealth||state.boot.integrations||null;var auto=state.insightsAutoRefresh;if(auto===null)auto=Boolean(state.boot.insights_auto_refresh||(state.boot.settings&&state.boot.settings.insights_auto_refresh));root.innerHTML='<div class="grid2"><section class="card"><h2 style="margin-bottom:8px">Migration</h2><p class="muted">Run once after creating D1 and applying migrations. This imports old KV Page Memory, chats, packages, and insight reports. Existing R2 assets are reused.</p><button id="migrateBtn" class="btn" style="margin-top:12px">Import legacy KV data</button><pre id="migrationOutput" class="code hidden" style="margin-top:12px"></pre></section><section class="card"><h2 style="margin-bottom:12px">System checks</h2><div class="list"><div class="list-item"><strong>Models</strong><div class="tiny muted" style="margin-top:4px">'+esc(JSON.stringify(state.boot.models))+'</div></div><div class="list-item"><strong>Version</strong><div style="margin-top:4px;font-size:13px">'+esc(state.boot.version)+'</div></div></div><button id="testModelsBtn" class="btn secondary" style="margin-top:12px">Test Workers AI</button></section><section class="card"><div class="row spread"><h2 style="margin-bottom:12px">Optional integrations</h2><button id="refreshIntegrationsBtn" class="btn ghost small">Check again</button></div><div class="list">'+integrationHealthHtml(health)+'</div></section><section class="card"><h2 style="margin-bottom:8px">Instagram schedule</h2><p class="muted">The Worker cron still controls when scheduled events run. This switch decides whether a scheduled event should refresh insights.</p><label class="toggle-row"><input id="insightsAutoRefresh" type="checkbox" '+(auto?'checked':'')+'><span>Enable daily auto-refresh</span></label></section><section class="card"><h2 style="margin-bottom:8px">Data ownership</h2><p class="muted">Deleting a conversation removes D1 records, source vectors, uploaded files, and generated assets on a best-effort basis.</p>'+(state.activeConversation?'<button id="deleteChatBtn" class="btn danger" style="margin-top:12px">Delete current conversation</button>':'')+'</section></div>';document.getElementById('migrateBtn').onclick=async function(){if(!confirm('Import legacy KV data into D1? It is idempotent unless force mode is used.'))return;var d=await api('/api/admin/migrate-legacy',{method:'POST',body:{force:false}});var out=document.getElementById('migrationOutput');out.textContent=JSON.stringify(d.report,null,2);out.classList.remove('hidden');toast('Migration completed')};document.getElementById('testModelsBtn').onclick=async function(){try{await api('/api/test-models',{method:'POST'});toast('Workers AI is responding')}catch(e){toast(e.message,true)}};document.getElementById('refreshIntegrationsBtn').onclick=function(){state.integrationHealth=null;loadIntegrationHealth()};var toggle=document.getElementById('insightsAutoRefresh');toggle.onchange=async function(){try{var d=await api('/api/settings/insights-auto-refresh',{method:'PUT',body:{enabled:toggle.checked}});state.insightsAutoRefresh=typeof d.enabled==='boolean'?d.enabled:toggle.checked;toast(state.insightsAutoRefresh?'Daily auto-refresh enabled':'Daily auto-refresh disabled')}catch(e){toggle.checked=!toggle.checked;toast(e.message,true)}};var del=document.getElementById('deleteChatBtn');if(del)del.onclick=async function(){if(!confirm('Permanently delete the current conversation and its assets?'))return;await api('/api/conversations/'+encodeURIComponent(state.activeConversation.id),{method:'DELETE'});state.activeConversation=null;await bootstrap();toast('Conversation deleted')};if(!health)loadIntegrationHealth()}
start();
})();
</script>
</body></html>`;
