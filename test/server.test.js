import test from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createHiveMcpServer, SERVER_INSTRUCTIONS } from "../src/server.js";

test("completes the official MCP initialize, list, and call flow", async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createHiveMcpServer({}, {
    callTool: async (name) => ({
      content: [{ type: "text", text: `called ${name}` }],
      structuredContent: { called: name },
    }),
  });
  const client = new Client({ name: "hivellm-test", version: "1.0.0" }, { capabilities: {} });

  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const tools = await client.listTools();
    const result = await client.callTool({ name: "hivellm_check_availability", arguments: {} });

    assert.deepEqual(client.getServerVersion(), { name: "hivellm", version: "0.1.2" });
    assert.match(client.getInstructions(), /Paid work cannot begin/);
    assert.equal(tools.tools.length, 7);
    assert.equal(result.structuredContent.called, "hivellm_check_availability");
    assert.match(SERVER_INSTRUCTIONS, /do not make the user repeat it/i);
  } finally {
    await client.close();
    await server.close();
  }
});
