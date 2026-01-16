// Example: HTTP Tunnel with Outray TypeScript SDK
// Run with: npx tsx example.ts

import { Client } from "./src/index.js";
import * as dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.OUTRAY_API_KEY;

if (!apiKey) {
  console.error("Error: OUTRAY_API_KEY environment variable not set");
  process.exit(1);
}

console.log("Starting Outray HTTP tunnel...");

const client = new Client({
  serverUrl: "wss://api.outray.dev",
  apiKey: apiKey,
  protocol: "http",
  port: 3000, // Local port to tunnel (change if needed)
  onOpen: (url) => {
    console.log(`\n🚀 Tunnel is live!`);
    console.log(`   Public URL: ${url}`);
    console.log(`   Forwarding to: http://localhost:3000\n`);
  },
  onRequest: (req) => {
    console.log(`📥 ${req.method} ${req.path}`);
    
    // Return a simple response
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Hello from Outray TypeScript SDK!",
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString(),
      }),
    };
  },
  onError: (err) => {
    console.error(` Error: ${err.message}`);
  },
});

// Handle graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n👋 Shutting down tunnel...");
  await client.close();
  process.exit(0);
});

// Connect
client.connect().catch((err) => {
  console.error("Failed to connect:", err);
  process.exit(1);
});
