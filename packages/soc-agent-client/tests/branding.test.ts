import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const source = (name: string): string => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')

test('uses the Sentinel wordmark and prevents sidebar wrapping', () => {
  assert.match(source('CiticBrand.tsx'), /className=\{css\.wordmark\}>Sentinel<\/span>/)
  const styles = source('CiticBrand.module.css')
  assert.match(styles, /font-size:\s*16px/)
  assert.match(styles, /font-weight:\s*700/)
  assert.match(styles, /letter-spacing:\s*0\.08em/)
  assert.match(styles, /overflow:\s*hidden/)
  assert.match(styles, /text-overflow:\s*ellipsis/)
  assert.match(styles, /white-space:\s*nowrap/)
})

test('uses Sentinel in the login surface and model persona', () => {
  assert.match(source('AuthGate.tsx'), /aria-label="Sentinel login"/)
  assert.match(source('AuthGate.tsx'), /<h1 className=\{css\.title\}>Sentinel<\/h1>/)
  const persona = readFileSync(new URL('../../../vendor/deepseek-harness/apps/cli/config/agent-presets/citic-soc/agent.cordis.yml', import.meta.url), 'utf8')
  assert.match(persona, /You are Sentinel, the CITIC SOC Agent powered by \{\{model\}\}/)
})
