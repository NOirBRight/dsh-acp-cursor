# Match Cursor interactive retry at the ACP boundary

Cursor's interactive agent retries HTTP/2 `CANCEL` / Connect drops internally. ACP instead leaks a **transport dump** as assistant text and a successful `end_turn`. We cannot retry inside `cursor-agent`'s Run. The matching observable behavior is: do not treat the dump as the answer. A dump-only reply recycles the dead ACP session and, in the same Host stream, **replays** the same user prompt once on a `session/load`ed process. A dump that arrives as the last line after a real answer is stripped and the turn stays completed — that leak is teardown, not a missing reply. `ConnectError: [canceled]` is the same HTTP/2 `CANCEL (0x8)` leak as `RetriableError: [canceled]`. Host retry stays off. We do not send a special continuation prompt after tools.

**Status:** accepted

**Considered options:** fail and wait for the next user message; a recovery turn with a continuation instruction when tools already ran; Host `maxRetries`; same-connection `session/prompt` without recycle. Rejected: waiting still interrupts; a continuation prompt is not what Cursor retries; Host retry cannot tell dumps from other failures; `CANCEL (0x8)` means the HTTP/2 stream is already gone.
