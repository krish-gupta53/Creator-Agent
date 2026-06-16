export const WORKSPACE_SCRIPT_H = String.raw`
function renderLibrary(){clear(root);document.getElementById('rTitle').textContent='Library';root.append(el('h1','','Report library'));var panel=el('div','panel');(state.boot.runs||[]).forEach(function(run){var row=el('div','run');row.append(el('strong','',run.title));row.append(el('small','',run.kind+' · '+run.status));row.onclick=function(){openProject(run.conversation_id,run.id)};panel.append(row)});root.append(panel)}
`;
