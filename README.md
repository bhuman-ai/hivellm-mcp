# hiveLLM MCP

Bring a real human expert into Codex or OpenCode without replacing the user's AI model or coding-account quota.

The MCP connector creates a hiveLLM room, carries user/AI/expert messages, and reports fixed-checkpoint status. The coding agent still runs in the user's own client. hiveLLM never receives the user's Codex, OpenAI, Anthropic, or OpenRouter credential.

## Use

After installing once, ask your coding agent directly:

> Use hiveLLM to get a product designer to review the onboarding flow.

The agent sends the relevant context already in the conversation, creates the room through MCP, and relays guidance between the expert and the coding agent. The room link is available for status, approvals, and fallback messaging; founders do not need to re-enter the task on a web form.

The first eligible expert request on an account automatically becomes a free starter task. It costs $0, is capped at 20 minutes of human work, and asks the founder for an honest rating when complete. Later requests begin with free intake; any paid work requires approval of a fixed-price checkpoint before it starts.

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

`hivellm_check_availability` reports whether the authenticated account still has its free starter task. `hivellm_request_expert` then returns the server-confirmed room type. If it is not a starter task, an expert can propose a fixed-price checkpoint, but paid work does not begin until the user approves it in the room.

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
