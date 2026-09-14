## v0.1.17

- `user/message` never reads `data.turn`. Plugin injects bind only via `source.kind === 'plugin'` and the open native turn.

## v0.1.16

- Bind plugin context-injection `user/message` events (no `turn` field) to the open native turn so the mixed timeline still sits after AGENTS.md / skill-catalog. Keep a single `turn/start` start Match so history still loads.

## v0.1.15

- Start the native-turn Chat node on `turn/start` only. A later `step/start` in the same turn is an update, so the assembler no longer drops the whole transcript.

## v0.1.14

- Native tools use DSH DisclosureRow chrome (Read / Search / Bash), not a custom JSON dump card.
- Parent thought/text stay on the sidecar with tools, in first-seen order, after context injection. Not DSH `tool/call` events.

## v0.1.13

- Composer 2.5 uses Cursor's published 200k default.
- Expand/collapse follows the per-row set. Fetch no longer forces every row open, so the chevron can close a row.
- Fill remaining catalog windows from Cursor model docs (GPT-5.x 272k, Claude 4.x 200k, Gemini 200k/1M, Kimi K2.7 262k, GLM 5.2 200k). Account default stays unknown.

## v0.1.12

- Context windows: advertised ACP `context` option, then Cursor published defaults (Kimi K3 200k, Grok 256k, GPT-5.6 272k, Claude Fable/Opus 5 300k, `-1m` suffix 1M), otherwise unknown. Stop inventing 200k.
- Fetch offers documented Max rows when ACP omits a context selector (Kimi K3 Max). Selecting them never sends an unadvertised context value.

## v0.1.11

- Fill missing parameterized context budgets from the existing family defaults; advertised native contexts and saved overrides still take precedence. Defaults are marked as defaults, not native facts.
- Display the native provider as Cursor while preserving the distinct `cursor-agent` route ID.
- Lab Model Switch rebuild upgrades its bundled shared icon library to 0.2.6, which already recognizes the Cursor ACP alias.

## v0.1.10

- Put sign-in/cancel actions in the shared account card; show the CLI account identity.
- Gate quota on ACP authentication, invalidate rotated credentials, and show all Cursor/Other Models windows. No LLM credential file is read.
- Mount the model selection overlay in shared detail; fetch does not adopt models. Preserve edits and group choices by brand.
- Notify the official Host registry after catalog changes; cold model loads wait for discovery. Catalog-only saves no longer dispose active sessions.
- Use official `cursor/list_available_models` and parameterized ACP configuration for Fast, context and effort. Internal Max IDs are never sent as native model values; selections survive subsequent turns.
- Keep native model preferences in the ACP profile via `CURSOR_CONFIG_DIR`, separate from the global CLI token store.

## v0.1.9

- Settings detail uses the shared `ProviderDetail` template (`dsh-llm-providers-ui` 0.2.2): `items` + `extra`, no bundled card chrome.
- Saved catalog membership/overrides project to Host `listModels` / `resolveModel`.
- One-click official CLI install, `cursor-agent login` for ACP and dashboard quota, `cursor-agent logout` on sign-out.
- Plugin-owned read-only native tool card; private `ui-tool` native.1 dependency removed.
- Host `@deepseek-ai/dsh-*` peers are `*` (optional); compile target remains 0.1.5-rc.1.
