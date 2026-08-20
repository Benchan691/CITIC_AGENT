export const SCHEDULED_TASK_CHANNEL = '/soc-agent-schedules'

export function createScheduledTaskClient(connection) {
  const call = async (endpoint, payload = {}) => {
    const result = await connection.rpc.call(SCHEDULED_TASK_CHANNEL, endpoint, payload)
    if (!result?.ok) throw new Error(result?.error?.message || `Scheduled-task request failed: ${endpoint}`)
    return result.value
  }
  return {
    list: () => call('list'),
    create: payload => call('create', payload),
    pause: id => call('pause', { id }),
    resume: id => call('resume', { id }),
    delete: id => call('delete', { id }),
    runNow: id => call('run-now', { id }),
    updateSettings: settings => call('settings', settings),
    call,
  }
}

// The product client mounts the returned browser API into its normal Settings
// section; this package intentionally owns no generic floating UI surface.
export const inject = []
export function apply() {}
