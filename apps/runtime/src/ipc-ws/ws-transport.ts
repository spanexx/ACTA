import * as http from 'http'
import type { IncomingMessage } from 'http'
import type { AddressInfo } from 'node:net'
import { createLogger } from '@acta/logging'
import type { ActaMessage, TaskErrorPayload } from '@acta/ipc'
import { WebSocketServer, WebSocket } from 'ws'
import { isAllowedOrigin } from './origin.util'
import { decodeWsMessageData, parseIncomingActaMessage } from './ws-message.util'

export type RuntimeWsTransport = {
  server: http.Server
  wss: WebSocketServer
  clients: Set<WebSocket>
  listen: () => Promise<void>
  close: () => Promise<void>
}

export function createRuntimeWsTransport(opts: {
  host: string
  port: number
  path: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  onActaMessage: (ws: WebSocket, msg: ActaMessage) => void
  onParseError: (ws: WebSocket, error: TaskErrorPayload, context?: ActaMessage) => void
  onHandlerError: (ws: WebSocket, error: TaskErrorPayload, context?: ActaMessage) => void
}): RuntimeWsTransport {
  const logger = createLogger('ipc-ws', opts.logLevel)

  const server = http.createServer((req, res) => {
    res.writeHead(404)
    res.end()
  })

  const wss = new WebSocketServer({ noServer: true })
  const clients = new Set<WebSocket>()

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = req.url
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined

    if (!url) {
      socket.destroy()
      return
    }

    let pathname: string | null = null
    try {
      pathname = new URL(url, 'http://127.0.0.1').pathname
    } catch {
      pathname = null
    }

    if (pathname !== opts.path) {
      socket.destroy()
      return
    }

    if (!isAllowedOrigin(origin)) {
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, ws => {
      wss.emit('connection', ws, req)
    })
  })

  wss.on('connection', ws => {
    logger.info('IPC WS client connected')
    clients.add(ws)

    ws.on('close', () => {
      clients.delete(ws)
      logger.info('IPC WS client disconnected')
    })

    ws.on('error', err => {
      logger.error('IPC WS client error', err)
    })

    ws.on('message', data => {
      const text = decodeWsMessageData(data)
      logger.debug('IPC WS message received', { size: text.length })

      const parsed = parseIncomingActaMessage(text)
      if (!parsed.ok) {
        opts.onParseError(ws, parsed.error, parsed.context)
        return
      }

      try {
        opts.onActaMessage(ws, parsed.msg)
      } catch (err) {
        opts.onHandlerError(
          ws,
          {
            code: 'ipc.handler_error',
            message: err instanceof Error ? err.message : String(err),
          },
          parsed.msg,
        )
      }
    })
  })

  return {
    server,
    wss,
    clients,
    listen: async () => {
      await new Promise<void>((resolve, reject) => {
        server.once('error', reject)
        server.listen(opts.port, opts.host, () => resolve())
      })

      const addr = server.address() as AddressInfo | string | null
      logger.info('IPC WS server listening', {
        host: opts.host,
        port: typeof addr === 'string' || !addr ? opts.port : addr.port,
        path: opts.path,
      })
    },
    close: async () => {
      await new Promise<void>(resolve => wss.close(() => resolve()))
      await new Promise<void>(resolve => server.close(() => resolve()))
      clients.clear()
      logger.info('IPC WS server stopped')
    },
  }
}
