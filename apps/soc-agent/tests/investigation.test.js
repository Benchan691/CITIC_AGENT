import assert from 'node:assert/strict'
import test from 'node:test'
import { projectOfficialSplunkResult } from '../investigation.js'

test('direct Splunk projection sanitizes output only for the splunk_mcp namespace', () => {
  const content = [{
    type: 'text',
    text: 'card 4111 1111 1111 1111 and ssn 123-45-6789',
  }]
  const projected = projectOfficialSplunkResult('mcp__splunk_mcp__splunk_run_query', content)

  assert.deepEqual(projected, [{
    type: 'text',
    text: 'card ****-****-****-1111 and ssn ***-**-****',
  }])
  assert.equal(projectOfficialSplunkResult('mcp__splunk_official__splunk_run_query', content), undefined)
  assert.equal(projectOfficialSplunkResult('mcp__soc_agent__splunk_search', content), undefined)
})
