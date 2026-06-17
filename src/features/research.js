import { streamCloudflare } from '../ai/cloudflare.js';
import { streamOpenAI } from '../ai/openai.js';
import { chatMessages, researchMessages } from '../ai/prompts.js';
import { getRecord, getSettings, putRecord } from './kv.js';
import { cleanText, httpError, readJson } from '../utils.js';

const slug = value => cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,50) || 'research';
async function model(env, preference, payload) { const selected = preference || (await getSettings(env)).model; return selected === 'gpt55' ? streamOpenAI(env,payload) : streamCloudflare(env,payload); }
export function sseResponse({ meta, source, onDone }) {
  const encoder = new TextEncoder(), decoder = new TextDecoder();
  const stream = new ReadableStream({ async start(controller) { let full=''; const send=(event,data)=>controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)); send('meta',meta); const reader=source.getReader(); try { while(true){const{value,done}=await reader.read();if(done)break;const delta=decoder.decode(value,{stream:true});if(!delta)continue;full+=delta;send('delta',{delta});} const saved=await onDone(full);send('done',{id:saved?.id||meta.id,saved:Boolean(saved)});controller.close();} catch(error){send('error',{error:error?.message||'The AI stream ended unexpectedly.'});controller.close();} }, cancel(reason){source.cancel(reason).catch(()=>{});} });
  return new Response(stream,{headers:{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform',Connection:'keep-alive'}});
}
export async function handleResearch(request, env) {
  const body=await readJson(request), query=cleanText(body.query); if(query.length<3)throw httpError(400,'Enter a research topic or question.'); if(query.length>12000)throw httpError(413,'The request is too long.');
  const settings=await getSettings(env), mode=['quick','deep','competitor','trend','scripts','hooks','calendar'].includes(body.mode)?body.mode:settings.default_research_mode, id=`${Date.now()}-${slug(query)}`;
  const selected=await model(env,body.model||settings.model,{messages:researchMessages({mode,query,context:cleanText(body.context).slice(0,12000),history:Array.isArray(body.history)?body.history:[],responseLength:body.response_length||settings.response_length}),fast:mode==='quick'||mode==='hooks',maxTokens:mode==='quick'||mode==='hooks'?3000:7000});
  return sseResponse({meta:{id,mode,query,model:selected.model,provider:selected.provider},source:selected.stream,onDone:content=>putRecord(env,'research',{id,type:mode,mode,title:query.slice(0,120),query,content,model:selected.model,provider:selected.provider,conversation:[{role:'user',content:query},{role:'assistant',content}]})});
}
export async function handleResearchChat(request, env) {
  const body=await readJson(request), question=cleanText(body.question); if(question.length<2)throw httpError(400,'Enter a follow-up question.'); let context=cleanText(body.context).slice(0,50000), record=null, type=body.session_type==='instagram'?'instagram':'research';
  if(body.session_id){record=await getRecord(env,type,String(body.session_id));if(!record)throw httpError(404,'The selected session was not found.');context=JSON.stringify({title:record.title||record.query,content:record.content||record.report,metrics:record.metrics||null}).slice(0,50000);} if(!context)throw httpError(400,'No context was supplied.');
  const settings=await getSettings(env), selected=await model(env,body.model||settings.model,{messages:chatMessages({question,context,history:Array.isArray(body.history)?body.history:[]}),maxTokens:4500});
  return sseResponse({meta:{id:`${Date.now()}-follow-up`,session_id:body.session_id||null,model:selected.model,provider:selected.provider},source:selected.stream,onDone:async content=>{if(!record)return{id:`${Date.now()}-follow-up`};record.conversation=[...(record.conversation||[]),{role:'user',content:question},{role:'assistant',content}].slice(-30);return putRecord(env,type,record);}});
}
