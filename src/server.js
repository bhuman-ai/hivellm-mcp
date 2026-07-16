import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { callHiveTool, HIVELLM_TOOLS } from "./tools.js";
import { VERSION } from "./version.js";

export const SERVER_INSTRUCTIONS = [
  "hiveLLM connects this AI client to a real human expert.",
  "Only request an expert when the user asks for one or explicitly agrees after seeing availability.",
  "Call hivellm_check_availability before hivellm_request_expert so the user can see whether their one-time free starter task is available.",
  "The request response is authoritative: it confirms whether the room is a free starter task capped at 20 human minutes or normal free intake.",
  "Paid work cannot begin until the user approves a fixed-price checkpoint in the room; a confirmed starter task is free.",
  "Pass context already known from the conversation when requesting an expert; do not make the user repeat it.",
  "After creating a room, show the room_url to the user, wait for expert messages, follow AI-directed guidance, and report meaningful progress.",
  "Never answer a human expert's user-directed question on the user's behalf.",
].join(" ");

export function createHiveMcpServer(config, options = {}) {
  const callTool = options.callTool || ((name, args) => callHiveTool(config, name, args));
  const server = new Server(
    { name: "hivellm", version: VERSION },
    {
      capabilities: { tools: {} },
      instructions: SERVER_INSTRUCTIONS,
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: HIVELLM_TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await callTool(request.params.name, request.params.arguments || {});
    } catch (error) {
      return {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      };
    }
  });

  return server;
}

export async function runStdioServer(config) {
  const server = createHiveMcpServer(config);
  await server.connect(new StdioServerTransport());
  return server;
}
