export const WORKSPACE_SCRIPT_C = String.raw`
var state={boot:null,view:'home',kind:'research',mode:'deep_research',model:'',project:null,run:null,files:[],urls:[],timer:null};
var root=document.getElementById('rContent');
function requestJson(path,options){return fetch(path,options||{}).then(function(response){return response.json().then(function(data){if(!response.ok)throw new Error(data.error||'Request failed');return data})})}
`;
