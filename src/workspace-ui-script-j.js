export const WORKSPACE_SCRIPT_J = String.raw`
function pollRun(){clearInterval(state.timer);if(!state.run||!['queued','running'].includes(state.run.status))return;state.timer=setInterval(function(){requestJson('/api/workspace/runs/'+encodeURIComponent(state.run.id)).then(function(data){state.run=data.run;var index=state.project.runs.findIndex(function(item){return item.id===data.run.id});if(index>=0)state.project.runs[index]=data.run;renderCurrent();if(!['queued','running'].includes(data.run.status))showToast(data.run.status==='completed'?'Report ready.':'Run failed.')})},4000)}
document.getElementById('rNew').onclick=function(){state.project=null;state.run=null;state.view='home';renderCurrent()};
Array.from(document.querySelectorAll('[data-view]')).forEach(function(button){button.onclick=function(){state.view=button.dataset.view;state.kind=state.view==='insights'?'insight':'research';state.project=null;state.run=null;renderCurrent()}});
document.getElementById('rMobile').onclick=function(){state.project=null;state.run=null;state.view='home';renderCurrent()};
document.getElementById('rLogout').onclick=function(){fetch('/api/auth/logout',{method:'POST'}).then(function(){location.reload()})};
requestJson('/api/auth/status').then(function(auth){if(auth.authenticated){document.body.classList.add('rw-active');load()}});
})();
`;
