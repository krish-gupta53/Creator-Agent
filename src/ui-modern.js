export const MODERN_UI = String.raw`
<style>
  :root{
    --bg:#f7f6f2;
    --surface:#ffffff;
    --surface2:#f1f0eb;
    --surface3:#e9e7e0;
    --panel:#fbfaf7;
    --ink:#1f1f1d;
    --ink2:#4d4c48;
    --muted:#85827a;
    --line:#e5e2da;
    --line2:#d9d5ca;
    --accent:#d97757;
    --accent-dim:#ba5f43;
    --accent-bg:rgba(217,119,87,.08);
    --accent-bg2:rgba(217,119,87,.13);
    --blue:#4c72c7;
    --blue-bg:rgba(76,114,199,.08);
    --red:#cf4c4c;
    --red-bg:rgba(207,76,76,.08);
    --good:#2f8f61;
    --good-bg:rgba(47,143,97,.09);
    --warn:#b7791f;
    --warn-bg:rgba(183,121,31,.09);
    --shadow:0 22px 55px rgba(50,45,35,.13);
    --shadow-sm:0 8px 24px rgba(50,45,35,.08);
    --radius:18px;
    --radius-sm:13px;
    --radius-xs:9px;
    --font-display:'DM Sans',system-ui,sans-serif;
    --font-body:'DM Sans',system-ui,sans-serif;
    --rail:#20211f;
    --rail-ink:#f4f2ec;
    --rail-muted:#aaa79e;
    --composer-shadow:0 14px 40px rgba(54,48,38,.13);
  }
  body.ca-dark{
    --bg:#181817;
    --surface:#222220;
    --surface2:#2a2a27;
    --surface3:#33322f;
    --panel:#252522;
    --ink:#f2f0e9;
    --ink2:#c6c2b8;
    --muted:#928f87;
    --line:#34332f;
    --line2:#45433e;
    --accent:#e08a69;
    --accent-dim:#c96f50;
    --accent-bg:rgba(224,138,105,.09);
    --accent-bg2:rgba(224,138,105,.15);
    --blue:#83a5e8;
    --blue-bg:rgba(131,165,232,.1);
    --red:#f07b76;
    --red-bg:rgba(240,123,118,.1);
    --good:#72ca9d;
    --good-bg:rgba(114,202,157,.1);
    --warn:#e1b663;
    --warn-bg:rgba(225,182,99,.1);
    --shadow:0 24px 60px rgba(0,0,0,.34);
    --shadow-sm:0 8px 25px rgba(0,0,0,.22);
    --rail:#111210;
    --rail-ink:#f4f2ec;
    --rail-muted:#96948c;
    --composer-shadow:0 16px 46px rgba(0,0,0,.3);
  }
  html{background:var(--bg);scroll-behavior:smooth}
  body.ca-modern{background:var(--bg);color:var(--ink);letter-spacing:-.005em}
  body.ca-modern::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:-1;background:radial-gradient(circle at 72% -10%,rgba(217,119,87,.1),transparent 32%),radial-gradient(circle at 30% 105%,rgba(76,114,199,.06),transparent 28%)}
  body.ca-modern *{scrollbar-width:thin;scrollbar-color:var(--line2) transparent}
  body.ca-modern *::-webkit-scrollbar{width:7px;height:7px}
  body.ca-modern *::-webkit-scrollbar-thumb{background:var(--line2);border-radius:99px;border:2px solid transparent;background-clip:padding-box}
  body.ca-modern h1,body.ca-modern h2,body.ca-modern h3{font-family:var(--font-display);letter-spacing:-.035em}
  body.ca-modern h2{font-size:21px} body.ca-modern h3{font-size:15px}

  /* App shell */
  body.ca-modern .app{grid-template-columns:236px minmax(0,1fr);background:var(--bg)}
  body.ca-modern .rail{padding:14px 10px;background:var(--rail);border-right:0;box-shadow:inset -1px 0 rgba(255,255,255,.045);z-index:8}
  body.ca-modern .rail-brand{padding:8px 10px 22px;gap:11px}
  body.ca-modern .rail-brand .brand-mark{width:34px!important;height:34px!important;border-radius:11px!important;background:linear-gradient(145deg,#ef9b78,#d5684a);color:#fff;box-shadow:0 8px 24px rgba(217,119,87,.24);font-size:12px!important}
  body.ca-modern .rail-brand-text strong{font-size:14px;color:var(--rail-ink);letter-spacing:-.02em}
  body.ca-modern .rail-brand-text .tiny{color:var(--rail-muted);font-size:10px}
  body.ca-modern .nav{gap:3px}
  body.ca-modern .nav button{position:relative;padding:10px 11px;border-radius:10px;color:var(--rail-muted);font-size:13px;gap:10px;transition:background .16s,color .16s,transform .16s}
  body.ca-modern .nav button:hover{background:rgba(255,255,255,.07);color:var(--rail-ink);transform:translateX(2px)}
  body.ca-modern .nav button.active{background:rgba(255,255,255,.1);color:var(--rail-ink);box-shadow:inset 0 0 0 1px rgba(255,255,255,.055)}
  body.ca-modern .nav button.active::before{content:'';position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:99px;background:#ef9b78}
  body.ca-modern .nav-icon{font-size:15px!important;opacity:.82!important}
  body.ca-modern .rail-bottom{border-top:1px solid rgba(255,255,255,.08);padding:12px 3px 0}
  body.ca-modern .rail-bottom .btn{background:transparent!important;border-color:rgba(255,255,255,.1)!important;color:var(--rail-muted)!important}
  body.ca-modern .rail-bottom .btn:hover{background:rgba(255,255,255,.07)!important;color:var(--rail-ink)!important}
  body.ca-modern .main{padding:18px 22px 30px;background:transparent}
  body.ca-modern .topbar{max-width:1720px;margin:0 auto 14px;min-height:44px;align-items:center}
  body.ca-modern .eyebrow{display:none}
  body.ca-modern .page-title{font-size:22px;font-weight:650;color:var(--ink);letter-spacing:-.04em}
  body.ca-modern .view{max-width:1720px}

  /* Buttons, fields and common surfaces */
  body.ca-modern .btn{border-radius:11px;padding:9px 15px;background:var(--ink);color:var(--surface);font-weight:600;font-size:13px;box-shadow:none;transition:transform .16s,box-shadow .16s,background .16s,border-color .16s,color .16s}
  body.ca-modern .btn:hover{filter:none;transform:translateY(-1px);box-shadow:0 7px 18px rgba(30,29,26,.13)}
  body.ca-modern .btn.secondary{background:var(--surface);color:var(--ink2);border:1px solid var(--line);box-shadow:0 1px 2px rgba(30,29,26,.025)}
  body.ca-modern .btn.secondary:hover{background:var(--surface2);color:var(--ink);border-color:var(--line2)}
  body.ca-modern .btn.ghost{background:transparent;color:var(--muted);border:1px solid transparent}
  body.ca-modern .btn.ghost:hover{background:var(--surface2);color:var(--ink);box-shadow:none;transform:none}
  body.ca-modern .btn.danger{background:var(--red-bg);color:var(--red);border-color:rgba(207,76,76,.16)}
  body.ca-modern .btn.small{font-size:11px;padding:6px 10px;border-radius:9px}
  body.ca-modern .input,body.ca-modern .textarea,body.ca-modern .select{background:var(--surface);border:1px solid var(--line);border-radius:12px;color:var(--ink);padding:11px 13px;box-shadow:0 1px 2px rgba(30,29,26,.025)}
  body.ca-modern .input:focus,body.ca-modern .textarea:focus,body.ca-modern .select:focus{border-color:rgba(217,119,87,.55);box-shadow:0 0 0 4px var(--accent-bg)}
  body.ca-modern .field label{font-size:10px;letter-spacing:.08em;color:var(--muted)}
  body.ca-modern .card{background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 1px 2px rgba(40,36,29,.02);padding:20px}
  body.ca-modern .subtle{background:var(--panel)}
  body.ca-modern .badge{background:var(--surface2);border-color:var(--line);color:var(--muted);padding:4px 9px;font-size:10px}
  body.ca-modern .badge.accent{background:var(--accent-bg2);border-color:rgba(217,119,87,.18);color:var(--accent-dim)}
  body.ca-modern .badge.good{background:var(--good-bg);border-color:rgba(47,143,97,.18);color:var(--good)}
  body.ca-modern .badge.warn{background:var(--warn-bg);border-color:rgba(183,121,31,.18);color:var(--warn)}
  body.ca-modern .divider{background:var(--line)}
  body.ca-modern .empty{min-height:150px;display:grid;place-items:center;border:1px dashed var(--line2);border-radius:14px;background:linear-gradient(145deg,var(--panel),var(--surface));color:var(--muted)}

  /* Conversation workspace */
  body.ca-modern .create-grid{grid-template-columns:232px minmax(520px,1fr) 270px;gap:12px;min-height:calc(100vh - 78px)}
  body.ca-modern .create-grid>.card:first-child,body.ca-modern .decision-panel{padding:13px;background:var(--panel)}
  body.ca-modern .conversation-list{height:calc(100vh - 164px);margin-top:9px;gap:3px;padding-right:3px}
  body.ca-modern .conversation-item{padding:10px 11px;border-radius:11px;border:1px solid transparent;transition:background .15s,border-color .15s,transform .15s}
  body.ca-modern .conversation-item:hover{background:var(--surface);border-color:var(--line);transform:translateX(1px)}
  body.ca-modern .conversation-item.active{background:var(--surface);border-color:var(--line2);box-shadow:var(--shadow-sm)}
  body.ca-modern .conversation-item.active::before{content:'';position:absolute;width:3px;height:24px;margin-left:-12px;border-radius:99px;background:var(--accent)}
  body.ca-modern .conversation-item strong{font-size:12px;font-weight:600;color:var(--ink)}
  body.ca-modern .conversation-meta{gap:5px;margin-top:5px}
  body.ca-modern .stage-badge{background:var(--surface2);border-color:var(--line);font-size:9px;padding:2px 6px}
  body.ca-modern .package-jump{color:var(--accent);filter:saturate(.75)}
  body.ca-modern .chat-card{height:calc(100vh - 78px);min-height:700px;border-radius:20px;box-shadow:var(--shadow-sm);background:var(--surface);border-color:var(--line);overflow:hidden}
  body.ca-modern .chat-head{padding:13px 18px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.76);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);z-index:3}
  body.ca-dark .chat-head{background:rgba(34,34,32,.78)}
  body.ca-modern .chat-head strong{font-size:14px;color:var(--ink);font-weight:650}
  body.ca-modern .model-mode-indicator{background:var(--accent-bg);border-color:rgba(217,119,87,.2);color:var(--accent-dim);font-size:9px;padding:2px 7px}
  body.ca-modern .plan-progress{margin-top:9px;padding-top:8px;border-color:var(--line)}
  body.ca-modern .progress-shell{height:5px;background:var(--surface3)}
  body.ca-modern .progress-bar{background:linear-gradient(90deg,var(--accent),#e6a36e)}
  body.ca-modern .messages{padding:28px max(28px,6vw) 34px;gap:24px;background:var(--surface);scroll-behavior:smooth}
  body.ca-modern .message{position:relative;max-width:min(760px,88%);border-radius:0;padding:0 0 0 39px;font-size:15px;line-height:1.72;background:transparent!important;border:0!important;color:var(--ink)!important;font-weight:400!important;box-shadow:none!important}
  body.ca-modern .message::before{position:absolute;left:0;top:0;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;font-size:10px;font-weight:750;letter-spacing:-.03em}
  body.ca-modern .message.assistant{justify-self:start;width:min(760px,90%)}
  body.ca-modern .message.assistant::before{content:'CA';background:linear-gradient(145deg,#ef9b78,#d5684a);color:#fff;box-shadow:0 5px 14px rgba(217,119,87,.22)}
  body.ca-modern .message.user{justify-self:end;width:auto;max-width:min(650px,82%);padding:12px 16px;border-radius:17px!important;background:var(--surface2)!important;color:var(--ink)!important}
  body.ca-modern .message.user::before{display:none}
  body.ca-modern .message .meta{font-size:10px;color:var(--muted);opacity:1;margin-top:8px}
  body.ca-modern .message.assistant .meta{opacity:.68}
  body.ca-modern .attachment-chip{background:var(--surface2)!important;color:var(--ink2)!important;border:1px solid var(--line);border-radius:9px;padding:5px 8px;margin:8px 4px 0 0}
  body.ca-modern .options,body.ca-modern .decision-chips{gap:7px;margin-top:14px}
  body.ca-modern .option,body.ca-modern .decision-chip{border:1px solid var(--line2);background:var(--surface);color:var(--ink2);border-radius:11px;padding:7px 11px;font-size:11px;box-shadow:0 2px 8px rgba(40,36,29,.035);transition:background .15s,border-color .15s,transform .15s}
  body.ca-modern .option:hover,body.ca-modern .decision-chip:hover{background:var(--accent-bg);border-color:rgba(217,119,87,.3);color:var(--accent-dim);transform:translateY(-1px)}
  body.ca-modern .composer{padding:10px max(18px,5vw) 16px;border:0;background:linear-gradient(180deg,rgba(255,255,255,0),var(--surface) 22%)}
  body.ca-dark .composer{background:linear-gradient(180deg,rgba(34,34,32,0),var(--surface) 22%)}
  body.ca-modern .composer-box{position:relative;padding:11px 12px 10px;border:1px solid var(--line2);border-radius:20px;background:var(--surface);box-shadow:var(--composer-shadow);transition:border-color .18s,box-shadow .18s,transform .18s}
  body.ca-modern .composer-box:focus-within{border-color:rgba(217,119,87,.45);box-shadow:0 16px 46px rgba(54,48,38,.16),0 0 0 3px var(--accent-bg);transform:translateY(-1px)}
  body.ca-modern .composer textarea{min-height:54px;max-height:210px;padding:4px 3px;font-size:14px;line-height:1.55;color:var(--ink)}
  body.ca-modern .composer .row.spread{margin-top:7px!important}
  body.ca-modern .generation-controls{grid-template-columns:minmax(150px,1.35fr) repeat(3,minmax(108px,1fr));gap:6px;margin-bottom:9px;padding:0;border:0;background:transparent}
  body.ca-modern .generation-control{min-height:34px;padding:6px 9px;border-color:var(--line);border-radius:10px;background:var(--panel);color:var(--muted)}
  body.ca-modern .generation-control strong{font-size:10px;font-weight:650;color:var(--ink2)}
  body.ca-modern .generation-control select{font-size:10px;color:var(--ink2)}
  body.ca-modern .generation-control input{appearance:none;width:28px;height:16px;border-radius:99px;background:var(--surface3);position:relative;transition:background .18s;cursor:pointer}
  body.ca-modern .generation-control input::after{content:'';position:absolute;width:12px;height:12px;left:2px;top:2px;border-radius:50%;background:var(--surface);box-shadow:0 1px 4px rgba(0,0,0,.18);transition:transform .18s}
  body.ca-modern .generation-control input:checked{background:var(--accent)}
  body.ca-modern .generation-control input:checked::after{transform:translateX(12px)}
  body.ca-modern .control-help{display:none}
  body.ca-modern .decision-panel{height:calc(100vh - 78px)}
  body.ca-modern .decision-row{padding:8px 1px;border-color:var(--line)}
  body.ca-modern .decision-row span{font-size:9px;letter-spacing:.07em;color:var(--muted)}
  body.ca-modern .decision-row strong{font-size:12px;line-height:1.45;color:var(--ink2)}
  body.ca-modern .notice{background:var(--warn-bg);border-color:rgba(183,121,31,.18);color:var(--warn);border-radius:12px}

  /* Non-chat views */
  body.ca-modern .grid2,body.ca-modern .grid3{gap:13px}
  body.ca-modern .list{gap:8px}
  body.ca-modern .list-item{background:var(--panel);border-color:var(--line);border-radius:13px;padding:14px;transition:border-color .15s,transform .15s,box-shadow .15s}
  body.ca-modern .list-item:hover{border-color:var(--line2);box-shadow:var(--shadow-sm);transform:translateY(-1px)}
  body.ca-modern .package-layout{grid-template-columns:245px minmax(0,1fr);gap:13px}
  body.ca-modern .package-version{border-radius:11px;padding:11px}
  body.ca-modern .package-version:hover{background:var(--surface2)}
  body.ca-modern .package-version.active{background:var(--accent-bg);border-color:rgba(217,119,87,.22)}
  body.ca-modern .tabs{padding:4px;border-radius:12px;background:var(--surface2);border-color:var(--line);gap:3px}
  body.ca-modern .tabs button{border-radius:9px;color:var(--muted);padding:8px 13px}
  body.ca-modern .tabs button.active{background:var(--surface);color:var(--ink);box-shadow:0 2px 9px rgba(40,36,29,.07)}
  body.ca-modern .script{background:var(--panel);border-color:var(--line);border-radius:15px;padding:22px;font-size:15px;line-height:1.85;color:var(--ink2)}
  body.ca-modern .shot{border-color:var(--line)}
  body.ca-modern .shot strong{color:var(--accent);font-family:var(--font-body)}
  body.ca-modern .metric{background:linear-gradient(145deg,var(--surface),var(--panel));border-color:var(--line);border-radius:15px;box-shadow:0 3px 12px rgba(40,36,29,.035)}
  body.ca-modern .metric strong{font-size:27px;color:var(--ink)}
  body.ca-modern .code{background:#20211f;color:#e8e4db;border-color:#33342f;border-radius:12px;padding:14px}
  body.ca-modern .beat-timeline{border-color:var(--line);background:var(--panel);border-radius:12px}
  body.ca-modern .compare-card,body.ca-modern .quality-panel{background:var(--panel);border-color:var(--line)}
  body.ca-modern .asset-gallery img{border-radius:14px;border-color:var(--line);box-shadow:var(--shadow-sm)}

  /* Overlay surfaces */
  body.ca-modern .toast{right:22px;bottom:22px;background:var(--ink);color:var(--surface);border:0;border-radius:14px;padding:12px 15px;box-shadow:var(--shadow);font-size:13px}
  body.ca-modern .modal-backdrop{background:rgba(31,30,27,.44);backdrop-filter:blur(10px)}
  body.ca-modern .modal{background:var(--surface);border-color:var(--line);border-radius:22px;padding:26px;box-shadow:var(--shadow)}
  body.ca-modern #statusDot{background:var(--surface);border-color:var(--line);box-shadow:0 2px 8px rgba(40,36,29,.035)}
  body.ca-modern #statusDot::before{box-shadow:none}

  /* Login */
  body.ca-modern .login{background:var(--bg);background-image:radial-gradient(circle at 65% 10%,rgba(217,119,87,.16),transparent 33%),radial-gradient(circle at 15% 90%,rgba(76,114,199,.09),transparent 28%)}
  body.ca-modern .login-card{width:min(430px,100%);background:rgba(255,255,255,.84);border-color:rgba(255,255,255,.75);border-radius:28px;padding:44px;box-shadow:0 35px 90px rgba(62,53,40,.18);backdrop-filter:blur(20px)}
  body.ca-dark .login-card{background:rgba(34,34,32,.88);border-color:rgba(255,255,255,.08)}
  body.ca-modern .login-card::before{height:0}
  body.ca-modern .login .brand-mark{background:linear-gradient(145deg,#ef9b78,#d5684a);color:#fff;border-radius:16px;box-shadow:0 14px 34px rgba(217,119,87,.25)}
  body.ca-modern .login h1{font-size:29px;color:var(--ink)}

  /* Added utility controls */
  .ca-shell-action{width:34px;height:34px;padding:0!important;display:grid!important;place-items:center;border-radius:10px!important;font-size:15px!important}
  .ca-focus-button{margin-left:2px}
  body.ca-focus .create-grid{grid-template-columns:minmax(0,1fr);max-width:1120px;margin:0 auto}
  body.ca-focus .create-grid>.card:first-child,body.ca-focus .decision-panel{display:none}
  body.ca-focus .chat-card{height:calc(100vh - 78px)}
  .ca-composer-hint{font-size:9px;color:var(--muted);margin-left:auto;white-space:nowrap}

  @media(max-width:1280px) and (min-width:981px){
    body.ca-modern .app{grid-template-columns:205px minmax(0,1fr)}
    body.ca-modern .create-grid{grid-template-columns:205px minmax(480px,1fr) 235px}
    body.ca-modern .messages{padding-left:38px;padding-right:38px}
    body.ca-modern .generation-controls{grid-template-columns:1.25fr 1fr 1fr 1fr}
  }
  @media(max-width:980px) and (min-width:781px){
    body.ca-modern .app{grid-template-columns:74px minmax(0,1fr)}
    body.ca-modern .rail{padding:12px 8px}
    body.ca-modern .rail-brand{justify-content:center;padding:6px 0 22px}
    body.ca-modern .rail-brand-text,body.ca-modern .nav button:not(.active){font-size:0}
    body.ca-modern .nav button{justify-content:center;padding:11px}
    body.ca-modern .nav-icon{font-size:17px!important}
    body.ca-modern .rail-bottom .btn{font-size:0!important;padding:10px!important}
    body.ca-modern .rail-bottom .btn::after{content:'↪';font-size:15px}
    body.ca-modern .create-grid{grid-template-columns:210px minmax(0,1fr)}
    body.ca-modern .decision-panel{display:none}
    body.ca-modern .generation-controls{grid-template-columns:1.35fr repeat(3,1fr)}
  }
  @media(max-width:780px){
    body.ca-modern .app{display:block}
    body.ca-modern .rail{position:sticky;top:0;height:auto;display:flex;flex-direction:row;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.08)}
    body.ca-modern .rail-brand{padding:0 8px 0 0}.rail-brand-text{display:none}
    body.ca-modern .nav{display:flex;flex:1;overflow:auto;justify-content:flex-start}
    body.ca-modern .nav button{font-size:0;padding:9px 11px;justify-content:center;min-width:40px}
    body.ca-modern .nav-icon{font-size:16px!important}
    body.ca-modern .rail-bottom{border:0;padding:0;margin:0}.rail-bottom .btn{font-size:0!important;width:38px!important;padding:9px!important}.rail-bottom .btn::after{content:'↪';font-size:15px}
    body.ca-modern .main{padding:11px}
    body.ca-modern .topbar{margin-bottom:9px}
    body.ca-modern .page-title{font-size:19px}
    body.ca-modern .create-grid{grid-template-columns:1fr;gap:9px}
    body.ca-modern .create-grid>.card:first-child{display:none}
    body.ca-modern .chat-card{height:calc(100vh - 116px);min-height:620px;border-radius:16px}
    body.ca-modern .chat-head{padding:10px 12px}
    body.ca-modern .messages{padding:22px 15px 28px;gap:21px}
    body.ca-modern .message{max-width:96%;font-size:14px;padding-left:36px}
    body.ca-modern .message.user{max-width:90%;padding:10px 13px}
    body.ca-modern .composer{padding:8px 8px 11px}
    body.ca-modern .composer-box{border-radius:17px;padding:9px}
    body.ca-modern .generation-controls{grid-template-columns:1fr 1fr;gap:5px}
    body.ca-modern .generation-control{min-height:32px}
    body.ca-modern .decision-panel{height:auto}
    body.ca-modern .package-layout,body.ca-modern .grid2,body.ca-modern .grid3{grid-template-columns:1fr}
    body.ca-modern .ca-composer-hint{display:none}
  }
  @media(max-width:480px){
    body.ca-modern .generation-controls{display:flex;overflow-x:auto;padding-bottom:2px}
    body.ca-modern .generation-control{min-width:135px;flex:0 0 auto}
    body.ca-modern .generation-control:first-child{min-width:170px}
    body.ca-modern .chat-head .btn.ghost{display:none}
    body.ca-modern .message.assistant{width:100%}
  }
</style>
<script>
(() => {
  const THEME_KEY = 'creator-agent-theme';
  const FOCUS_KEY = 'creator-agent-focus';

  function preferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.body.classList.add('ca-modern');
    document.body.classList.toggle('ca-dark', theme === 'dark');
    const button = document.getElementById('caThemeToggle');
    if (button) {
      button.textContent = theme === 'dark' ? '☀' : '☾';
      button.title = theme === 'dark' ? 'Use light theme' : 'Use dark theme';
      button.setAttribute('aria-label', button.title);
    }
  }

  function ensureThemeButton() {
    const actions = document.querySelector('.topbar>.row');
    if (!actions || document.getElementById('caThemeToggle')) return;
    const button = document.createElement('button');
    button.id = 'caThemeToggle';
    button.type = 'button';
    button.className = 'btn secondary small ca-shell-action';
    button.addEventListener('click', () => {
      const next = document.body.classList.contains('ca-dark') ? 'light' : 'dark';
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
    actions.insertBefore(button, actions.firstChild);
    applyTheme(preferredTheme());
  }

  function ensureFocusButton() {
    const headerActions = document.querySelector('.chat-head .row.spread>.row:last-child');
    if (!headerActions || document.getElementById('caFocusToggle')) return;
    const button = document.createElement('button');
    button.id = 'caFocusToggle';
    button.type = 'button';
    button.className = 'btn ghost small ca-focus-button';
    button.textContent = document.body.classList.contains('ca-focus') ? 'Exit focus' : 'Focus';
    button.title = 'Toggle distraction-free conversation view';
    button.addEventListener('click', () => {
      const enabled = !document.body.classList.contains('ca-focus');
      document.body.classList.toggle('ca-focus', enabled);
      sessionStorage.setItem(FOCUS_KEY, enabled ? '1' : '0');
      button.textContent = enabled ? 'Exit focus' : 'Focus';
    });
    headerActions.insertBefore(button, headerActions.firstChild);
  }

  function enhanceComposer() {
    const textarea = document.getElementById('messageInput');
    const composerActions = document.querySelector('#messageForm .composer-box>.row.spread');
    if (!textarea || textarea.dataset.caEnhanced) return;
    textarea.dataset.caEnhanced = '1';
    const resize = () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(210, Math.max(54, textarea.scrollHeight)) + 'px';
    };
    textarea.addEventListener('input', resize);
    textarea.addEventListener('keydown', event => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        document.getElementById('messageForm')?.requestSubmit();
      }
    });
    resize();
    if (composerActions && !composerActions.querySelector('.ca-composer-hint')) {
      const hint = document.createElement('span');
      hint.className = 'ca-composer-hint';
      hint.textContent = '⌘/Ctrl + Enter to send';
      const send = composerActions.querySelector('#sendBtn');
      composerActions.insertBefore(hint, send || null);
    }
  }

  function enhanceEmptyStates() {
    document.querySelectorAll('.empty').forEach(node => {
      if (node.dataset.caEnhanced) return;
      node.dataset.caEnhanced = '1';
      const text = node.textContent.trim();
      if (!text) return;
      node.innerHTML = '<div><div style="font-size:22px;margin-bottom:7px;opacity:.58">✦</div><div>' + text.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])) + '</div></div>';
    });
  }

  function enhanceUi() {
    document.body.classList.add('ca-modern');
    applyTheme(preferredTheme());
    if (sessionStorage.getItem(FOCUS_KEY) === '1') document.body.classList.add('ca-focus');
    ensureThemeButton();
    ensureFocusButton();
    enhanceComposer();
    enhanceEmptyStates();
  }

  document.addEventListener('keydown', event => {
    const target = event.target;
    const typing = target && (target.matches('input,textarea,select') || target.isContentEditable);
    if (event.key === 'Escape' && document.body.classList.contains('ca-focus')) {
      document.body.classList.remove('ca-focus');
      sessionStorage.setItem(FOCUS_KEY, '0');
      const button = document.getElementById('caFocusToggle');
      if (button) button.textContent = 'Focus';
    }
    if (!typing && event.key === '/') {
      event.preventDefault();
      document.getElementById('messageInput')?.focus();
    }
  });

  new MutationObserver(enhanceUi).observe(document.documentElement, { childList: true, subtree: true });
  enhanceUi();
})();
</script>`;
