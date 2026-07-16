import { callHiveApi } from "./api.js";

function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asNumber(value, fallback = undefined) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toolResult(summary, data) {
  return {
    content: [{ type: "text", text: `${summary}\n\n${JSON.stringify(data, null, 2)}` }],
    structuredContent: data,
  };
}

function roomForClient(room, input = {}) {
  const sinceMessageId = asText(input.since_message_id);
  const messages = Array.isArray(room?.messages) ? room.messages : [];
  const foundIndex = sinceMessageId ? messages.findIndex((message) => message.id === sinceMessageId) : -1;
  const visibleMessages = sinceMessageId && foundIndex >= 0 ? messages.slice(foundIndex + 1) : messages;

  return {
    id: String(room.id),
    room_url: room.room_url || null,
    title: room.title,
    status: room.status,
    task: room.task,
    operator: room.operator || null,
    billing: room.billing || null,
    latest_message_id: messages.at(-1)?.id || null,
    messages: visibleMessages.map((message) => ({
      id: message.id,
      actor: message.actor,
      content: message.content,
      at: message.at,
      to: message.metadata?.to || message.to || null,
    })),
    rating: room.rating || null,
  };
}

function taskBrief(args) {
  const sections = [
    ["Task", asText(args.task)],
    ["Desired outcome", asText(args.desired_outcome)],
    ["Current state", asText(args.current_state)],
    ["Relevant context", asText(args.relevant_context)],
    ["Constraints", asText(args.constraints)],
    ["Requested expertise", asText(args.skill)],
  ].filter(([, value]) => value);

  return sections.map(([label, value]) => `${label}: ${value}`).join("\n\n");
}

export const HIVELLM_TOOLS = [
  {
    name: "hivellm_check_availability",
    description: "Check whether a vetted hiveLLM expert is available and show the pricing rules. Use this before requesting an expert.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "hivellm_request_expert",
    description: "Start free intake and request a real human expert for the current task. This cannot start paid work; the user must approve any fixed-price checkpoint in the room first. Include context already present in the conversation instead of asking the user to repeat it.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["task"],
      properties: {
        task: { type: "string", description: "Plain-English description of what needs human judgment." },
        title: { type: "string", description: "Short room title." },
        desired_outcome: { type: "string", description: "The concrete result the user wants." },
        current_state: { type: "string", description: "What has already been tried, built, or decided." },
        relevant_context: { type: "string", description: "Known files, URLs, screenshots, errors, or project facts relevant to the expert." },
        constraints: { type: "string", description: "Important limits, preferences, deadlines, or things that must not change." },
        skill: { type: "string", description: "Requested specialty, such as product design, frontend, debugging, legal, or QA." },
        tool: { type: "string", description: "The AI client currently running, such as Codex, OpenCode, or Claude Code." },
      },
    },
  },
  {
    name: "hivellm_get_room",
    description: "Read the current expert, checkpoint status, and new user, human, and AI messages from a hiveLLM room.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["room_id"],
      properties: {
        room_id: { type: "string" },
        since_message_id: { type: "string", description: "Return only messages after this message ID." },
      },
    },
  },
  {
    name: "hivellm_wait_for_expert",
    description: "Wait for a new expert message. If the expert asks the user a question, show it to the user and do not answer on their behalf. If the expert directs the AI, follow the instruction and report progress.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["room_id"],
      properties: {
        room_id: { type: "string" },
        after_message_id: { type: "string", description: "The latest_message_id from the prior room response." },
        timeout_seconds: { type: "number", minimum: 1, maximum: 120, description: "How long to wait. Defaults to 30 seconds." },
      },
    },
  },
  {
    name: "hivellm_send_user_message",
    description: "Send a message to the expert only when the user explicitly asked you to relay that message. Never invent or answer for the user.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["room_id", "content"],
      properties: {
        room_id: { type: "string" },
        content: { type: "string" },
      },
    },
  },
  {
    name: "hivellm_report_ai_progress",
    description: "Report the AI coding agent's progress, evidence, question, or result to the human expert in the room.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["room_id", "content"],
      properties: {
        room_id: { type: "string" },
        content: { type: "string" },
      },
    },
  },
  {
    name: "hivellm_submit_rating",
    description: "Submit the user's rating after the expert checkpoint is complete.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["room_id", "rating"],
      properties: {
        room_id: { type: "string" },
        rating: { type: "number", minimum: 1, maximum: 5 },
        comment: { type: "string" },
      },
    },
  },
];

export async function callHiveTool(config, name, rawArgs = {}, options = {}) {
  const args = asRecord(rawArgs);
  const request = options.request || ((method, path, body, requestOptions) =>
    callHiveApi(config, method, path, body, requestOptions));
  const wait = options.sleep || sleep;

  if (name === "hivellm_check_availability") {
    const offer = await request("GET", "/human/offer", null, { allowAnonymous: true });
    return toolResult(offer.line, offer);
  }

  if (name === "hivellm_request_expert") {
    const task = asText(args.task);
    if (!task) throw new Error("task is required.");
    const brief = taskBrief(args);
    const room = await request("POST", "/human/rooms", {
      task: brief,
      title: asText(args.title, task.slice(0, 100)),
      tool: asText(args.tool, config.clientName),
    });
    const data = roomForClient(room);
    return toolResult(
      `hiveLLM room ${room.id} is ready. Share the room link with the user, then wait for the expert with hivellm_wait_for_expert.`,
      data
    );
  }

  if (name === "hivellm_get_room") {
    const roomId = asText(args.room_id);
    if (!roomId) throw new Error("room_id is required.");
    const room = await request("GET", `/human/rooms/${encodeURIComponent(roomId)}`);
    const data = roomForClient(room, args);
    return toolResult(`hiveLLM room ${room.id} is ${room.status}.`, data);
  }

  if (name === "hivellm_wait_for_expert") {
    const roomId = asText(args.room_id);
    if (!roomId) throw new Error("room_id is required.");
    const afterMessageId = asText(args.after_message_id);
    const timeoutSeconds = Math.max(1, Math.min(120, asNumber(args.timeout_seconds, 30)));
    const deadline = Date.now() + timeoutSeconds * 1000;
    let room;

    do {
      room = await request("GET", `/human/rooms/${encodeURIComponent(roomId)}`);
      const data = roomForClient(room, { since_message_id: afterMessageId });
      const humanMessages = data.messages.filter((message) => message.actor === "human");

      if (humanMessages.length || room.status === "done" || room.status === "cancelled") {
        const questionsForUser = humanMessages.filter((message) => message.to === "user");
        const instructionsForAi = humanMessages.filter((message) => message.to !== "user");
        const result = {
          ...data,
          timed_out: false,
          human_messages: humanMessages,
          questions_for_user: questionsForUser,
          instructions_for_ai: instructionsForAi,
        };
        const summary = questionsForUser.length
          ? "The expert asked the user a question. Show it to the user and wait for their answer."
          : instructionsForAi.length
            ? "The expert sent guidance. Follow it, then report progress with hivellm_report_ai_progress."
            : `hiveLLM room ${room.id} is ${room.status}.`;
        return toolResult(summary, result);
      }

      if (Date.now() < deadline) {
        await wait(Math.min(5000, deadline - Date.now()));
      }
    } while (Date.now() < deadline);

    return toolResult("No new expert message yet.", {
      ...roomForClient(room),
      timed_out: true,
      human_messages: [],
      questions_for_user: [],
      instructions_for_ai: [],
    });
  }

  if (name === "hivellm_send_user_message" || name === "hivellm_report_ai_progress") {
    const roomId = asText(args.room_id);
    const content = asText(args.content);
    if (!roomId) throw new Error("room_id is required.");
    if (!content) throw new Error("content is required.");
    const route = name === "hivellm_send_user_message" ? "user-message" : "ai-message";
    const room = await request("POST", `/human/rooms/${encodeURIComponent(roomId)}/${route}`, { content });
    const data = roomForClient(room);
    const summary = name === "hivellm_send_user_message"
      ? `User message sent to hiveLLM room ${room.id}.`
      : `AI progress sent to hiveLLM room ${room.id}.`;
    return toolResult(summary, data);
  }

  if (name === "hivellm_submit_rating") {
    const roomId = asText(args.room_id);
    const rating = asNumber(args.rating);
    if (!roomId) throw new Error("room_id is required.");
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new Error("rating must be an integer from 1 to 5.");
    }
    const room = await request("POST", `/human/rooms/${encodeURIComponent(roomId)}/rating`, {
      rating,
      comment: asText(args.comment),
    });
    const data = roomForClient(room);
    return toolResult(`Rating submitted for hiveLLM room ${room.id}.`, data);
  }

  throw new Error(`Unknown hiveLLM tool: ${name}`);
}
