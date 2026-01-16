# Outray TypeScript SDK

A minimal TypeScript SDK for Outray, enabling local services to be exposed to the public internet via WebSocket tunnels.

## Features

- **Protocol Agnostic**: Supports HTTP, TCP, and UDP tunneling.
- **TypeScript Native**: Full type definitions included.
- **Auto-Reconnection**: Automatically reconnects on connection failure.
- **Node.js**: Built for Node.js 18+ with ES modules.

## Installation

```bash
npm install github:CyberWarBaby/outray-ts
```

## Environment Setup

Create a `.env` file in your project root:

```env
OUTRAY_API_KEY=your_api_key_here
```

> Get your API key from [outray.dev](https://outray.dev)

### Example `.env.example`

```env
# Outray API Key (required)
OUTRAY_API_KEY=

# Optional: Custom server URL (defaults to wss://api.outray.dev)
# OUTRAY_SERVER_URL=wss://api.outray.dev
```

## Quick Start

```typescript
import { Client } from "outray";
import * as dotenv from "dotenv";

dotenv.config();

const client = new Client({
  apiKey: process.env.OUTRAY_API_KEY!,
  protocol: "http",
  port: 3000,
  onOpen: (url) => {
    console.log(`🚀 Tunnel is live: ${url}`);
  },
});

await client.connect();
```

## Usage

### HTTP Tunnel

```typescript
import { Client } from "outray";

const client = new Client({
  serverUrl: "wss://api.outray.dev",
  apiKey: process.env.OUTRAY_API_KEY!,
  protocol: "http",
  port: 8080,
  onOpen: (url) => {
    console.log(`Tunnel Online: ${url}`);
  },
  onRequest: (req) => {
    return {
      statusCode: 200,
      body: "Hello from TypeScript!",
    };
  },
});

await client.connect();
```

### HTTP Proxy Mode

If you don't provide an `onRequest` handler, the client will automatically proxy requests to your local service:

```typescript
import { Client } from "outray";

const client = new Client({
  apiKey: process.env.OUTRAY_API_KEY!,
  protocol: "http",
  port: 3000, // Proxy to local Express/Fastify/etc running on port 3000
  onOpen: (url) => {
    console.log(`Tunnel Online: ${url}`);
  },
});

await client.connect();
```

### TCP Tunnel

Expose a local TCP service (e.g., SSH or PostgreSQL):

```typescript
import { Client } from "outray";

const client = new Client({
  apiKey: process.env.OUTRAY_API_KEY!,
  protocol: "tcp",
  port: 5432, // Local Postgres port
  onOpen: (url) => {
    console.log(`TCP Tunnel: ${url}`);
  },
});

await client.connect();
```

### UDP Tunnel

Expose a local UDP service (e.g., DNS or Game Server):

```typescript
import { Client } from "outray";

const client = new Client({
  apiKey: process.env.OUTRAY_API_KEY!,
  protocol: "udp",
  port: 53, // Local DNS port
  onOpen: (url) => {
    console.log(`UDP Tunnel: ${url}`);
  },
});

await client.connect();
```

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `serverUrl` | `string` | Outray server URL (default: `wss://api.outray.dev`) |
| `apiKey` | `string` | Your Outray API key (required) |
| `protocol` | `"http" \| "tcp" \| "udp"` | Protocol type (default: `"http"`) |
| `port` | `number` | Local port to tunnel to (required) |
| `onOpen` | `(url: string) => void` | Callback when tunnel is established |
| `onRequest` | `(req: IncomingRequest) => IncomingResponse \| Promise<IncomingResponse>` | HTTP request handler |
| `onError` | `(err: Error) => void` | Error handler callback |
| `logger` | `Logger` | Custom logger instance |

## Types

### IncomingRequest

```typescript
interface IncomingRequest {
  id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Buffer | null;
}
```

### IncomingResponse

```typescript
interface IncomingResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: Buffer | string;
}
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

## Other SDKs

| Language | Repository |
|----------|------------|
| Go | [outray-go](https://github.com/CyberWarBaby/outray-go) |
| Python | [outray-py](https://github.com/CyberWarBaby/outray-py) |
| TypeScript | [outray-ts](https://github.com/CyberWarBaby/outray-ts) (this repo) |

## License

MIT
