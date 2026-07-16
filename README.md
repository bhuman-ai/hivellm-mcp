# hiveLLM MCP

Bring a real human expert into Codex or OpenCode without replacing the user's AI model or coding-account quota.

The MCP connector creates a hiveLLM room, carries user/AI/expert messages, and reports fixed-checkpoint status. The coding agent still runs in the user's own client. hiveLLM never receives the user's Codex, OpenAI, Anthropic, or OpenRouter credential.

## Install

The shortest path is [hivellm.com/install](https://www.hivellm.com/install). Sign in, choose Codex or OpenCode, and run the generated command.

Until the npm package is published, a clean manual install uses GitHub:

```bash
npm install -g github:bhuman-ai/hivellm-mcp
HIVELLM_API_KEY=your_key hivellm-mcp install codex
```

For OpenCode:

```bash
npm install -g github:bhuman-ai/hivellm-mcp
HIVELLM_API_KEY=your_key hivellm-mcp install opencode
```

The OpenCode installer adds the `hivellm` MCP entry and removes the recognized legacy `castellar-human` adapter if present. It does not change the selected model, provider, or unrelated MCP servers.

## Tools

- `hivellm_check_availability`
- `hivellm_request_expert`
- `hivellm_get_room`
- `hivellm_wait_for_expert`
- `hivellm_send_user_message`
- `hivellm_report_ai_progress`
- `hivellm_submit_rating`

Creating a room starts free intake. An expert can propose a fixed-price checkpoint, but paid work does not begin until the user approves it in the room.

## Verify

```bash
hivellm-mcp doctor
codex mcp get hivellm
```

For OpenCode, restart the client and run `opencode mcp list`.

## Development

```bash
npm install
npm test
```
