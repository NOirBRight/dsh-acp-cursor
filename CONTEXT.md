# CursorAgent ACP

Official `cursor-agent acp` as a DeepSeek Harness native agent. DSH is the shell; Cursor owns the turn and tools. This is not the unofficial `dsh-llm-cursor` chat route.

## Language

**Native turn**:
One `session/prompt` cycle on a live CursorAgent ACP session.
_Avoid_: request, generation, run (those belong to `dsh-llm-cursor`)

**Transport dump**:
A Cursor ACP assistant reply that is only a leaked transport diagnostic, not an answer. Typical forms include `RetriableError`, `ConnectError` with unavailable/aborted/deadline_exceeded, HTTP/2 `CANCEL (0x8)`, and Cursor's "Something went wrong communicating with the server" copy.
_Avoid_: retryable error, exception, server error (those mix agent-loop failures with transport)

**Failed native turn**:
A native turn whose result status is `failed`. The turn runner then disposes that ACP session; the next native turn opens a new process and resumes with the saved resume cursor.
_Avoid_: completed answer (a transport dump is not an answer)

**Replay**:
A new native turn that sends the same user prompt after a failed transport dump. This is the ACP-visible stand-in for Cursor's interactive agent retrying the dropped HTTP/2 stream. It is not Host retry.
_Avoid_: recovery turn, continuation prompt (those invent a second user instruction Cursor itself does not send)

**Resume cursor**:
The opaque native session identifier persisted on the DSH session so a later ACP process can `session/load` the same Cursor conversation.
_Avoid_: session id (ambiguous between DSH and Cursor)

**Activity sequence cursor**:
The exclusive numeric `seq` position used only to page a CursorAgent activity JSONL history. It is not a Resume cursor and never identifies a native session; `afterSeq` requests records after it and `nextCursor` advances it.
_Avoid_: Resume cursor for this JSONL position; session id for this number

**Activity stale cursor**:
A requested Activity sequence cursor that cannot be continued because the history is ahead of it, deleted, or otherwise requires a bounded full-history resynchronization.
_Avoid_: stale Resume cursor (the native session binding remains unchanged)
