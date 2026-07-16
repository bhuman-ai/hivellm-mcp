import test from "node:test";
import assert from "node:assert/strict";
import { callHiveTool, HIVELLM_TOOLS } from "../src/tools.js";

const config = {
  apiBase: "https://www.hivellm.com/api/human",
  apiKey: "hive_test_key",
  clientName: "Test client",
};

function room(overrides = {}) {
  return {
    id: "42",
    room_url: "https://www.hivellm.com/room/42?token=test",
    title: "Dashboard review",
    status: "waiting",
    task: "Review the dashboard",
    operator: null,
    billing: { mode: "fixed_checkpoint", status: "idle", checkpoint: null },
    starter_task: null,
    latest_message_id: "m1",
    messages: [{ id: "m1", actor: "user", content: "Review the dashboard", at: "2026-07-16T10:00:00Z", metadata: { to: "room" } }],
    rating: null,
    ...overrides,
  };
}

test("exposes a small, hiveLLM-branded tool surface", () => {
  assert.deepEqual(HIVELLM_TOOLS.map((tool) => tool.name), [
    "hivellm_check_availability",
    "hivellm_request_expert",
    "hivellm_get_room",
    "hivellm_wait_for_expert",
    "hivellm_send_user_message",
    "hivellm_report_ai_progress",
    "hivellm_submit_rating",
  ]);
});

test("frontloads known task context when requesting an expert", async () => {
  let captured;
  const result = await callHiveTool(config, "hivellm_request_expert", {
    task: "Fix the onboarding UI",
    desired_outcome: "A clear first-run flow",
    current_state: "The AI generated six competing cards",
    constraints: "Keep the existing API",
    skill: "product design",
    tool: "Codex",
  }, {
    request: async (method, path, body) => {
      captured = { method, path, body };
      return room();
    },
  });

  assert.equal(captured.method, "POST");
  assert.equal(captured.path, "/human/rooms");
  assert.match(captured.body.task, /Desired outcome: A clear first-run flow/);
  assert.match(captured.body.task, /Current state: The AI generated six competing cards/);
  assert.match(captured.body.task, /Requested expertise: product design/);
  assert.equal(result.structuredContent.room_url.includes("hivellm.com/room/42"), true);
});

test("reports a server-confirmed free starter task", async () => {
  const result = await callHiveTool(config, "hivellm_request_expert", {
    task: "Review the onboarding UI",
    tool: "Codex",
  }, {
    request: async () => room({
      starter_task: {
        status: "available",
        max_human_minutes: 20,
        customer_price_cents: 0,
        requires_rating: true,
      },
    }),
  });

  assert.deepEqual(result.structuredContent.starter_task, {
    status: "available",
    max_human_minutes: 20,
    customer_price_cents: 0,
    requires_rating: true,
  });
  assert.match(result.content[0].text, /free starter task/);
  assert.match(result.content[0].text, /20 human minutes/);
  assert.match(result.content[0].text, /\$0/);
});

test("does not imply a free task when the server returns normal intake", async () => {
  const result = await callHiveTool(config, "hivellm_request_expert", {
    task: "Review the settings UI",
  }, {
    request: async () => room(),
  });

  assert.equal(result.structuredContent.starter_task, null);
  assert.match(result.content[0].text, /free intake/);
  assert.match(result.content[0].text, /user approves a fixed-price checkpoint/);
});

test("distinguishes expert questions for the user from AI instructions", async () => {
  const expertQuestion = {
    id: "m2",
    actor: "human",
    content: "Which screen matters most?",
    at: "2026-07-16T10:01:00Z",
    metadata: { to: "user" },
  };
  const result = await callHiveTool(config, "hivellm_wait_for_expert", {
    room_id: "42",
    after_message_id: "m1",
    timeout_seconds: 1,
  }, {
    request: async () => room({ status: "active", messages: [...room().messages, expertQuestion], latest_message_id: "m2" }),
  });

  assert.equal(result.structuredContent.timed_out, false);
  assert.equal(result.structuredContent.questions_for_user.length, 1);
  assert.equal(result.structuredContent.instructions_for_ai.length, 0);
  assert.match(result.content[0].text, /Show it to the user/);
});

test("reports AI progress as AI instead of impersonating the user", async () => {
  let captured;
  await callHiveTool(config, "hivellm_report_ai_progress", {
    room_id: "42",
    content: "Implemented the simplified mobile state.",
  }, {
    request: async (method, path, body) => {
      captured = { method, path, body };
      return room();
    },
  });

  assert.equal(captured.path, "/human/rooms/42/ai-message");
  assert.equal(captured.body.content, "Implemented the simplified mobile state.");
});
