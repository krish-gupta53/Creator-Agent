export const WORKSPACE_SCRIPT_D = String.raw`
function clear(node){while(node.firstChild)node.removeChild(node.firstChild)}
function el(tag,className,text){var node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node}
function showToast(text){var node=document.getElementById('rToast');node.textContent=text;node.hidden=false;setTimeout(function(){node.hidden=true},3000)}
function loadWorkspace(){return requestJson('/api/workspace/bootstrap').then(function(data){state.boot=data;renderProjectList();renderCurrent()}).catch(function(error){showToast(error.message)})}
function renderProjectList(){var host=document.getElementById('rProjects');clear(host);(state.boot.projects||[]).forEach(function(project){var button=el('button','rproject');button.dataset.project=project.id;button.append(el('strong','',project.title));button.append(el('small','',project.source_count+' sources · '+project.run_count+' reports'));button.onclick=function(){openProject(project.id)};host.append(button)})}
`;
