/**
 * BullMQ Worker entrypoint
 * Stack contract: queue.engine=bullmq, queue.backing=upstash-redis, cloud.provider=gcp (Cloud Run)
 *
 * Two deployable units (docs/03-system-design.md §1.1):
 *   1. quotingagent-web — Vercel (Next.js App Router)
 *   2. quotingagent-worker — GCP Cloud Run (this file) — min=1, max=5, concurrency=4
 *
 * Queues handled:
 *   - quote-generation: process-quote jobs (vision → extraction → persist)
 *   - followup-sms:     D+3 / D+7 SMS nudges
 *   - fsm-push:         Won-quote FSM job creation (ServiceM8 / Tradify)
 *   - rate-card-refresh: Daily BullMQ cron job for Bunnings/Reece pricing
 */

import { Worker } from "bullmq"; // QueueScheduler removed in BullMQ v5 (built into Worker)
import pino from "pino";
import { processQuoteJob } from "@/worker/jobs/process-quote";
import { followupSmsJob } from "@/worker/jobs/followup-sms";
import { fsmPushJob } from "@/worker/jobs/fsm-push";
import { rateCardRefreshJob } from "@/worker/jobs/rate-card-refresh";

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // PII redaction
  redact: {
    paths: ["customer_name", "customer_mobile", "address", "*.customer_name", "*.customer_mobile"],
    censor: "[Redacted]",
  },
});

// Connection config for Upstash Redis
// BullMQ requires ioredis-compatible connection (not the HTTP REST client)
// Upstash supports TLS ioredis connections at the same host:6380
const redisConnection = {
  host: new URL(process.env.UPSTASH_REDIS_REST_URL ?? "redis://localhost:6379").hostname,
  port: 6380, // TLS port for Upstash ioredis
  password: process.env.UPSTASH_REDIS_REST_TOKEN,
  tls: {},
  maxRetriesPerRequest: null, // Required for BullMQ
};

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

const quoteWorker = new Worker(
  "quote-generation",
  async (job) => {
    logger.info({ jobId: job.id, quoteId: job.data.quoteId }, "worker.process-quote.start");
    await processQuoteJob(job.data, logger);
    logger.info({ jobId: job.id, quoteId: job.data.quoteId }, "worker.process-quote.done");
  },
  {
    connection: redisConnection,
    concurrency: 4, // max 4 simultaneous quote generations per worker instance (§7.1)
  }
);

const followupWorker = new Worker(
  "followup-sms",
  async (job) => {
    logger.info({ jobId: job.id, leadId: job.data.leadId, stage: job.data.stage }, "worker.followup-sms.start");
    await followupSmsJob(job.data, logger);
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

const fsmPushWorker = new Worker(
  "fsm-push",
  async (job) => {
    logger.info({ jobId: job.id, quoteId: job.data.quoteId, provider: job.data.provider }, "worker.fsm-push.start");
    await fsmPushJob(job.data, logger);
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

const rateCardWorker = new Worker(
  "rate-card-refresh",
  async (job) => {
    logger.info({ jobId: job.id }, "worker.rate-card-refresh.start");
    await rateCardRefreshJob(logger);
  },
  {
    connection: redisConnection,
    concurrency: 1, // Only one refresh at a time
  }
);

// ---------------------------------------------------------------------------
// Event handlers for observability (NFR-017)
// ---------------------------------------------------------------------------

for (const worker of [quoteWorker, followupWorker, fsmPushWorker, rateCardWorker]) {
  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, queue: job.queueName, duration: job.processedOn ? Date.now() - job.processedOn : null }, "worker.job.completed");
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, queue: job?.queueName, err: err.message, attempts: job?.attemptsMade }, "worker.job.failed");
  });

  worker.on("error", (err) => {
    logger.error({ err: err.message }, "worker.error");
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown() {
  logger.info("worker.shutdown.start");
  await Promise.allSettled([
    quoteWorker.close(),
    followupWorker.close(),
    fsmPushWorker.close(),
    rateCardWorker.close(),
  ]);
  logger.info("worker.shutdown.complete");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

logger.info("worker.started");
