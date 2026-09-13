import { clientBundle } from '../../tooling/client/tsdown.client.ts'

export default clientBundle(
  'dsh-soc-agent-api-remotes',
  ['src/index.ts'],
  { hostPhase: true },
)
