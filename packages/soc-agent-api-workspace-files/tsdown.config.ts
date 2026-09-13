import { clientBundle } from '../../tooling/client/tsdown.client.ts'

export default clientBundle(
  'dsh-soc-agent-api-workspace-files',
  ['src/index.ts'],
  { hostPhase: true },
)
