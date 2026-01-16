/**
 * Tests for Outray client
 */

import { describe, it, expect } from "vitest";
import { Client } from "./client.js";
import { MessageType, defaultLogger } from "./types.js";

describe("Client", () => {
  it("should create client with default options", () => {
    const client = new Client({
      apiKey: "test-key",
      port: 8080,
    });

    expect(client).toBeInstanceOf(Client);
  });

  it("should create client with custom options", () => {
    const openedUrls: string[] = [];
    const errors: Error[] = [];

    const client = new Client({
      serverUrl: "ws://localhost:8080",
      apiKey: "test-key",
      protocol: "tcp",
      port: 5432,
      onOpen: (url) => openedUrls.push(url),
      onError: (err) => errors.push(err),
    });

    expect(client).toBeInstanceOf(Client);
  });
});

describe("MessageType", () => {
  it("should have correct message type values", () => {
    expect(MessageType.OPEN_TUNNEL).toBe("open_tunnel");
    expect(MessageType.TUNNEL_OPENED).toBe("tunnel_opened");
    expect(MessageType.REQUEST).toBe("request");
    expect(MessageType.RESPONSE).toBe("response");
    expect(MessageType.ERROR).toBe("error");
    expect(MessageType.TCP_CONNECTION).toBe("tcp_connection");
    expect(MessageType.TCP_DATA).toBe("tcp_data");
    expect(MessageType.UDP_DATA).toBe("udp_data");
    expect(MessageType.UDP_RESPONSE).toBe("udp_response");
  });
});

describe("defaultLogger", () => {
  it("should have all required methods", () => {
    expect(defaultLogger.info).toBeInstanceOf(Function);
    expect(defaultLogger.warn).toBeInstanceOf(Function);
    expect(defaultLogger.error).toBeInstanceOf(Function);
  });
});
