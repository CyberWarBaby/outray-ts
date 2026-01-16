/**
 * Outray Client - Main WebSocket tunnel client implementation
 */

import WebSocket from "ws";
import net from "net";
import dgram from "dgram";
import http from "http";

import {
  ClientOptions,
  IncomingRequest,
  IncomingResponse,
  IncomingResponseWithId,
  Logger,
  MessageType,
  TCPData,
  UDPData,
  UDPResponse,
  defaultLogger,
} from "./types.js";

/**
 * Outray tunnel client that connects to the Outray server via WebSocket
 * and forwards requests to local services.
 */
export class Client {
  private readonly serverUrl: string;
  private readonly apiKey: string;
  private readonly protocol: "http" | "tcp" | "udp";
  private readonly port: number;
  private readonly remotePort: number;
  private readonly onOpen?: (url: string) => void;
  private readonly onRequest?: (req: IncomingRequest) => IncomingResponse | Promise<IncomingResponse>;
  private readonly onError?: (err: Error) => void;
  private readonly logger: Logger;

  private ws: WebSocket | null = null;
  private closed = false;
  private tcpConnections: Map<string, net.Socket> = new Map();

  constructor(options: ClientOptions) {
    this.serverUrl = options.serverUrl ?? "wss://api.outray.dev";
    this.apiKey = options.apiKey;
    this.protocol = options.protocol ?? "http";
    this.port = options.port;
    // For TCP/UDP, use remotePort if specified, otherwise 0 (server assigns)
    // For HTTP, remotePort is not used (server gives a subdomain)
    this.remotePort = options.remotePort ?? 0;
    this.onOpen = options.onOpen;
    this.onRequest = options.onRequest;
    this.onError = options.onError;
    this.logger = options.logger ?? defaultLogger;
  }

  /**
   * Connect to the Outray server with automatic reconnection.
   * Returns a promise that resolves when the connection is closed.
   */
  async connect(): Promise<void> {
    let backoff = 1000;
    const maxBackoff = 30000;

    while (!this.closed) {
      try {
        await this.connectOnce();
        backoff = 1000; // Reset backoff on successful connection
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.warn(`Connection error: ${error.message}. Retrying in ${backoff}ms...`);
        this.safeOnError(error);
        await this.sleep(backoff);
        backoff = Math.min(backoff * 2, maxBackoff);
      }
    }
  }

  /**
   * Establish a single WebSocket connection and process messages.
   */
  private connectOnce(): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.serverUrl, {
        perMessageDeflate: false,
      });

      this.ws = ws;
      this.closed = false;

      ws.on("open", () => {
        // Send handshake
        const handshake = {
          type: MessageType.OPEN_TUNNEL,
          apiKey: this.apiKey,
          protocol: this.protocol,
          remotePort: this.remotePort,
        };
        ws.send(JSON.stringify(handshake));

        // Set up ping interval
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.ping();
          }
        }, 9000);

        ws.on("close", () => {
          clearInterval(pingInterval);
          resolve();
        });
      });

      ws.on("message", (data) => {
        this.handleMessage(data.toString());
      });

      ws.on("error", (err) => {
        reject(err);
      });

      ws.on("close", () => {
        this.ws = null;
      });
    });
  }

  /**
   * Handle incoming WebSocket messages.
   */
  private handleMessage(rawData: string): void {
    try {
      const data = JSON.parse(rawData) as Record<string, unknown>;
      const msgType = data.type as string;

      switch (msgType) {
        case MessageType.TUNNEL_OPENED:
          if (this.onOpen) {
            this.safeCallback(() => this.onOpen!(data.url as string));
          }
          break;

        case MessageType.TCP_CONNECTION:
          this.handleTCPConnection(data.connectionId as string);
          break;

        case MessageType.TCP_DATA:
          this.handleTCPData(data.connectionId as string, data.data as string);
          break;

        case MessageType.UDP_DATA:
          this.handleUDPData(data as unknown as UDPData);
          break;

        case MessageType.REQUEST:
          this.handleRequest({
            id: data.requestId as string,
            method: data.method as string,
            path: data.path as string,
            headers: (data.headers as Record<string, string>) ?? {},
            body: data.body ? Buffer.from(data.body as string) : null,
          });
          break;

        case MessageType.ERROR:
          this.safeOnError(new Error(data.message as string));
          break;
      }
    } catch (err) {
      this.logger.error(`Failed to parse message: ${err}`);
    }
  }

  /**
   * Handle an incoming HTTP request.
   */
  private async handleRequest(req: IncomingRequest): Promise<void> {
    try {
      let resp: IncomingResponse;

      if (this.onRequest) {
        // Use custom handler
        resp = await Promise.resolve(this.onRequest(req));
      } else if (this.port > 0 && this.protocol === "http") {
        // Proxy to local service
        resp = await this.proxyHTTP(req);
      } else {
        resp = { statusCode: 501, body: "Not implemented" };
      }

      const respWithId: IncomingResponseWithId = {
        ...resp,
        id: req.id,
      };

      await this.sendResponse(respWithId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Error handling request: ${error.message}`);
      this.safeOnError(error);
    }
  }

  /**
   * Proxy an HTTP request to the local service.
   */
  private proxyHTTP(req: IncomingRequest): Promise<IncomingResponse> {
    return new Promise((resolve) => {
      const options: http.RequestOptions = {
        hostname: "localhost",
        port: this.port,
        path: req.path,
        method: req.method,
        headers: req.headers,
        timeout: 30000,
      };

      const proxyReq = http.request(options, (proxyRes) => {
        const chunks: Buffer[] = [];

        proxyRes.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        proxyRes.on("end", () => {
          const body = Buffer.concat(chunks);
          const headers: Record<string, string> = {};

          for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (typeof value === "string") {
              headers[key] = value;
            } else if (Array.isArray(value)) {
              headers[key] = value[0];
            }
          }

          resolve({
            statusCode: proxyRes.statusCode ?? 500,
            headers,
            body,
          });
        });
      });

      proxyReq.on("error", (err) => {
        resolve({
          statusCode: 502,
          body: `Proxy Error: ${err.message}`,
        });
      });

      proxyReq.on("timeout", () => {
        proxyReq.destroy();
        resolve({
          statusCode: 504,
          body: "Proxy Timeout",
        });
      });

      if (req.body) {
        proxyReq.write(req.body);
      }
      proxyReq.end();
    });
  }

  /**
   * Handle a new TCP connection from the tunnel server.
   */
  private handleTCPConnection(connId: string): void {
    const localSocket = net.createConnection(this.port, "localhost");

    this.tcpConnections.set(connId, localSocket);

    localSocket.on("data", (data) => {
      const msg: TCPData = {
        type: MessageType.TCP_DATA,
        connectionId: connId,
        data: data.toString("base64"),
      };

      if (this.ws && !this.closed) {
        this.ws.send(JSON.stringify(msg));
      }
    });

    localSocket.on("close", () => {
      this.tcpConnections.delete(connId);
    });

    localSocket.on("error", (err) => {
      this.safeOnError(err);
      localSocket.destroy();
      this.tcpConnections.delete(connId);
    });
  }

  /**
   * Handle incoming TCP data from the tunnel server.
   */
  private handleTCPData(connId: string, dataB64: string): void {
    const socket = this.tcpConnections.get(connId);
    if (!socket) return;

    const data = Buffer.from(dataB64, "base64");
    socket.write(data);
  }

  /**
   * Handle an incoming UDP packet from the tunnel server.
   */
  private handleUDPData(packet: UDPData): void {
    const socket = dgram.createSocket("udp4");
    const data = Buffer.from(packet.data, "base64");

    socket.on("message", (respData) => {
      const respMsg: UDPResponse = {
        type: MessageType.UDP_RESPONSE,
        packetId: packet.packetId,
        data: respData.toString("base64"),
      };

      if (this.ws && !this.closed) {
        this.ws.send(JSON.stringify(respMsg));
      }

      socket.close();
    });

    socket.on("error", (err) => {
      this.safeOnError(err);
      socket.close();
    });

    // Set timeout for UDP response
    const timeout = setTimeout(() => {
      socket.close();
    }, 5000);

    socket.on("close", () => {
      clearTimeout(timeout);
    });

    socket.send(data, this.port, "localhost");
  }

  /**
   * Send a response back to the server.
   */
  private sendResponse(resp: IncomingResponseWithId): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.closed) {
        reject(new Error("Client is closed"));
        return;
      }

      const body = resp.body instanceof Buffer ? resp.body.toString() : resp.body ?? "";

      const msg = {
        type: MessageType.RESPONSE,
        requestId: resp.id,
        statusCode: resp.statusCode,
        headers: resp.headers ?? {},
        body,
      };

      this.ws.send(JSON.stringify(msg), (err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Close the client connection.
   */
  async close(): Promise<void> {
    this.closed = true;

    // Close TCP connections
    for (const socket of this.tcpConnections.values()) {
      socket.destroy();
    }
    this.tcpConnections.clear();

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Safely execute a callback, catching any exceptions.
   */
  private safeCallback(fn: () => void): void {
    try {
      fn();
    } catch (err) {
      this.logger.error(`Callback error: ${err}`);
    }
  }

  /**
   * Safely call the error handler.
   */
  private safeOnError(err: Error): void {
    if (this.onError) {
      this.safeCallback(() => this.onError!(err));
    }
  }

  /**
   * Sleep for a given number of milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
