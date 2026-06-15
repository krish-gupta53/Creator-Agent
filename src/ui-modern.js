export const MODERN_UI = String.raw`
<style>
  :root{
    --bg:#f7f6f2;--surface:#fff;--surface2:#f1f0eb;--surface3:#e8e6df;--panel:#fbfaf7;
    --ink:#20201e;--ink2:#4d4b46;--muted:#858179;--line:#e5e1d8;--line2:#d8d3c8;
    --accent:#d97757;--accent-dim:#b95e43;--accent-bg:rgba(217,119,87,.08);--accent-bg2:rgba(217,119,87,.13);
    --blue:#5379c5;--blue-bg:rgba(83,121,197,.08);--red:#ca4f4f;--red-bg:rgba(202,79,79,.08);
    --good:#328b62;--good-bg:rgba(50,139,98,.09);--warn:#ad751f;--warn-bg:rgba(173,117,31,.09);
    --shadow:0 24px 60px rgba(48,42,32,.14);--shadow-sm:0 8px 25px rgba(48,42,32,.08);
    --radius:18px;--radius-sm:13px;--radius-xs:9px;--font-display:'DM Sans',system-ui,sans-serif;--font-body:'DM Sans',system-ui,sans-serif;
    --rail:#20211f;--rail-ink:#f5f2eb;--rail-muted:#aaa69d;
  }
  body.ca-dark{
    --bg:#181817;--surface:#222220;--surface2:#2a2a27;--surface3:#33322f;--panel:#252522;
    --ink:#f2f0e9;--ink2:#c6c2b8;--muted:#928f87;--line:#34332f;--line2:#46443f;
    --accent:#e08a69;--accent-dim:#ef9a78;--accent-bg:rgba(224,138,105,.09);--accent-bg2:rgba(224,138,105,.15);
    --blue:#83a5e8;--blue-bg:rgba(131,165,232,.1);--red:#ef7a75;--red-bg:rgba(239,122,117,.1);
    --good:#71c99c;--good-bg:rgba(113,201,156,.1);--warn:#dfb461;--warn-bg:rgba(223,180,97,.1);
    --shadow:0 25px 65px rgba(0,0,0,.36);--shadow-sm:0 8px 25px rgba(0,0,0,.22);--rail:#111210;--rail-muted:#96938b;
  }
  html{background:var(--bg);scroll-behavior:smooth}
  body.ca-modern{background:var(--bg);color:var(--ink);letter-spacing:-.005em}
  body.ca-modern::before{content:'';position:fixed;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(circle at 74% -12%,rgba(217,119,87,.1),transparent 33%),radial-gradient(circle at 24% 108%,rgba(83,121,197,.06),transparent 29%)}
  body.ca-modern *{scrollbar-width:thin;scrollbar-color:var(--line2) transparent}
  body.ca-modern *::-webkit-scrollbar{width:7px;height:7px}body.ca-modern *::-webkit-scrollbar-thumb{background:var(--line2);border-radius:99px;border:2px solid transparent;background-clip:padding-box}
  body.ca-modern h1,body.ca-modern h2,body.ca-modern h3{font-family:var(--font-display);letter-spacing:-.035em}

  body.ca-modern .app{grid-template-columns:230px minmax(0,1fr);background:var(--bg)}
  body.ca-modern .rail{padding:14px 10px;background:var(--rail);border:0;box-shadow:inset -1px 0 rgba(255,255,255,.045);z-index:8}
  body.ca-modern .rail-brand{padding:8px 10px 22px;gap:11px}
  body.ca-modern .rail-brand .brand-mark{width:35px!important;height:35px!important;border-radius:11px!important;background:linear-gradient(145deg,#ef9b78,#d5684a);color:#fff;box-shadow:0 8px 24px rgba(217,119,87,.25);font-size:12px!important}
  body.ca-modern .rail-brand-text strong{font-size:14px;color:var(--rail-ink)}body.ca-modern .rail-brand-text .tiny{font-size:10px;color:var(--rail-muted)}
  body.ca-modern .nav{gap:3px}body.ca-modern .nav button{position:relative;padding:10px 11px;border-radius:10px;color:var(--rail-muted);font-size:13px;gap:10px;transition:.16s}
  body.ca-modern .nav button:hover{background:rgba(255,255,255,.07);color:var(--rail-ink);transform:translateX(2px)}
  body.ca-modern .nav button.active{background:rgba(255,255,255,.1);color:var(--rail-ink);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}
  body.ca-modern .nav button.active::before{content:'';position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:99px;background:#ef9b78}
  body.ca-modern .nav-icon{opacity:.85!important}.ca-modern .rail-bottom{border-color:rgba(255,255,255,.08)}
  body.ca-modern .main{padding:17px 21px 28px;background:transparent}body.ca-modern .topbar{max-width:1720px;margin:0 auto 13px;min-height:44px;align-items:center}
  body.ca-modern .eyebrow{display:none}body.ca-modern .page-title{font-size:22px;font-weight:650;color:var(--ink)}body.ca-modern .view{max-width:1720px}

  body.ca-modern .btn{border-radius:11px;padding:9px 15px;background:var(--ink);color:var(--surface);font-size:13px;font-weight:600;box-shadow:none;transition:.16s}
  body.ca-modern .btn:hover{filter:none;transform:translateY(-1px);box-shadow:0 7px 18px rgba(30,29,26,.13)}
  body.ca-modern .btn.secondary{background:var(--surface);color:var(--ink2);border:1px solid var(--line)}body.ca-modern .btn.secondary:hover{background:var(--surface2);color:var(--ink);border-color:var(--line2)}
  body.ca-modern .btn.ghost{background:transparent;color:var(--muted)}body.ca-modern .btn.ghost:hover{background:var(--surface2);color:var(--ink);box-shadow:none;transform:none}
  body.ca-modern .input,body.ca-modern .textarea,body.ca-modern .select{background:var(--surface);border:1px solid var(--line);border-radius:12px;color:var(--ink);box-shadow:0 1px 2px rgba(30,29,26,.025)}
  body.ca-modern .input:focus,body.ca-modern .textarea:focus,body.ca-modern .select:focus{border-color:rgba(217,119,87,.5);box-shadow:0 0 0 4px var(--accent-bg)}
  body.ca-modern .card{background:var(--surface);border-color:var(--line);border-radius:18px;box-shadow:0 1px 2px rgba(40,36,29,.025)}
  body.ca-modern .subtle{background:var(--panel)}body.ca-modern .badge{background:var(--surface2);border-color:var(--line);color:var(--muted)}body.ca-modern .badge.accent{background:var(--accent-bg2);color:var(--accent-dim);border-color:rgba(217,119,87,.2)}

  body.ca-modern .create-grid{grid-template-columns:225px minmax(520px,1fr) 265px;gap:12px;min-height:calc(100vh - 77px)}
  body.ca-modern .create-grid>.card:first-child,body.ca-modern .decision-panel{padding:13px;background:var(--panel)}
  body.ca-modern .conversation-list{height:calc(100vh - 162px);margin-top:9px;gap:3px}
  body.ca-modern .conversation-item{position:relative;padding:10px 11px;border-radius:11px;transition:.15s}.ca-modern .conversation-item:hover{background:var(--surface);border-color:var(--line)}
  body.ca-modern .conversation-item.active{background:var(--surface);border-color:var(--line2);box-shadow:var(--shadow-sm)}
  body.ca-modern .conversation-item.active::before{content:'';position:absolute;left:-1px;top:10px;height:24px;width:3px;border-radius:99px;background:var(--accent)}
  body.ca-modern .chat-card{height:calc(100vh - 77px);min-height:680px;border-radius:20px;background:var(--surface);border-color:var(--line);box-shadow:var(--shadow-sm)}
  body.ca-modern .chat-head{padding:13px 18px;border-color:var(--line);background:rgba(255,255,255,.78);backdrop-filter:blur(18px);z-index:3}body.ca-dark .chat-head{background:rgba(34,34,32,.8)}
  body.ca-modern .messages{padding:28px max(28px,6vw) 34px;gap:24px;background:var(--surface);scroll-behavior:smooth}
  body.ca-modern .message{position:relative;max-width:min(760px,88%);padding:0 0 0 39px;border:0!important;border-radius:0;background:transparent!important;color:var(--ink)!important;font-size:15px;line-height:1.72;font-weight:400!important;box-shadow:none!important}
  body.ca-modern .message::before{position:absolute;left:0;top:0;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;font-size:10px;font-weight:750}
  body.ca-modern .message.assistant{justify-self:start;width:min(760px,90%)}body.ca-modern .message.assistant::before{content:'CA';background:linear-gradient(145deg,#ef9b78,#d5684a);color:#fff;box-shadow:0 5px 14px rgba(217,119,87,.22)}
  body.ca-modern .message.user{justify-self:end;width:auto;max-width:min(650px,82%);padding:12px 16px;border-radius:17px!important;background:var(--surface2)!important}body.ca-modern .message.user::before{display:none}
  body.ca-modern .option,body.ca-modern .decision-chip{background:var(--surface);color:var(--ink2);border-color:var(--line2);border-radius:11px;box-shadow:0 2px 8px rgba(40,36,29,.035)}
  body.ca-modern .option:hover,body.ca-modern .decision-chip:hover{background:var(--accent-bg);border-color:rgba(217,119,87,.3);color:var(--accent-dim)}
  body.ca-modern .composer{padding:10px max(18px,5vw) 16px;border:0;background:linear-gradient(180deg,rgba(255,255,255,0),var(--surface) 22%)}
  body.ca-modern .composer-box{padding:11px 12px 10px;border:1px solid var(--line2);border-radius:20px;background:var(--surface);box-shadow:0 14px 40px rgba(54,48,38,.13);transition:.18s}
  body.ca-modern .composer-box:focus-within{border-color:rgba(217,119,87,.45);box-shadow:0 16px 46px rgba(54,48,38,.16),0 0 0 3px var(--accent-bg);transform:translateY(-1px)}
  body.ca-modern .composer textarea{min-height:54px;max-height:210px;padding:4px 3px;font-size:14px}
  body.ca-modern .generation-controls{grid-template-columns:minmax(150px,1.35fr) repeat(3,minmax(108px,1fr));gap:6px;margin-bottom:9px;padding:0;border:0;background:transparent}
  body.ca-modern .generation-control{min-height:34px;padding:6px 9px;border-color:var(--line);border-radius:10px;background:var(--panel)}body.ca-modern .generation-control strong,body.ca-modern .generation-control select{font-size:10px;color:var(--ink2)}
  body.ca-modern .generation-control input{appearance:none;width:28px;height:16px;border-radius:99px;background:var(--surface3);position:relative;cursor:pointer;transition:.18s}
  body.ca-modern .generation-control input::after{content:'';position:absolute;width:12px;height:12px;left:2px;top:2px;border-radius:50%;background:var(--surface);box-shadow:0 1px 4px rgba(0,0,0,.18);transition:.18s}
  body.ca-modern .generation-control input:checked{background:var(--accent)}body.ca-modern .generation-control input:checked::after{transform:translateX(12px)}body.ca-modern .control-help{display:none}
  body.ca-modern .decision-panel{height:calc(100vh - 77px)}body.ca-modern .decision-row{border-color:var(--line)}

  body.ca-modern .list-item,body.ca-modern .script,body.ca-modern .metric{background:var(--panel);border-color:var(--line);border-radius:14px}
  body.ca-modern .list-item{transition:.15s}.ca-modern .list-item:hover{border-color:var(--line2);box-shadow:var(--shadow-sm);transform:translateY(-1px)}
  body.ca-modern .tabs{background:var(--surface2);border-color:var(--line);border-radius:12px}.ca-modern .tabs button{border-radius:9px}.ca-modern .tabs button.active{background:var(--surface);color:var(--ink);box-shadow:0 2px 9px rgba(40,36,29,.07)}
  body.ca-modern .modal{background:var(--surface);border-color:var(--line);border-radius:22px;box-shadow:var(--shadow)}body.ca-modern .modal-backdrop{background:rgba(31,30,27,.44);backdrop-filter:blur(10px)}
  body.ca-modern .toast{background:var(--ink);color:var(--surface);border:0;border-radius:14px;box-shadow:var(--shadow)}
  body.ca-modern .empty{min-height:150px;display:grid;place-items:center;background:linear-gradient(145deg,var(--panel),var(--surface));border:1px dashed var(--line2);border-radius:14px}
  body.ca-modern .login{background:var(--bg);background-image:radial-gradient(circle at 65% 10%,rgba(217,119,87,.16),transparent 33%),radial-gradient(circle at 15% 90%,rgba(83,121,197,.09),transparent 28%)}
  body.ca-modern .login-card{background:rgba(255,255,255,.86);border-color:rgba(255,255,255,.75);border-radius:28px;box-shadow:0 35px 90px rgba(62,53,40,.18);backdrop-filter:blur(20px)}body.ca-dark .login-card{background:rgba(34,34,32,.9);border-color:rgba(255,255,255,.08)}

  .ca-shell-action{width:34px;height:34px;padding:0!important;display:grid!important;place-items:center;border-radius:10px!important;font-size:15px!important}.ca-composer-hint{font-size:9px;color:var(--muted);margin-left:auto;white-space:nowrap}
  body.ca-focus .create-grid{grid-template-columns:minmax(0,1fr);max-width:1120px;margin:0 auto}body.ca-focus .create-grid>.card:first-child,body.ca-focus .decision-panel{display:none}
  @media(max-width:1150px) and (min-width:781px){body.ca-modern .app{grid-template-columns:76px 1fr}body.ca-modern .rail-brand{justify-content:center}.ca-modern .rail-brand-text{display:none}body.ca-modern .nav button{font-size:0;justify-content:center}.ca-modern .nav-icon{font-size:17px!important}body.ca-modern .create-grid{grid-template-columns:205px minmax(0,1fr)}body.ca-modern .decision-panel{display:none}}
  @media(max-width:780px){body.ca-modern .app{display:block}body.ca-modern .rail{position:sticky;top:0;height:auto;display:flex;flex-direction:row;padding:8px 10px}body.ca-modern .rail-brand{padding:0 8px 0 0}.ca-modern .rail-brand-text{display:none}body.ca-modern .nav{display:flex;flex:1;overflow:auto}body.ca-modern .nav button{font-size:0;padding:9px 11px;justify-content:center}body.ca-modern .main{padding:11px}body.ca-modern .create-grid{grid-template-columns:1fr}.ca-modern .create-grid>.card:first-child,.ca-modern .decision-panel{display:none}body.ca-modern .chat-card{height:calc(100vh - 116px);min-height:610px;border-radius:16px}body.ca-modern .messages{padding:22px 15px 28px}.ca-modern .message{max-width:96%;font-size:14px}.ca-modern .generation-controls{grid-template-columns:1fr 1fr}.ca-modern .package-layout,.ca-modern .grid2,.ca-modern .grid3{grid-template-columns:1fr}.ca-composer-hint{display:none}}
</style>
<script>
(() => {
  const THEME_KEY = 'creator-agent-theme';
  const FOCUS_KEY = 'creator-agent-focus';
  let enhancementScheduled = false;

  function preferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    const dark = theme === 'dark';
    document.body.classList.add('ca-modern');
    document.body.classList.toggle('ca-dark', dark);
    const button = document.getElementById('caThemeToggle');
    if (!button) return;
    const label = dark ? '☀' : '☾';
    const title = dark ? 'Use light theme' : 'Use dark theme';
    if (button.textContent !== label) button.textContent = label;
    if (button.title !== title) button.title = title;
    if (button.getAttribute('aria-label') !== title) button.setAttribute('aria-label', title);
  }

  function ensureThemeButton() {
    const actions = document.querySelector('.topbar>.row');
    if (!actions || document.getElementById('caThemeToggle')) return;
    const button = document.createElement('button');
    button.id = 'caThemeToggle';button.type = 'button';button.className = 'btn secondary small ca-shell-action';
    button.addEventListener('click', () => {
      const next = document.body.classList.contains('ca-dark') ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);applyTheme(next);
    });
    actions.insertBefore(button, actions.firstChild);
  }

  function ensureFocusButton() {
    const actions = document.querySelector('.chat-head .row.spread>.row:last-child');
    if (!actions || document.getElementById('caFocusToggle')) return;
    const button = document.createElement('button');
    button.id = 'caFocusToggle';button.type = 'button';button.className = 'btn ghost small';button.title = 'Toggle distraction-free view';
    button.textContent = document.body.classList.contains('ca-focus') ? 'Exit focus' : 'Focus';
    button.addEventListener('click', () => {
      const enabled = !document.body.classList.contains('ca-focus');
      document.body.classList.toggle('ca-focus', enabled);sessionStorage.setItem(FOCUS_KEY, enabled ? '1' : '0');
      const label = enabled ? 'Exit focus' : 'Focus';if (button.textContent !== label) button.textContent = label;
    });
    actions.insertBefore(button, actions.firstChild);
  }

  function enhanceComposer() {
    const textarea = document.getElementById('messageInput');
    if (!textarea || textarea.dataset.caEnhanced === '1') return;
    textarea.dataset.caEnhanced = '1';
    const resize = () => { textarea.style.height = 'auto';textarea.style.height = Math.min(210, Math.max(54, textarea.scrollHeight)) + 'px'; };
    textarea.addEventListener('input', resize);
    textarea.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault();document.getElementById('messageForm')?.requestSubmit(); }
    });
    resize();
    const row = document.querySelector('#messageForm .composer-box>.row.spread');
    if (row && !row.querySelector('.ca-composer-hint')) {
      const hint = document.createElement('span');hint.className = 'ca-composer-hint';hint.textContent = '⌘/Ctrl + Enter to send';
      row.insertBefore(hint, row.querySelector('#sendBtn'));
    }
  }

  function enhanceEmptyStates() {
    document.querySelectorAll('.empty').forEach(node => {
      if (node.dataset.caEnhanced === '1') return;
      node.dataset.caEnhanced = '1';
      const text = node.textContent.trim();
      if (!text) return;
      const wrapper = document.createElement('div');
      const icon = document.createElement('div');icon.textContent = '✦';icon.style.cssText = 'font-size:22px;margin-bottom:7px;opacity:.58';
      const copy = document.createElement('div');copy.textContent = text;wrapper.append(icon, copy);node.replaceChildren(wrapper);
    });
  }

  function enhanceUi() {
    document.body.classList.add('ca-modern');
    if (sessionStorage.getItem(FOCUS_KEY) === '1') document.body.classList.add('ca-focus');
    ensureThemeButton();ensureFocusButton();enhanceComposer();enhanceEmptyStates();applyTheme(preferredTheme());
  }

  function scheduleEnhancement() {
    if (enhancementScheduled) return;
    enhancementScheduled = true;
    requestAnimationFrame(() => { enhancementScheduled = false;enhanceUi(); });
  }

  document.addEventListener('keydown', event => {
    const target = event.target;
    const typing = target && (target.matches('input,textarea,select') || target.isContentEditable);
    if (event.key === 'Escape' && document.body.classList.contains('ca-focus')) {
      document.body.classList.remove('ca-focus');sessionStorage.setItem(FOCUS_KEY, '0');
      const button = document.getElementById('caFocusToggle');if (button && button.textContent !== 'Focus') button.textContent = 'Focus';
    }
    if (!typing && event.key === '/') { event.preventDefault();document.getElementById('messageInput')?.focus(); }
  });

  new MutationObserver(scheduleEnhancement).observe(document.documentElement, { childList:true, subtree:true });
  enhanceUi();
})();
</script>`;
