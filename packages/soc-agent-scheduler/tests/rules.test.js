import assert from 'node:assert/strict'
import test from 'node:test'
import { latestDue, normalizeRule, READ_ONLY_DOMAIN_TOOLS, SchedulerRuntime } from '../index.js'

class MemoryTable {
  constructor(values = []) {
    this.values = new Map(values.map(value => [value.id, value]))
  }
  entries() { return this.values.entries() }
  get(id) { return this.values.get(id) }
  async put(id, value) { this.values.set(id, value) }
  async delete(id) { return this.values.delete(id) }
}

function runtimeWith({ tasks = [], runs = [], concurrency = 1 } = {}) {
  const tables = { tasks: new MemoryTable(tasks), runs: new MemoryTable(runs), config: new MemoryTable() }
  const domain = { table: name => tables[name], close: async () => {} }
  const runtime = new SchedulerRuntime({}, {
    workspaceRoot: '/tmp', maxConcurrentRuns: concurrency, runTimeoutMs: 1000,
  }, domain)
  return { runtime, tables }
}

function executionRuntime({ whenIdle = async () => {}, flush = true, createError } = {}) {
  const tables = { tasks: new MemoryTable(), runs: new MemoryTable(), config: new MemoryTable() }
  const session = { events: [], append(type, data) { this.events.push({ type, data }) } }
  const observations = { restricted: [], title: '', followedUp: false, cancelled: false, disposed: false, order: [] }
  const ctx = {
    agents: {
      async create(options) {
        if (createError) throw createError
        options.setup({ tools: { restrict: value => { observations.restricted.push(value); observations.order.push('restrict') } } })
        return {
          agent: {
            session,
            followup() { observations.followedUp = true; observations.order.push('followup') },
            whenIdle,
            cancel() { observations.cancelled = true },
          },
          async dispose() { observations.disposed = true },
        }
      },
    },
    sessionTitle: { rename(_session, title) { observations.title = title } },
    sessions: { async flush() { return flush } },
    logger: { warn() {} },
  }
  const runtime = new SchedulerRuntime(ctx, {
    workspaceRoot: '/tmp', maxConcurrentRuns: 1, runTimeoutMs: 20,
  }, { table: name => tables[name], close: async () => {} })
  return { runtime, tables, session, observations }
}

test('normalizes strict offset and local overlap one-time rules', () => {
  assert.deepEqual(
    normalizeRule({ at: '2027-01-02T03:04:05+08:00' }, Date.parse('2026-01-01T00:00:00Z')),
    { rule: { kind: 'once', at: '2027-01-01T19:04:05.000Z' }, nextRunAt: '2027-01-01T19:04:05.000Z' },
  )
  assert.equal(
    normalizeRule({ at: { date: '2026-11-01', time: '01:30:00', time_zone: 'America/New_York' } }, 0).nextRunAt,
    '2026-11-01T05:30:00.000Z',
  )
})

test('rejects a local time inside a daylight-saving gap', () => {
  assert.throws(
    () => normalizeRule({ at: { date: '2026-03-08', time: '02:30:00', time_zone: 'America/New_York' } }, 0),
    error => error.code === 'invalid_rule',
  )
})

test('cron rules use an explicit zone and recover only the latest missed occurrence', () => {
  const normalized = normalizeRule({ cron: '0 * * * *', time_zone: 'UTC' }, Date.parse('2026-08-17T12:34:00Z'))
  assert.equal(normalized.nextRunAt, '2026-08-17T13:00:00.000Z')
  const task = { rule: normalized.rule, nextRunAt: '2026-08-17T13:00:00.000Z' }
  assert.equal(latestDue(task, Date.parse('2026-08-17T18:42:00Z')), '2026-08-17T18:00:00.000Z')
})

test('cron parser rejects six-field expressions', () => {
  assert.throws(
    () => normalizeRule({ cron: '0 0 * * * *', time_zone: 'UTC' }, 0),
    error => error.code === 'invalid_cron',
  )
})

test('cron rules reject unsafe high-frequency schedules', () => {
  assert.throws(
    () => normalizeRule({ cron: '*/5 * * * *', time_zone: 'UTC' }, 0),
    error => error.code === 'cron_too_frequent',
  )
  assert.equal(
    normalizeRule({ cron: '*/15 * * * *', time_zone: 'UTC' }, 0).nextRunAt,
    '1970-01-01T00:15:00.000Z',
  )
})

test('task results omit stored prompts and enforce active-task and prompt caps', async () => {
  const { runtime } = runtimeWith()
  await runtime.initialize()
  const first = await runtime.create({
    name: 'Review 1', prompt: 'sensitive objective', cron: '0 * * * *', time_zone: 'UTC',
  })
  assert.equal(first.prompt, undefined)
  assert.equal(first.promptCharacters, 19)
  assert.equal(first.promptSha256.length, 64)
  assert.equal(runtime.list().tasks[0].prompt, undefined)
  await assert.rejects(
    runtime.create({ name: 'Too long', prompt: 'x'.repeat(8001), cron: '0 * * * *', time_zone: 'UTC' }),
    error => error.code === 'invalid_prompt',
  )
  for (let index = 2; index <= 20; index += 1) {
    await runtime.create({ name: `Review ${index}`, prompt: 'Review alerts', cron: '0 * * * *', time_zone: 'UTC' })
  }
  await assert.rejects(
    runtime.create({ name: 'Review 21', prompt: 'Review alerts', cron: '0 * * * *', time_zone: 'UTC' }),
    error => error.code === 'active_task_limit',
  )
  await runtime.close()
})

test('terminal run retention and list output are bounded', async () => {
  const { runtime, tables } = runtimeWith()
  await runtime.initialize()
  const task = { id: 'task-1' }
  for (let index = 0; index < 205; index += 1) {
    await runtime.recordSkipped(task, new Date(index * 60_000).toISOString(), 'skipped_overlap')
  }
  assert.equal([...tables.runs.entries()].length, 200)
  assert.equal(runtime.list().runs.length, 20)
  assert.equal(runtime.list().runCount, 200)
  await runtime.close()
})

test('pause, resume, and delete persist task state', async () => {
  const { runtime, tables } = runtimeWith()
  await runtime.initialize()
  const task = await runtime.create({ name: 'Hourly review', prompt: 'Review alerts', cron: '0 * * * *', time_zone: 'UTC' })
  assert.equal((await runtime.setStatus(task.id, 'paused')).status, 'paused')
  assert.equal((await runtime.setStatus(task.id, 'active')).status, 'active')
  assert.deepEqual(await runtime.delete(task.id), { id: task.id, deleted: true })
  assert.equal(tables.tasks.get(task.id), undefined)
  await runtime.close()
})

test('run-now records overlap without launching a second run', async () => {
  const { runtime, tables } = runtimeWith()
  await runtime.initialize()
  const task = await runtime.create({ name: 'Review', prompt: 'Review alerts', cron: '0 * * * *', time_zone: 'UTC' })
  runtime.pendingTaskIds.add(task.id)
  const run = await runtime.runNow(task.id)
  assert.equal(run.state, 'skipped_overlap')
  assert.equal(tables.runs.get(run.id).state, 'skipped_overlap')
  runtime.pendingTaskIds.clear()
  await runtime.close()
})

test('global concurrency starts only one queued investigation at a time', async () => {
  const { runtime } = runtimeWith({ concurrency: 1 })
  await runtime.initialize()
  const tasks = [1, 2].map(index => ({ id: `task-${index}` }))
  const releases = []
  const started = []
  runtime.executeRun = task => new Promise(resolve => {
    started.push(task.id)
    releases.push(resolve)
  })
  await runtime.queueRun(tasks[0], '2026-08-17T00:00:00.000Z')
  await runtime.queueRun(tasks[1], '2026-08-17T00:01:00.000Z')
  runtime.pump()
  assert.deepEqual(started, ['task-1'])
  releases.shift()()
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(started, ['task-1', 'task-2'])
  releases.shift()()
  await new Promise(resolve => setImmediate(resolve))
  await runtime.close()
})

test('durable reload retries queued work and records the interrupted run', async () => {
  const task = {
    id: '47bc85e8-d18b-4d60-941f-93b0b50321ac', name: 'Review', prompt: 'Review alerts',
    rule: { kind: 'cron', expression: '0 * * * *', timeZone: 'UTC' }, status: 'active',
    createdAt: '2026-08-17T00:00:00.000Z', updatedAt: '2026-08-17T00:00:00.000Z',
    nextRunAt: '2026-08-17T02:00:00.000Z',
  }
  const interrupted = {
    id: 'bbf420c5-cc5d-4454-a461-e33923dcacb6', taskId: task.id,
    scheduledFor: '2026-08-17T01:00:00.000Z', state: 'running',
  }
  const { runtime, tables } = runtimeWith({ tasks: [task], runs: [interrupted] })
  await runtime.initialize()
  runtime.executeRun = async () => {}
  await runtime.recover()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(tables.runs.get(interrupted.id).state, 'failed')
  assert.equal(tables.runs.get(interrupted.id).errorCode, 'host_restart')
  assert.equal([...tables.runs.values.values()].length, 2)
  await runtime.close()
})

test('scheduler concurrency and timeout settings are durable and validated', async () => {
  const { runtime, tables } = runtimeWith()
  await runtime.initialize()
  assert.deepEqual(await runtime.updateSettings({ maxConcurrentRuns: 2, runTimeoutMs: 30_000 }), {
    maxConcurrentRuns: 2, runTimeoutMs: 30_000,
  })
  assert.deepEqual(tables.config.get('scheduler'), { maxConcurrentRuns: 2, runTimeoutMs: 30_000 })
  await assert.rejects(
    runtime.updateSettings({ maxConcurrentRuns: 0, runTimeoutMs: 30_000 }),
    error => error.code === 'invalid_concurrency',
  )
  await runtime.close()
})

test('successful runs create linked result sessions with read-only tools and metadata', async () => {
  const { runtime, tables, session, observations } = executionRuntime()
  const task = { id: 'task-1', name: 'Review', prompt: 'Review alerts' }
  const run = { id: 'run-1', taskId: task.id, scheduledFor: '2026-08-17T01:00:00.000Z', state: 'queued' }
  await runtime.executeRun(task, run)
  const stored = tables.runs.get(run.id)
  assert.equal(stored.state, 'completed')
  assert.match(stored.sessionId, /^scheduled-/)
  assert.equal(observations.followedUp, true)
  assert.equal(observations.disposed, true)
  assert.match(observations.title, /^\[Scheduled\] Review ·/)
  assert.deepEqual(observations.restricted, [{ allow: [...READ_ONLY_DOMAIN_TOOLS] }])
  assert.deepEqual(observations.order, ['restrict', 'followup'])
  assert.equal(session.events[0].type, 'scheduled-task/run')
  assert.equal(session.events[0].data.runId, run.id)
})

test('failed creation and timed-out runs record stable errors', async () => {
  const task = { id: 'task-1', name: 'Review', prompt: 'Review alerts' }
  const failed = executionRuntime({ createError: new Error('boom') })
  await failed.runtime.executeRun(task, { id: 'run-failed', taskId: task.id, scheduledFor: '2026-08-17T01:00:00.000Z', state: 'queued' })
  assert.equal(failed.tables.runs.get('run-failed').errorCode, 'run_failed')

  const timedOut = executionRuntime({ whenIdle: () => new Promise(() => {}) })
  await timedOut.runtime.executeRun(task, { id: 'run-timeout', taskId: task.id, scheduledFor: '2026-08-17T01:00:00.000Z', state: 'queued' })
  assert.equal(timedOut.tables.runs.get('run-timeout').errorCode, 'run_timeout')
  assert.equal(timedOut.observations.cancelled, true)
  assert.equal(timedOut.observations.disposed, true)
})
