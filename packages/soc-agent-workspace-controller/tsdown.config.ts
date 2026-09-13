import { clientBundle } from '../../tooling/client/tsdown.client.ts'

export default clientBundle(
  'dsh-soc-agent-workspace-controller',
  ['src/index.ts'],
  { hostPhase: true },
)
