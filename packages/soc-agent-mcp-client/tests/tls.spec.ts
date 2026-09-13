import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from 'dsh-soc-agent-mcp-client'

const { agents, MockAgent } = vi.hoisted(() => {
  const agents: Array<{ options: unknown; close: ReturnType<typeof vi.fn> }> = []
  class MockAgent {
    options: unknown
    close = vi.fn(async () => undefined)

    constructor(options: unknown) {
      this.options = options
      agents.push(this)
    }
  }
  return { agents, MockAgent }
})

vi.mock('undici', () => ({ Agent: MockAgent }))

import { createTransport } from 'dsh-soc-agent-mcp-client/src/transport.ts'

function config(verifyTls?: boolean): Config {
  return {
    transport: 'streamable-http',
    serverName: 'tls-test',
    url: 'https://splunk.example.test/mcp',
    headers: { Authorization: 'Bearer test-token' },
    ...(verifyTls === undefined ? {} : { verifyTls }),
    toolCallTimeoutMs: 60_000,
    failOnStartupError: false,
  }
}

function jsonResponse(): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('scoped Streamable HTTP TLS policy', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    agents.length = 0
    fetchMock = vi.fn(async () => jsonResponse())
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('keeps certificate verification enabled by default without a custom dispatcher', async () => {
    const transport = createTransport(config())

    await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' })

    expect(agents).toHaveLength(0)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.not.objectContaining({ dispatcher: expect.anything() }),
    )
    await transport.close()
  })

  it('uses a connection-local non-verifying dispatcher only when requested', async () => {
    const transport = createTransport(config(false))

    await transport.send({ jsonrpc: '2.0', id: 1, method: 'ping' })

    expect(agents).toHaveLength(1)
    expect(agents[0].options).toEqual({ connect: { rejectUnauthorized: false } })
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({ dispatcher: agents[0] }),
    )

    await transport.close()
    expect(agents[0].close).toHaveBeenCalledOnce()
  })
})
