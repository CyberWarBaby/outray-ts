/**
 * Type definitions for Outray SDK
 */

/**
 * WebSocket message types
 */
export const MessageType = {
  OPEN_TUNNEL: "open_tunnel",
  TUNNEL_OPENED: "tunnel_opened",
  REQUEST: "request",
  RESPONSE: "response",
  ERROR: "error",
  TCP_CONNECTION: "tcp_connection",
  TCP_DATA: "tcp_data",
  UDP_DATA: "udp_data",
  UDP_RESPONSE: "udp_response",
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

/**
 * Represents a request forwarded from the public tunnel
 */
export interface IncomingRequest {
  id: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Buffer | null;
}

/**
 * Represents a response sent back to the server
 */
export interface IncomingResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: Buffer | string;
}

/**
 * Internal response with ID
 */
export interface IncomingResponseWithId extends IncomingResponse {
  id: string;
}

/**
 * TCP connection message
 */
export interface TCPConnection {
  type: typeof MessageType.TCP_CONNECTION;
  connectionId: string;
}

/**
 * TCP data message
 */
export interface TCPData {
  type: typeof MessageType.TCP_DATA;
  connectionId: string;
  data: string; // Base64 encoded
}

/**
 * UDP data message
 */
export interface UDPData {
  type: typeof MessageType.UDP_DATA;
  packetId: string;
  data: string; // Base64 encoded
  sourceAddress: string;
  sourcePort: number;
}

/**
 * UDP response message
 */
export interface UDPResponse {
  type: typeof MessageType.UDP_RESPONSE;
  packetId: string;
  data: string; // Base64 encoded
}

/**
 * Open tunnel request message
 */
export interface OpenTunnelRequest {
  type: typeof MessageType.OPEN_TUNNEL;
  apiKey: string;
  protocol: string;
  remotePort: number;
}

/**
 * Server message types
 */
export interface TunnelOpenedMessage {
  type: typeof MessageType.TUNNEL_OPENED;
  url: string;
}

export interface ErrorMessage {
  type: typeof MessageType.ERROR;
  message: string;
}

export interface RequestMessage {
  type: typeof MessageType.REQUEST;
  requestId: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: string;
}

/**
 * Client configuration options
 */
export interface ClientOptions {
  /** Outray server URL */
  serverUrl?: string;
  /** API key for authentication */
  apiKey: string;
  /** Protocol type: "http", "tcp", or "udp" */
  protocol?: "http" | "tcp" | "udp";
  /** Local port to tunnel to */
  port: number;
  /** Callback when tunnel is established */
  onOpen?: (url: string) => void;
  /** HTTP request handler */
  onRequest?: (req: IncomingRequest) => IncomingResponse | Promise<IncomingResponse>;
  /** Error handler callback */
  onError?: (err: Error) => void;
  /** Custom logger */
  logger?: Logger;
}

/**
 * Logger interface
 */
export interface Logger {
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
}

/**
 * Default console logger
 */
export const defaultLogger: Logger = {
  info: (message, ...args) => console.log(`[outray] ${message}`, ...args),
  warn: (message, ...args) => console.warn(`[outray] ${message}`, ...args),
  error: (message, ...args) => console.error(`[outray] ${message}`, ...args),
};
