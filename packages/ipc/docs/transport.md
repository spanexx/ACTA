# IPC Transport Layer

## Supported Transports

### Unix Socket (Preferred)
- **Path**: `/tmp/acta-{profileId}.sock`
- **Security**: File permissions 600
- **Performance**: Lowest latency
- **Use case**: Local UI, trusted plugins

### Local HTTP (Fallback)
- **Bind**: `127.0.0.1`
- **Port**: Configurable (default 5001)
- **Security**: No external exposure
- **Use case**: Cross-language clients

## Transport Interface
```ts
interface IpcTransport {
  start(): Promise<void>
  stop(): Promise<void>
  send(message: ActaMessage): void
  onMessage(callback: (msg: ActaMessage) => void): void
  isConnected(): boolean
}
```

## HTTP Transport Details
- **Endpoint**: `POST /message`
- **Content-Type**: `application/json`
- **CORS**: Disabled
- **Compression**: Optional gzip
- **Keep-alive**: Enabled

## Unix Socket Details
- **Protocol**: Line-delimited JSON
- **Encoding**: UTF-8
- **Buffer size**: 64KB
- **Backlog**: 128 connections

## Connection Management
- **Heartbeat**: Every 30s
- **Timeout**: 5s idle
- **Reconnect**: Exponential backoff
- **Drain**: Graceful shutdown

## Error Handling
- **Parse errors**: 400
- **Transport errors**: Retry with backoff
- **Auth failures**: Disconnect
- **Resource limits**: 503

## Monitoring
- Active connections
- Messages per second
- Error rates
- Latency percentiles

## Security Notes
- Unix socket: filesystem permissions
- HTTP: bind to localhost only
- No TLS required for local-only
- Optional API key header for plugins
