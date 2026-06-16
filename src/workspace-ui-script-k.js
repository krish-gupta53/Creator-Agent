export const WORKSPACE_SCRIPT_K = String.raw`
var baseReportRenderer=renderReport;
renderReport=function(){baseReportRenderer();var run=state.run,actions=document.getElementById('rActions');clear(actions);actions.append(makeButton('Back',function(){state.run=null;renderProject()}));actions.append(makeButton('Markdown',function(){location.href='/api/workspace/runs/'+encodeURIComponent(run.id)+'/export?format=md'}));actions.append(makeButton('Print / PDF',function(){window.open('/api/workspace/runs/'+encodeURIComponent(run.id)+'/export','_blank')},true))};
`;
