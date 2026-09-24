/** Host-side WebSocket carrier for the two server-to-browser event streams. */

import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import WebSocket, { WebSocketServer } from 'ws'
import type {
  ApiProxy, HostFrame, MuxFrame, RpcRequest, ServerRequest,
} from '@deepseek-ai/dsh-host-apiproxy/api'
import { RpcId } from '@deepseek-ai/dsh-host-apiproxy/api'

type Frame = MuxFrame | HostFrame

/** Opt-in host transport timing; never records payload text. */
type TraceExtra = { chunkLength?: number | undefined; turn?: number; step?: number }
const traceOutput = process.env.DSH_OUTPUT_TRACE === '1'
  ? (stage: string, sessionId: string, seq: number, extra?: TraceExtra): void => {
    console.error('[dsh-output-trace]', JSON.stringify({
      timestamp: new Date().toISOString(), stage, sessionId, seq, ...extra,
    }))
  }
  : undefined

function traceSent(payload: Frame): void {
  if (traceOutput === undefined) return
  if (payload.type === 'session/event') {
    const { event } = payload
    if (event.type === 'assistant/chunk') {
      const { chunk } = event.data
      const chunkLength = chunk.type === 'text-delta' || chunk.type === 'reasoning-delta'
        ? chunk.text.length
        : chunk.type === 'tool-call-delta' ? chunk.argumentsDelta.length : undefined
      traceOutput('chunk-sent', payload.sessionId, event.seq, {
        chunkLength, turn: event.data.turn, step: event.data.step,
      })
    } else if (event.type === 'assistant/message') {
      traceOutput('message-sent', payload.sessionId, event.seq, { turn: event.data.turn, step: event.data.step })
    } else if (event.type === 'turn/end') {
      traceOutput('output-end-sent', payload.sessionId, event.seq, { turn: event.data.turn })
    }
  } else if (payload.type === 'host/session-status' && !payload.running) {
    traceOutput('task-idle-sent', payload.sessionId, payload.lastSeq)
  }
}

function serverRequest(frame: RpcRequest<Frame>): ServerRequest {
  return {
    type: 'server-request',
    rpcId: frame.rpcId,
    method: frame.payload.type,
    payload: frame.payload,
  }
}

function send(socket: WebSocket, frame: RpcRequest<Frame>): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.readyState !== WebSocket.OPEN) {
      reject(new Error('websocket downlink closed before frame delivery'))
      return
    }
    socket.send(JSON.stringify(serverRequest(frame)), (error) => {
      if (error) reject(error)
      else {
        traceSent(frame.payload)
        resolve()
      }
    })
  })
}

function failureFrame(): RpcRequest<Frame> {
  return {
    rpcId: RpcId(randomUUID()),
    payload: {
      type: 'stream/error',
      error: { code: 'internal', message: 'event stream unavailable', details: {} },
    },
  }
}

/**
 * Owns WebSocket negotiation and frame pumping for the connection plugin's
 * two downlinks. Client messages are a protocol violation: upstream traffic
 * remains on HTTP.
 */
export class WebSocketDownlinks {
  private readonly server = new WebSocketServer({ noServer: true })
  private readonly pumps = new Set<Promise<void>>()

  /** @param api - host API supplying the typed event streams. */
  constructor(private readonly api: ApiProxy) {}

  /**
   * Upgrade one socket and pump the mux stream until either side closes.
   * @param req - HTTP upgrade request.
   * @param socket - Raw socket transferred by the HTTP server.
   * @param head - Bytes already read after the upgrade headers.
   */
  handleMux(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.upgrade(req, socket, head, signal => this.api.events.mux({
      rpcId: RpcId(randomUUID()),
      payload: {},
    }, signal))
  }

  /**
   * Upgrade one socket and pump the host stream until either side closes.
   * @param req - HTTP upgrade request.
   * @param socket - Raw socket transferred by the HTTP server.
   * @param head - Bytes already read after the upgrade headers.
   */
  handleHost(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.upgrade(req, socket, head, signal => this.api.events.host({
      rpcId: RpcId(randomUUID()),
      payload: {},
    }, signal))
  }

  /**
   * Terminate owned sockets and await the no-server acceptor plus frame pumps.
   * @returns A promise resolving after every socket and source iterator stops.
   */
  async close(): Promise<void> {
    for (const socket of this.server.clients) socket.terminate()
    await new Promise<void>((resolve, reject) => {
      this.server.close((error) => {
        if (error === undefined) resolve()
        else reject(error)
      })
    })
    await Promise.all(this.pumps)
  }

  private upgrade<F extends Frame>(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    open: (signal: AbortSignal) => AsyncIterable<RpcRequest<F>>,
  ): void {
    this.server.handleUpgrade(req, socket, head, (websocket) => {
      const abort = new AbortController()
      websocket.once('close', () => { abort.abort() })
      websocket.once('error', () => { abort.abort() })
      websocket.once('message', () => {
        websocket.close(1008, 'downlink only')
      })
      const pump = this.pump(websocket, open(abort.signal), abort)
      this.pumps.add(pump)
      void pump.then(() => { this.pumps.delete(pump) })
    })
  }

  private async pump<F extends Frame>(
    socket: WebSocket,
    frames: AsyncIterable<RpcRequest<F>>,
    abort: AbortController,
  ): Promise<void> {
    try {
      for await (const frame of frames) await send(socket, frame)
    } catch {
      if (!abort.signal.aborted) {
        try {
          await send(socket, failureFrame())
        } catch {
          // Socket loss won the race; no downstream remains to receive the failure frame.
        }
      }
    } finally {
      abort.abort()
      if (socket.readyState === WebSocket.OPEN) socket.close()
    }
  }
}

/**
 * Reject an untrusted upgrade before protocol negotiation.
 * @param socket - Raw HTTP socket that remains owned by the caller.
 */
export function rejectWebSocketUpgrade(socket: Duplex): void {
  socket.end([
    'HTTP/1.1 403 Forbidden',
    'Connection: close',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Length: 9',
    '',
    'forbidden',
  ].join('\r\n'))
}
