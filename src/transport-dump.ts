import { redactCursorAgentText } from './auth.js'

const dumpLine =
  /^Error: (?:RetriableError: (?!\[internal\] Failed to run step, exceeded max retries).+|ConnectError: \[(?:unavailable|aborted|deadline_exceeded)\].*)$/
const cursorServerCopy = 'Something went wrong communicating with the server. Please try again.'

/** The dump line when assembled assistant text is only a Cursor ACP transport dump. */
export function standaloneTransportDump(text: string): string | undefined {
  let dump: string | undefined
  for (const raw of text.split('\n')) {
    const line = raw.trimEnd()
    if (dumpLine.test(line) || line === cursorServerCopy) dump = line
    else if (line.trim() !== '' && !(dump && /^\s+at\s/.test(line))) return undefined
  }
  return dump
}

/** True when a native turn already failed as a transport dump (error is the redacted dump line). */
export function dumpFailedNativeTurn(result: { status: string, text: string, error?: string }): boolean {
  if (result.status !== 'failed' || result.error === undefined) return false
  const dump = standaloneTransportDump(result.text)
  return dump !== undefined && result.error === redactCursorAgentText(dump)
}
