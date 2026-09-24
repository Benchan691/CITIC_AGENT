/** Browser API carrier: HTTP upstream plus one WebSocket per downstream event stream. */

import type { ApiProxy, HostFrame, MuxFrame, RpcRequest, ServerRequest } from './api.ts'
import { AbstractApiClient } from './api.ts'
import { hostFrameSchema, muxFrameSchema } from '@deepseek-ai/dsh-host-apiproxy/api/events.schema'
import { serverRequestSchema } from '@deepseek-ai/dsh-host-apiproxy/api/rpc.schema'
import { HOST_EVENTS_PATH, MUX_EVENTS_PATH } from '../api-path.ts'

type SocketItem<F> = { kind: 'frame'; envelope: RpcRequest<F> } | { kind: 'end' }
type SocketNode<F> = { item: SocketItem<F>; next: SocketNode<F> | null }
type Parser<F> = { parse(value: unknown): F }
type OutputTraceGlobal = { __DSH_OUTPUT_TRACE__?: boolean }

/** Explicit browser diagnostic; never include model text or full wire frames. */
function traceReceived(frame: MuxFrame | HostFrame): void {
  if ((globalThis as OutputTraceGlobal).__DSH_OUTPUT_TRACE__ !== true) return
  if (frame.type === 'host/session-status') {
    console.debug('[dsh-output-trace]', {
      timestamp: new Date().toISOString(),
      stage: 'status-received',
      sessionId: frame.sessionId,
      running: frame.running,
    })
    return
  }
  if (frame.type !== 'session/event') return
  const { event } = frame
  const chunk = event.type === 'assistant/chunk' ? event.data.chunk : undefined
  const chunkLength = chunk?.type === 'text-delta' || chunk?.type === 'reasoning-delta'
    ? chunk.text.length : 0
  console.debug('[dsh-output-trace]', {
    timestamp: new Date().toISOString(),
    stage: event.type === 'turn/end' ? 'output-end-received'
      : chunk === undefined ? 'session-event-received' : 'chunk-received',
    sessionId: frame.sessionId,
    seq: event.seq,
    eventType: event.type,
    chunkLength,
  })
}

/** Browser platform subclass: unary/respond use fetch; mux/host use downlink-only WebSockets. */
export class WebApiClient extends AbstractApiClient {
  protected doFetch(input: URL, init?: RequestInit): Promise<Response> {
    return globalThis.fetch(input, init)
  }

  protected override openMux(
    _payload: Parameters<ApiProxy['events']['mux']>[0]['payload'],
    signal: AbortSignal,
    onOpen?: () => void,
  ): AsyncIterable<RpcRequest<MuxFrame>> {
    return this.readWebSocket(MUX_EVENTS_PATH, signal, muxFrameSchema, onOpen)
  }

  protected override openHost(
    _payload: Parameters<ApiProxy['events']['host']>[0]['payload'],
    signal: AbortSignal,
    onOpen?: () => void,
  ): AsyncIterable<RpcRequest<HostFrame>> {
    return this.readWebSocket(HOST_EVENTS_PATH, signal, hostFrameSchema, onOpen)
  }

  private async *readWebSocket<F extends MuxFrame | HostFrame>(
    path: string,
    signal: AbortSignal,
    frameSchema: Parser<F>,
    onOpen?: () => void,
  ): AsyncGenerator<RpcRequest<F>> {
    const url = new URL(path, this.resolveBase())
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(url)
    // A burst can arrive before the consumer resumes. Keep removals O(1):
    // shifting an array once per frame made a large pending burst quadratic.
    let inboxHead: SocketNode<F> | null = null
    let inboxTail: SocketNode<F> | null = null
    let wake: (() => void) | undefined
    const enqueue = (item: SocketItem<F>): void => {
      const node: SocketNode<F> = { item, next: null }
      if (inboxTail === null) inboxHead = node
      else inboxTail.next = node
      inboxTail = node
      wake?.()
      wake = undefined
    }
    const handleOpen = (): void => { onOpen?.() }
    const handleMessage = (event: MessageEvent): void => {
      let full: ServerRequest
      let frame: F
      try {
        if (typeof event.data !== 'string') throw new Error('binary WebSocket frame')
        full = serverRequestSchema.parse(JSON.parse(event.data))
        frame = frameSchema.parse(full.payload)
      } catch (error) {
        console.error(`[client-connection] dropping malformed WebSocket frame on ${path}:`, error)
        return
      }
      traceReceived(frame)
      this.onEnvelope(full)
      enqueue({ kind: 'frame', envelope: { rpcId: full.rpcId, payload: frame } })
    }
    const handleClose = (): void => { enqueue({ kind: 'end' }) }
    const handleAbort = (): void => {
      if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) socket.close()
    }
    socket.addEventListener('open', handleOpen)
    socket.addEventListener('message', handleMessage)
    socket.addEventListener('close', handleClose, { once: true })
    signal.addEventListener('abort', handleAbort, { once: true })
    if (signal.aborted) handleAbort()
    try {
      while (true) {
        while (inboxHead !== null) {
          const node: SocketNode<F> = inboxHead
          inboxHead = node.next
          if (inboxHead === null) inboxTail = null
          const item = node.item
          if (item.kind === 'end') return
          yield item.envelope
        }
        await new Promise<void>((resolve) => { wake = resolve })
      }
    } finally {
      signal.removeEventListener('abort', handleAbort)
      socket.removeEventListener('open', handleOpen)
      socket.removeEventListener('message', handleMessage)
      socket.removeEventListener('close', handleClose)
      handleAbort()
    }
  }
}
