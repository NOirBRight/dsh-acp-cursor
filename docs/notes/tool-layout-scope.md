# Native tool expansion: release scope

## Human requirements

1. “目前sse内容点击展开后，布局和原版有很大的不同。” / “需要分类统一” — native Cursor activity must use category-appropriate expanded presentation consistent with the original DSH tool UI, rather than two generic JSON code blocks for every tool.
2. “未发送图片切会话丢失，这个撤回不改了，只改工具展开布局” — image-draft retention is withdrawn. Do not change DSH core or add an attachment-retention plugin.
3. “审核修复循环，直到问题清零，然后发布，并部署到3080” — review Standards and Spec independently, fix actionable findings, re-review, test, publish and verify the existing GUI at port 3080.
4. The approved baseline is `v0.1.23`. Preserve its native-history retention and other already-published behavior.

## Acceptance

- Known Read, Edit/Write and Shell payloads use DSH's existing read/diff/terminal primitives. TODO and tools without a compatible structured payload use one compact IN/OUT surface with the original payload still inspectable. Do not invent missing search results or web metadata.
- Match real Cursor names, TODO statuses and ACP text/diff envelopes. Errors, empty outputs, malformed or legacy-truncated payloads must not hide useful input/output or look like successful file contents. Keep the existing bounded history size; previews must clearly mark truncation.
- Cards remain display-only. No native tool is converted into an executable DSH call. Retain disclosure keyboard accessibility, readable narrow layouts and the primitives' copy behavior.
- Regression checks cover real payload shapes. Real-browser E2E exercises the actual installed plugin and records screenshots; no mocked tool RPC responses count as live acceptance.
- The published artifact is built from the reviewed release source. Installed and browser-served plugin code must match that artifact. The DSH conversation bundle must be the official package again.

## Boundary

The earlier image-draft patch and its successful E2E are historical, not part of this release or its claims. Browser refresh persistence, changing the ACP protocol/CLI, and reworking native history are out of scope. Existing image-send support and history tests from v0.1.23 are retained unchanged.
