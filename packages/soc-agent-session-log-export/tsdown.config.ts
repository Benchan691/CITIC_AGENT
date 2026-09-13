import { clientBundle } from '../../tooling/client/tsdown.client.ts'

export default clientBundle(
  'dsh-soc-agent-session-log-export',
  ['src/index.ts'],
  { hostPhase: true },
)
