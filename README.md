# @deepseek-ai/dsh-acp-cursor

Official `cursor-agent acp` as a DeepSeek Harness native agent.

DSH is the shell (chat, approvals, filesystem). Cursor owns the turn and tools. Stock ACP chrome: plugin-owned read-only tool cards, no usage footer. Other cancels the native question and sends the text as a later prompt on the same session.

This is **not** `dsh-llm-cursor` (unofficial chat route, provider `cursor`). This plugin registers provider `cursor-agent`.

## Install

Requires `dsh-llm-providers-ui` 0.2.8 on the Host (shared ProviderDetail template). `dsh-acp-provider` is a profile dependency with no bundle of its own.

`catalogId` / `binding` and the unresolved `unknown` account state are attached at runtime. Published 0.2.8 types omit those fields; they only take effect on a newer Owner.

```sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-llm-providers-ui/releases/download/v0.2.9/dsh-llm-providers-ui-0.2.9.tgz \
  https://github.com/NOirBRight/dsh-acp-provider/releases/download/v0.1.4/deepseek-ai-dsh-acp-provider-0.1.4.tgz \
  https://github.com/NOirBRight/dsh-acp-cursor/releases/download/v0.1.19/deepseek-ai-dsh-acp-cursor-0.1.19.tgz
```

Missing CLI: Settings → Cursor → Install (official `curl https://cursor.com/install`). Sign-in is `cursor-agent login` (DeepControl link; host does not open a browser). Quota uses the same CLI token. Sign-out runs `cursor-agent logout` on this machine.

## Account and models

ACP adopts the official CLI login on this host; it does not read the separate `dsh-llm-cursor` OAuth file. Ambient `CURSOR_API_KEY` is not used. Signing out also signs out that host CLI. Quota is hidden when ACP is not authenticated.

Fetch available models opens a selection dialog. Apply chooses draft rows; Save publishes them to Model Switch. Context prefers the advertised ACP `context` option, then Cursor published defaults, otherwise unknown. Fetch also offers documented Max rows (for example Kimi K3 1M) without sending unadvertised context parameters. Requires the official `cursor/list_available_models` extension (verified with Cursor Agent 2026.09.02-c22c1a3).

## Verify

```sh
pnpm install
pnpm run check
```
