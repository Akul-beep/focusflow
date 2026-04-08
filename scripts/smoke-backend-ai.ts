/**
 * Hits the **real** unified AI route (Groq when GROQ_API_KEY is set in the server env).
 * Does not call Groq from this process — Next loads `.env.local` when you run `npm run dev`.
 *
 * Prerequisite: `npm run dev` (server on SMOKE_API_BASE, default http://127.0.0.1:3000).
 *
 * Run: npm run test:smoke-backend-ai
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.SMOKE_API_BASE || 'http://127.0.0.1:3000';
const API = `${BASE.replace(/\/$/, '')}/api/gemini`;

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(path);
  const j = await res.json().catch(() => ({}));
  return j;
}

async function postParseTask(text: string, scheduleContext?: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'parseTask', text, scheduleContext: scheduleContext ?? {} }),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, body: j };
}

async function postChunkTask(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'chunkTask', ...body }),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, body: j };
}

async function postEstimateTopicDurations(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'estimateTopicDurations', ...body }),
  });
  const j = await res.json().catch(() => ({}));
  return { status: res.status, body: j };
}

function warnIfNoLocalEnvHint(): void {
  const p = resolve(process.cwd(), '.env.local');
  if (!existsSync(p)) {
    console.warn('Note: no .env.local in cwd — ensure dev server has GROQ_API_KEY set.\n');
    return;
  }
  const raw = readFileSync(p, 'utf8');
  if (!/\bGROQ_API_KEY\s*=/.test(raw)) {
    console.warn('Note: .env.local has no GROQ_API_KEY — smoke tests expect Groq on the server.\n');
  }
}

async function main() {
  warnIfNoLocalEnvHint();
  console.log(`Smoke target: ${API}\n`);

  const health = (await getJson(API)) as {
    configured?: boolean;
    provider?: string;
    model?: string | null;
    message?: string;
  };
  assert(health.configured === true, `GET /api/gemini must report configured: true (got ${JSON.stringify(health)})`);

  console.log(`Provider: ${health.provider} · model: ${health.model ?? 'n/a'}\n`);

  // --- Same phrases as manual QA (parseTask) ---
  const cases: { label: string; text: string; ctx?: Record<string, unknown>; check: (b: Record<string, unknown>) => void }[] = [
    {
      label: 'Weekly meeting → calendar event (not study_plan)',
      text: 'Team standup Mon 9am weekly',
      check: (b) => {
        assert(b.kind === 'event', `expected kind event, got ${b.kind}`);
        const rep = b.repeat as { daysOfWeek?: number[] } | null | undefined;
        assert(Array.isArray(rep?.daysOfWeek) && rep!.daysOfWeek!.includes(1), 'repeat.daysOfWeek should include Monday (1)');
      },
    },
    {
      label: 'Past paper → single sitting (not multi-step essay list)',
      text: '2 hour Math past paper this Saturday',
      check: (b) => {
        assert(b.kind !== 'study_plan', 'should not be study_plan');
        if (b.kind === 'task') {
          assert(b.sessionStyle === 'single_block', `task should be single_block, got ${b.sessionStyle}`);
        } else if (b.kind === 'event') {
          assert(
            b.eventType === 'study' || b.durationMinutes != null || b.startTime != null,
            'event should look like a study block (times or duration)'
          );
        } else {
          throw new Error(`unexpected kind ${b.kind}`);
        }
      },
    },
    {
      label: 'Essay → task + multi_step (chunkTask is separate)',
      text: '2000-word essay due next Friday',
      check: (b) => {
        assert(b.kind === 'task', `expected kind task, got ${b.kind}`);
        assert(b.sessionStyle === 'multi_step', `expected multi_step, got ${b.sessionStyle}`);
      },
    },
    {
      label: 'Daily papers until exam → study_plan with dated microTasks',
      text: '1 Math paper every day 2h until Math final exam',
      ctx: {
        exams: [
          {
            name: 'Math final',
            subject: 'Mathematics',
            examDate: '2026-06-20',
            topics: ['Algebra', 'Functions'],
          },
        ],
        activeTasks: [],
      },
      check: (b) => {
        assert(b.kind === 'study_plan', `expected study_plan, got ${b.kind}`);
        const tasks = b.tasks as Array<{ microTasks?: unknown[] }> | undefined;
        assert(Array.isArray(tasks) && tasks.length >= 1, 'study_plan.tasks non-empty');
        const micros = tasks![0]!.microTasks;
        assert(Array.isArray(micros) && micros.length >= 3, `expected several sessions, got ${micros?.length ?? 0}`);
      },
    },
  ];

  for (const c of cases) {
    process.stdout.write(`— ${c.label} … `);
    const { status, body } = (await postParseTask(c.text, c.ctx)) as {
      status: number;
      body: Record<string, unknown>;
    };
    assert(status >= 200 && status < 300, `HTTP ${status}: ${JSON.stringify(body)}`);
    assert(body.success === true, `success false: ${JSON.stringify(body)}`);
    c.check(body);
    console.log('ok');
  }

  // --- chunkTask (Groq JSON array of steps) ---
  console.log('\n— chunkTask (essay breakdown) … ');
  const chunk = (await postChunkTask({
    title: 'IB essay',
    description: '2000 words, compare two texts',
    estimatedHours: 5,
    dueDate: '2026-06-01',
    priority: 'high',
    studyPace: 'balanced',
    defaultSessionMinutes: 40,
    gradeLevel: '10',
  })) as { status: number; body: Record<string, unknown> };
  assert(chunk.status >= 200 && chunk.status < 300, `chunkTask HTTP ${chunk.status}`);
  assert(chunk.body.success === true, JSON.stringify(chunk.body));
  const micros = chunk.body.microTasks as unknown[] | undefined;
  assert(Array.isArray(micros) && micros.length >= 3, `chunkTask should return 3+ steps, got ${micros?.length}`);
  console.log('ok');

  // --- Exam planner path: per-topic minutes JSON ---
  console.log('\n— estimateTopicDurations (exam prep style) … ');
  const est = (await postEstimateTopicDurations({
    sessionLengthMinutes: 30,
    studentContext: 'EXAM PREP',
    gradeLevel: '10',
    subjects: [{ name: 'Physics', topics: ['Kinematics', 'Newton laws'] }],
  })) as { status: number; body: Record<string, unknown> };
  assert(est.status >= 200 && est.status < 300, `estimateTopicDurations HTTP ${est.status}`);
  assert(est.body.success === true, JSON.stringify(est.body));
  const subs = est.body.subjects as Array<{ topics?: Array<{ topic?: string; estimatedMinutes?: number }> }> | undefined;
  assert(
    Array.isArray(subs) && subs.length >= 1 && (subs[0]!.topics?.length ?? 0) >= 2,
    'subjects[0].topics should have 2 rows'
  );
  for (const row of subs![0]!.topics ?? []) {
    assert(
      typeof row.estimatedMinutes === 'number' && row.estimatedMinutes > 0,
      'each topic needs estimatedMinutes'
    );
  }
  console.log('ok');

  console.log('\nAll backend AI smoke checks passed (parseTask ×4 + chunkTask + estimateTopicDurations).');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  console.error(
    '\nIs `npm run dev` running? Is GROQ_API_KEY set in .env.local? Try SMOKE_API_BASE=http://127.0.0.1:3000'
  );
  process.exit(1);
});
