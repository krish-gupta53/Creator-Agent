import { refreshConversationSummaryJob } from './conversations.js';
import { getJob, setJob, updateAttachment } from './db.js';
import { generateContentPackageJob, regeneratePackageJob } from './packages.js';
import { runInstagramInsightsJob } from './performance.js';
import { processSocialVideoUrlJob } from './social-video.js';
import { analyzeVideoJob, indexAttachmentJob, ocrAttachmentJob } from './sources.js';
import { nowIso, safeError } from './utils.js';

const HANDLERS = {
  refresh_conversation_summary: refreshConversationSummaryJob,
  index_attachment: indexAttachmentJob,
  analyze_video: analyzeVideoJob,
  ocr_attachment: ocrAttachmentJob,
  process_social_video_url: processSocialVideoUrlJob,
  generate_package: generateContentPackageJob,
  regenerate_package_section: regeneratePackageJob,
  instagram_insights: runInstagramInsightsJob,
};

export async function processQueueBatch(batch, env) {
  for (const message of batch.messages) {
    const job = message.body || {};
    try {
      const handler = HANDLERS[job.type];
      if (!handler) throw new Error(`Unknown queue job type: ${job.type || 'missing'}`);
      await handler(env, job);
      message.ack();
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', event: 'queue_job_failed', job_type: job.type, job_id: job.job_id, error: safeError(error) }));
      if (job.job_id) {
        try { await setJob(env, job.job_id, { ...(await getJob(env, job.job_id)), state: 'failed', error: error.message, completed_at: nowIso(), progress: 'Failed' }); }
        catch (writeError) { console.error('[job-status-write]', writeError.message); }
      }
      if (job.type === 'process_social_video_url' && job.attachment_id) {
        try {
          await updateAttachment(env, job.attachment_id, {
            status: 'processing',
            summary: 'The social-video source is temporarily delayed and will continue automatically.',
            metadata: {
              processing_stage: 'retrying',
              last_error: String(error.message || 'Unknown error').slice(0, 1000),
            },
          });
        } catch (writeError) {
          console.error('[social-video-status-write]', writeError.message);
        }
      }
      message.retry({ delaySeconds: 120 });
    }
  }
}
