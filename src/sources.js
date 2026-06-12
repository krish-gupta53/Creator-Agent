import { Buffer } from 'node:buffer';
import { extractText, getDocumentProxy } from 'unpdf';
import { getModels } from './config.js';
import { embedTexts, rerank, runModel, runText } from './ai.js';
import {
  deleteAttachmentRecord, fallbackRelevantChunks, getAttachment, getChunksByIds, insertAttachment,
  listAttachments, listChunksByAttachment, replaceChunks, updateAttachment,
} from './db.js';
import {
  charTokenEstimate, cleanText, extensionFromMime, httpError, id, intEnv, normalizeText, nowIso,
  safeFilename, sha256Hex,
} from './utils.js';

// 5.2 — Validate that raw bytes match the declared MIME type.
// Catches cases where a browser sends a misleading Content-Type header.
function validateMagicBytes(bytes, declaredType) {
  if (!bytes || bytes.length < 8) return;
  const b = bytes;
  // Reject executable formats unconditionally.
  const isWinExe = b[0] === 0x4D && b[1] === 0x5A; // MZ (Windows PE)
  const isElf = b[0] === 0x7F && b[1] === 0x45 && b[2] === 0x4C && b[3] === 0x46; // ELF
  if (isWinExe || isElf) throw httpError(415, 'Executable files are not allowed.');
  // For declared image types verify at least one known image magic matches.
  if (declaredType.startsWith('image/')) {
    const isJpeg = b[0] === 0xFF && b[1] === 0xD8;
    const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
    const isGif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
    // RIFF….WEBP
    const isWebp = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
    if (!isJpeg && !isPng && !isGif && !isWebp) throw httpError(415, `File content does not match declared image type (${declaredType}).`);
  }
  // For PDFs verify the %PDF signature.
  if (declaredType === 'application/pdf') {
    const isPdf = b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF
    if (!isPdf) throw httpError(415, 'File content does not match declared type application/pdf.');
  }
}

const ACCEPTED_TYPES = new Set([
  'application/pdf', 'text/plain', 'text/markdown', 'text/html', 'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel', 'application/xml', 'text/xml',
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/webm',
  'video/mp4', 'video/webm',
]);

export async function parseMessageRequest(request) {
  const contentType = request.headers.get('Content-Type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const text = String(form.get('message') || '');
    const files = form.getAll('files').filter(value => typeof value === 'object' && typeof value.arrayBuffer === 'function' && value.size > 0);
    return { text, files };
  }
  const body = await request.json();
  return { text: String(body.message || ''), files: [] };
}

export async function processUploadedFile(env, { conversationId, messageId, file }) {
  const maxBytes = intEnv(env, 'MAX_UPLOAD_MB', 20) * 1024 * 1024;
  if (file.size > maxBytes) throw httpError(413, `${file.name} exceeds the ${intEnv(env, 'MAX_UPLOAD_MB', 20)} MB upload limit.`);
  const type = String(file.type || 'application/octet-stream').toLowerCase();
  const allowed = type.startsWith('image/') || ACCEPTED_TYPES.has(type);
  if (!allowed) throw httpError(415, `Unsupported file type: ${type}`);

  const bytes = new Uint8Array(await file.arrayBuffer());
  // 5.2 — Validate bytes match the declared Content-Type before doing anything else.
  validateMagicBytes(bytes, type);
  const name = safeFilename(file.name || `upload.${extensionFromMime(type)}`);
  const attachmentId = id('att');
  const key = `uploads/${conversationId}/${attachmentId}/${name}`;
  const checksum = await sha256Hex(bytes);
  await env.CONTENT_BUCKET.put(key, bytes, {
    httpMetadata: { contentType: type }, customMetadata: { originalName: name, conversationId, attachmentId, checksum },
  });

  let extraction;
  try {
    extraction = await extractAttachment(env, bytes, type, name, conversationId);
  } catch (error) {
    extraction = { status: 'limited', summary: `The file was stored, but automatic analysis failed: ${error.message}`, method: 'failed', pages: [], metadata: { error: error.message } };
  }

  const attachment = await insertAttachment(env, {
    id: attachmentId, conversation_id: conversationId, message_id: messageId, key, name, type, size: file.size,
    status: extraction.status || 'ready', summary: cleanText(extraction.summary).slice(0, 8000),
    extraction_method: extraction.method || '', checksum, metadata: extraction.metadata || {}, created_at: nowIso(), updated_at: nowIso(),
  });

  const chunks = await buildChunks(attachment, extraction.pages || []);
  if (chunks.length) await replaceChunks(env, attachment, chunks);
  return { ...attachment, chunks_ready: chunks.length, index_pending: chunks.length > 0, media_processing_pending: Boolean(extraction.metadata?.processor_pending), ocr_processing_pending: Boolean(extraction.metadata?.ocr_pending) };
}

async function extractAttachment(env, bytes, type, name, conversationId) {
  if (type === 'application/pdf') return extractPdf(env, bytes, name, conversationId);
  if (type.startsWith('image/')) return analyzeImage(env, bytes, type, name, conversationId);
  if (type.startsWith('audio/')) return transcribeAudio(env, bytes, type, name, conversationId);
  if (type.startsWith('video/')) return analyzeVideoPlaceholder(env, bytes, type, name);
  if (type === 'text/plain' || type === 'text/markdown' || type === 'text/html' || type === 'text/csv' || type.includes('xml')) {
    const text = cleanText(new TextDecoder().decode(bytes)).slice(0, 500000);
    return { status: text ? 'ready' : 'limited', summary: await summarizeText(env, text, `Document: ${name}`, conversationId), method: 'text_decode', pages: [{ page: 1, text }], metadata: {} };
  }
  return convertToMarkdown(env, bytes, type, name, conversationId);
}

async function extractPdf(env, bytes, name, conversationId) {
  let pages = [];
  let method = 'unpdf';
  try {
    const document = await getDocumentProxy(bytes);
    const extracted = await extractText(document, { mergePages: false });
    const rawPages = Array.isArray(extracted?.text) ? extracted.text : [extracted?.text || ''];
    pages = rawPages.map((text, index) => ({ page: index + 1, text: cleanText(text) })).filter(item => item.text);
    if (typeof document.destroy === 'function') await document.destroy();
  } catch { pages = []; }

  const total = pages.reduce((sum, page) => sum + page.text.length, 0);
  if (total < 120) {
    const converted = await convertToMarkdown(env, bytes, 'application/pdf', name, conversationId);
    method = converted.method;
    pages = converted.pages;
  }
  const combined = pages.map(page => page.text).join('\n\n').slice(0, 250000);
  if (combined.length < 80 && env.OCR_PROCESSOR_URL) {
    return { status: 'processing', summary: 'This PDF contains very little readable text. It was stored and queued for the configured OCR processor.', method: 'external_ocr_pending', pages: [], metadata: { page_count: pages.length, extracted_characters: combined.length, conversion_fallback_used: method === 'cloudflare_markdown', ocr_pending: true } };
  }
  const status = combined.length >= 80 ? 'ready' : 'limited';
  const summary = combined.length >= 80
    ? await summarizeText(env, combined, `PDF: ${name}`, conversationId)
    : 'This PDF contains very little readable text. Cloudflare Markdown Conversion was attempted, but the result still needs manual review. Configure OCR_PROCESSOR_URL for a dedicated OCR fallback.';
  return { status, summary, method, pages, metadata: { page_count: pages.length, extracted_characters: combined.length, conversion_fallback_used: method === 'cloudflare_markdown', ocr_pending: false } };
}

async function convertToMarkdown(env, bytes, type, name, conversationId) {
  if (!env.AI?.toMarkdown) throw new Error('Cloudflare Markdown Conversion is unavailable.');
  const result = await env.AI.toMarkdown({ name, blob: new Blob([bytes], { type }) });
  if (result?.format === 'error') throw new Error(result.error || 'Markdown conversion failed.');
  const data = cleanText(result?.data || '');
  return {
    status: data ? 'ready' : 'limited', summary: await summarizeText(env, data, `Converted document: ${name}`, conversationId),
    method: 'cloudflare_markdown', pages: data ? [{ page: null, text: data.slice(0, 500000) }] : [],
    metadata: { conversion_tokens: result?.tokens || null, detected_mime: result?.mimetype || type },
  };
}

async function analyzeImage(env, bytes, type, name, conversationId) {
  if (bytes.byteLength > intEnv(env, 'MAX_VISION_MB', 6) * 1024 * 1024) {
    return { status: 'limited', summary: 'Image stored, but vision analysis was skipped because it exceeds the configured vision limit.', method: 'stored_only', pages: [], metadata: {} };
  }
  const models = getModels(env);
  const dataUrl = `data:${type};base64,${Buffer.from(bytes).toString('base64')}`;
  const description = await runText(env, models.chat, [
    { role: 'system', content: 'Analyze uploaded creator references. Describe only visible details, composition, readable text, mood, people, objects, and production use. Do not identify unknown people or infer sensitive traits.' },
    { role: 'user', content: [{ type: 'text', text: `Filename: ${name}. Give a concise production-useful description and transcribe clearly visible text.` }, { type: 'image_url', image_url: { url: dataUrl } }] },
  ], { max_tokens: 900, temperature: 0.1, thinking: false }, { task: 'image_analysis', conversation_id: conversationId });
  return { status: 'ready', summary: description, method: 'vision', pages: [{ page: 1, text: description }], metadata: {} };
}

async function transcribeAudio(env, bytes, type, name, conversationId) {
  const models = getModels(env);
  const maxBytes = intEnv(env, 'MAX_ASR_MB', 20) * 1024 * 1024;
  if (bytes.byteLength > maxBytes) return { status: 'limited', summary: 'Audio stored, but transcription was skipped because it exceeds the ASR size limit.', method: 'stored_only', pages: [], metadata: {} };
  const response = await runModel(env, models.asr, { audio: Buffer.from(bytes).toString('base64'), vad_filter: true, condition_on_previous_text: true }, { task: 'audio_transcription', conversation_id: conversationId });
  const text = cleanText(response?.text || response?.transcription_info?.text || response?.result?.text || '');
  const summary = text ? await summarizeText(env, text, `Audio transcript: ${name}`, conversationId) : 'Audio was processed but no transcript was returned.';
  return { status: text ? 'ready' : 'limited', summary, method: 'whisper', pages: text ? [{ page: 1, text }] : [], metadata: { transcript: text.slice(0, 200000), word_count: response?.word_count || null, duration: response?.vtt || response?.segments ? null : response?.duration || null } };
}

async function analyzeVideoPlaceholder(env, bytes, type, name) {
  if (env.MEDIA_PROCESSOR_URL) {
    return { status: 'processing', summary: 'Video stored. External media processing is configured and will analyse it in the background.', method: 'external_media_processor', pages: [], metadata: { processor_pending: true } };
  }
  return { status: 'limited', summary: 'Video stored. Automatic frame/audio extraction requires the optional MEDIA_PROCESSOR_URL integration. You can still describe what you want the agent to use from it.', method: 'stored_only', pages: [], metadata: { media_processor_configured: false, bytes: bytes.byteLength, mime: type, name } };
}

async function summarizeText(env, text, label, conversationId) {
  if (!cleanText(text)) return 'No readable text was extracted.';
  const models = getModels(env);
  return runText(env, models.fast, [
    { role: 'system', content: 'Summarize a creator reference. Preserve key claims, names, dates, arguments, examples, explicit uncertainty, and potential production use. Do not invent facts.' },
    { role: 'user', content: `${label}\n\n${cleanText(text).slice(0, 80000)}` },
  ], { max_tokens: 1200, temperature: 0.1 }, { task: 'source_summary', conversation_id: conversationId });
}

async function buildChunks(attachment, pages) {
  const chunks = [];
  const targetChars = 3600;
  const overlapChars = 500;
  for (const page of pages) {
    const text = cleanText(page.text);
    if (!text) continue;
    let start = 0;
    while (start < text.length && chunks.length < 160) {
      let end = Math.min(text.length, start + targetChars);
      if (end < text.length) {
        const boundary = Math.max(text.lastIndexOf('\n', end), text.lastIndexOf('. ', end), text.lastIndexOf('। ', end));
        if (boundary > start + targetChars * 0.55) end = boundary + 1;
      }
      const chunkText = cleanText(text.slice(start, end));
      if (chunkText.length > 80) {
        const chunkId = id('chunk');
        chunks.push({ id: chunkId, vector_id: chunkId, page_start: page.page, page_end: page.page, text: chunkText, token_count: charTokenEstimate(chunkText), checksum: await sha256Hex(chunkText) });
      }
      if (end >= text.length) break;
      start = Math.max(start + 1, end - overlapChars);
    }
  }
  return chunks;
}

export async function indexAttachmentJob(env, job) {
  const attachment = await getAttachment(env, job.attachment_id);
  if (!attachment) throw new Error('Attachment not found.');

  // 5.3 — Idempotency: only skip after a previous job explicitly marked indexing complete.
  // document_chunks.vector_id is assigned before Vectorize upsert, so it cannot be used
  // as proof that the vectors were actually written.
  if (!job.migrated && attachment.metadata?.index_status === 'indexed') {
    console.log(`[index] ${attachment.id} is already indexed, skipping`);
    return;
  }

  const chunks = await listChunksByAttachment(env, attachment.id);
  if (!chunks.length) {
    await updateAttachment(env, attachment.id, { status: attachment.status === 'processing' ? 'limited' : attachment.status, metadata: { index_status: 'no_chunks' } });
    return;
  }
  if (!env.SOURCE_VECTORS) {
    await updateAttachment(env, attachment.id, { metadata: { index_status: 'vectorize_not_configured' } });
    return;
  }
  for (let start = 0; start < chunks.length; start += 16) {
    const batch = chunks.slice(start, start + 16);
    const vectors = await embedTexts(env, batch.map(chunk => chunk.text), { task: 'source_embedding', conversation_id: attachment.conversation_id });
    const payload = batch.map((chunk, index) => ({
      id: chunk.vector_id || chunk.id, values: vectors[index], namespace: attachment.conversation_id,
      metadata: { chunk_id: chunk.id, attachment_id: attachment.id, filename: attachment.name, page_start: chunk.page_start ?? -1, page_end: chunk.page_end ?? -1 },
    }));
    await env.SOURCE_VECTORS.upsert(payload);
  }
  await updateAttachment(env, attachment.id, { status: attachment.status === 'processing' ? 'ready' : attachment.status, metadata: { index_status: 'indexed', chunk_count: chunks.length, indexed_at: nowIso() } });
}

export async function retrieveRelevantSources(env, conversationId, query, limit = 7) {
  const text = cleanText(query);
  if (!text) return [];
  let chunks = [];
  if (env.SOURCE_VECTORS) {
    try {
      const [vector] = await embedTexts(env, [text], { task: 'source_query_embedding', conversation_id: conversationId });
      const result = await env.SOURCE_VECTORS.query(vector, { topK: Math.min(18, limit * 2), namespace: conversationId, returnMetadata: 'all' });
      const matches = result?.matches || result || [];
      const ids = matches.map(match => match.metadata?.chunk_id || match.id).filter(Boolean);
      chunks = await getChunksByIds(env, ids);
      if (chunks.length > limit) {
        const ranked = await rerank(env, text, chunks.map(chunk => chunk.text), { conversation_id: conversationId });
        chunks = ranked.slice(0, limit).map(item => chunks[item.index]).filter(Boolean);
      }
    } catch (error) { console.warn('[retrieval] Vectorize query failed', error.message); }
  }
  if (!chunks.length) chunks = await fallbackRelevantChunks(env, conversationId, limit);
  return chunks.map(chunk => ({
    ref: `attachment:${chunk.attachment_id}:chunk:${chunk.id}`, attachment_id: chunk.attachment_id,
    filename: chunk.original_name || 'source', page_start: chunk.page_start, page_end: chunk.page_end,
    text: cleanText(chunk.text).slice(0, 6000),
  }));
}

export async function ocrAttachmentJob(env, job) {
  const attachment = await getAttachment(env, job.attachment_id);
  if (!attachment) throw new Error('OCR attachment not found.');
  if (!env.OCR_PROCESSOR_URL) {
    await updateAttachment(env, attachment.id, { status: 'limited', metadata: { ocr_pending: false, ocr_configured: false } });
    return;
  }
  const object = await env.CONTENT_BUCKET.get(attachment.key);
  if (!object) throw new Error('OCR source object is missing from R2.');
  const headers = {
    'Content-Type': attachment.type || 'application/octet-stream',
    'X-Filename': encodeURIComponent(attachment.name || 'document'),
    'X-Attachment-Id': attachment.id,
  };
  if (env.OCR_PROCESSOR_TOKEN) headers.Authorization = `Bearer ${env.OCR_PROCESSOR_TOKEN}`;
  const response = await fetch(env.OCR_PROCESSOR_URL, { method: 'POST', headers, body: object.body, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`OCR processor failed (${response.status}): ${(await response.text()).slice(0, 1000)}`);
  const result = await response.json();
  const rawPages = Array.isArray(result.pages) ? result.pages : [];
  const pages = rawPages.map((page, index) => ({ page: Number(page.page || index + 1), text: cleanText(page.text || '') })).filter(page => page.text);
  const combined = pages.map(page => page.text).join('\n\n').slice(0, 500000);
  const summary = cleanText(result.summary) || (combined ? await summarizeText(env, combined, `OCR document: ${attachment.name}`, attachment.conversation_id) : 'The OCR processor returned no readable text.');
  const chunks = await buildChunks(attachment, pages);
  if (chunks.length) await replaceChunks(env, attachment, chunks);
  const confidences = rawPages.map(page => Number(page.confidence)).filter(Number.isFinite);
  const confidence = confidences.length ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length : null;
  await updateAttachment(env, attachment.id, {
    status: combined ? 'ready' : 'limited', summary, extraction_method: 'external_ocr',
    metadata: { ocr_pending: false, ocr_configured: true, ocr_confidence: confidence, ocr_page_count: pages.length },
  });
  if (chunks.length) await env.AGENT_QUEUE.send({ type: 'index_attachment', attachment_id: attachment.id, conversation_id: attachment.conversation_id });
}


export async function analyzeVideoJob(env, job) {
  const attachment = await getAttachment(env, job.attachment_id);
  if (!attachment) throw new Error('Video attachment not found.');
  if (!env.MEDIA_PROCESSOR_URL) {
    await updateAttachment(env, attachment.id, { status: 'limited', metadata: { processor_pending: false, media_processor_configured: false } });
    return;
  }
  const object = await env.CONTENT_BUCKET.get(attachment.key);
  if (!object) throw new Error('Video object is missing from R2.');
  const headers = {
    'Content-Type': attachment.type || 'application/octet-stream',
    'X-Filename': encodeURIComponent(attachment.name || 'video'),
    'X-Attachment-Id': attachment.id,
  };
  if (env.MEDIA_PROCESSOR_TOKEN) headers.Authorization = `Bearer ${env.MEDIA_PROCESSOR_TOKEN}`;
  const response = await fetch(env.MEDIA_PROCESSOR_URL, { method: 'POST', headers, body: object.body, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`Media processor failed (${response.status}): ${(await response.text()).slice(0, 1000)}`);
  const result = await response.json();
  const transcript = cleanText(result.transcript || '');
  const frames = Array.isArray(result.frames) ? result.frames : [];
  const frameText = frames.map(frame => `[${frame.timestamp ?? ''}] ${cleanText(frame.description || frame.text || '')}`).filter(Boolean).join('\n');
  const combined = [transcript, frameText].filter(Boolean).join('\n\n');
  const summary = cleanText(result.summary) || (combined ? await summarizeText(env, combined, `Video analysis: ${attachment.name}`, attachment.conversation_id) : 'The media processor returned no readable transcript or frame description.');
  const pages = combined ? [{ page: 1, text: combined.slice(0, 500000) }] : [];
  const chunks = await buildChunks(attachment, pages);
  if (chunks.length) await replaceChunks(env, attachment, chunks);
  await updateAttachment(env, attachment.id, {
    status: combined ? 'ready' : 'limited', summary, extraction_method: 'external_media_processor',
    metadata: { processor_pending: false, duration_seconds: result.duration_seconds || null, speaking_rate_wps: result.speaking_rate_wps || null, longest_pause_seconds: result.longest_pause_seconds || null, shot_change_seconds: result.shot_change_seconds || [], frame_count: frames.length },
  });
  if (chunks.length) await env.AGENT_QUEUE.send({ type: 'index_attachment', attachment_id: attachment.id, conversation_id: attachment.conversation_id });
}

export async function createUrlAttachment(env, { conversationId, messageId, url, redirectCount = 0 }) {
  const parsed = validatePublicUrl(url);
  const response = await fetch(parsed.toString(), { redirect: 'manual', headers: { 'User-Agent': 'PersonalizedContentAgent/4.0' }, signal: AbortSignal.timeout(15000) });
  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const next = response.headers.get('Location');
    if (!next) throw httpError(400, 'URL redirected without a destination.');
    if (redirectCount >= 4) throw httpError(400, 'URL redirected too many times.');
    return createUrlAttachment(env, { conversationId, messageId, url: new URL(next, parsed).toString(), redirectCount: redirectCount + 1 });
  }
  if (!response.ok) throw httpError(400, `Could not fetch URL (${response.status}).`);
  const length = Number(response.headers.get('Content-Length') || 0);
  if (length > 5 * 1024 * 1024) throw httpError(413, 'URL content is too large.');
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 5 * 1024 * 1024) throw httpError(413, 'URL content is too large.');
  const type = String(response.headers.get('Content-Type') || 'text/html').split(';')[0].toLowerCase();
  const name = safeFilename(parsed.hostname + parsed.pathname.replace(/\/$/, '').split('/').pop()) || `url.${extensionFromMime(type)}`;
  const file = new File([bytes], name, { type });
  const attachment = await processUploadedFile(env, { conversationId, messageId, file });
  await updateAttachment(env, attachment.id, { metadata: { source_url: parsed.toString(), fetched_at: nowIso() } });
  return getAttachment(env, attachment.id);
}

function validatePublicUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw httpError(400, 'Enter a valid URL.'); }
  if (url.protocol !== 'https:') throw httpError(400, 'Only HTTPS URLs are allowed.');
  const host = normalizeText(url.hostname);
  if (!host || host === 'localhost' || host.endsWith('.local') || host === '0.0.0.0' || host === '::1') throw httpError(400, 'Private or local URLs are not allowed.');
  if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) throw httpError(400, 'Private network URLs are not allowed.');
  return url;
}

export async function deleteAttachment(env, attachmentId) {
  const result = await deleteAttachmentRecord(env, attachmentId);
  if (!result) return false;
  await env.CONTENT_BUCKET.delete(result.attachment.key);
  if (env.SOURCE_VECTORS && result.chunks.length) {
    try { await env.SOURCE_VECTORS.deleteByIds(result.chunks.map(chunk => chunk.vector_id || chunk.id)); } catch (error) { console.warn('[vector-delete]', error.message); }
  }
  return true;
}

export { listAttachments };