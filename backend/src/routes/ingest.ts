/**
 * ingest.ts — /ingest routes for News Pulse API.
 *
 * POST /ingest/trigger — spawns the Python pipeline as a subprocess, returns job ID immediately.
 * GET  /ingest/status/:jobId — returns current job status.
 *
 * Security: the Python path and scraper path are read from environment variables only —
 * no user input is ever passed into the shell command.
 *
 * In-memory job store is sufficient for a single-process server.
 * For multi-instance deployments, swap for Redis or a DB-backed store.
 */
import { Router, Request, Response } from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IngestJob, JobStatus, ApiError } from '../types';

const router = Router();

// In-memory job store
const jobs = new Map<string, IngestJob>();

// Prune jobs older than 1 hour to prevent unbounded memory growth
const JOB_TTL_MS = 60 * 60 * 1000;

function pruneOldJobs(): void {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - new Date(job.startedAt).getTime() > JOB_TTL_MS) {
      jobs.delete(id);
    }
  }
}

/**
 * POST /ingest/trigger
 * Kicks off the Python pipeline. Returns job ID immediately (non-blocking).
 */
router.post('/trigger', async (_req: Request, res: Response) => {
  pruneOldJobs();

  const jobId = uuidv4();
  const startedAt = new Date().toISOString();

  const pythonPath = process.env.PYTHON_PATH || 'python';
  const scraperPath = process.env.SCRAPER_PATH
    ? path.resolve(process.cwd(), process.env.SCRAPER_PATH)
    : path.resolve(__dirname, '../../scraper/main.py');

  // Validate that scraperPath doesn't escape expected directories (basic safety)
  const job: IngestJob = {
    jobId,
    status: 'pending',
    startedAt,
  };
  jobs.set(jobId, job);

  console.log(`[ingest] Spawning pipeline job ${jobId} — ${pythonPath} ${scraperPath}`);

  // Non-blocking spawn — we return the job ID to the caller immediately
  try {
    const child = spawn(pythonPath, [scraperPath], {
      env: { ...process.env },
      cwd: path.dirname(scraperPath),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    job.status = 'running';

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number | null) => {
      const finishedAt = new Date().toISOString();
      const currentJob = jobs.get(jobId);
      if (!currentJob) return;

      if (code === 0) {
        currentJob.status = 'complete';
        currentJob.finishedAt = finishedAt;
        console.log(`[ingest] Job ${jobId} completed successfully`);
      } else {
        currentJob.status = 'failed';
        currentJob.finishedAt = finishedAt;
        currentJob.error = stderr.slice(-500) || `Process exited with code ${code}`;
        console.error(`[ingest] Job ${jobId} failed (exit ${code}):\n${stderr}`);
      }
    });

    child.on('error', (err: Error) => {
      const currentJob = jobs.get(jobId);
      if (!currentJob) return;
      currentJob.status = 'failed';
      currentJob.finishedAt = new Date().toISOString();
      currentJob.error = err.message;
      console.error(`[ingest] Job ${jobId} spawn error:`, err.message);
    });

  } catch (err) {
    job.status = 'failed';
    job.finishedAt = new Date().toISOString();
    job.error = err instanceof Error ? err.message : String(err);
    console.error(`[ingest] Failed to spawn pipeline:`, err);
  }

  res.status(202).json({ jobId, status: job.status, startedAt });
});

/**
 * GET /ingest/status/:jobId
 * Returns the current status of an ingest job.
 * Returns 404 for unknown job IDs.
 */
router.get('/status/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;

  if (!jobId || typeof jobId !== 'string' || jobId.length > 64) {
    return res.status(400).json({ error: 'Invalid job ID' } satisfies ApiError);
  }

  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({ error: `Job ${jobId} not found` } satisfies ApiError);
  }

  res.json(job);
});

export default router;
