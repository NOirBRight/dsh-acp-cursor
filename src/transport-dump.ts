import { redactCursorAgentText } from './auth.js'

const dumpLine =
  /^Error: (?:RetriableError: (?!\[internal\] Failed to run step, exceeded max retries).+|ConnectError: \[(?:unavailable|aborted|canceled|deadline_exceeded)\].*)$/
const cursorServerCopy = 'Something went wrong communicating with the server. Please try again.'
const dumpPrefixes = [
  'Error: RetriableError:',
  'Error: ConnectError: [unavailable]',
  'Error: ConnectError: [aborted]',
  'Error: ConnectError: [canceled]',
  'Error: ConnectError: [deadline_exceeded]',
  cursorServerCopy,
] as const

function isDumpLine(line: string): boolean {
  const trimmed = line.trimEnd()
  return dumpLine.test(trimmed) || trimmed === cursorServerCopy
}

function isStackFrame(line: string): boolean {
  return /^\s+at\s/.test(line)
}

function isDumpPrefix(partial: string): boolean {
  if (partial === '') return false
  const line = partial.trimEnd()
  if (isDumpLine(line)) return true
  return dumpPrefixes.some(prefix => prefix.startsWith(line) || line.startsWith(prefix))
}

/** Trailing Cursor ACP transport dump, if the last non-stack line is only that leak. */
export function transportDump(text: string): { dump: string; body: string } | undefined {
  const lines = text.split('\n')
  let end = lines.length
  while (end > 0) {
    const line = lines[end - 1]
    if (line === undefined || (line.trim() !== '' && !isStackFrame(line))) break
    end -= 1
  }
  const last = lines[end - 1]?.trimEnd()
  if (last === undefined || !isDumpLine(last)) return undefined
  let start = end - 1
  while (start > 0) {
    const line = lines[start - 1]
    if (line === undefined || !(isDumpLine(line) || isStackFrame(line) || line.trim() === '')) break
    start -= 1
  }
  while (start < end - 1 && lines[start]?.trim() === '') start += 1
  return { dump: last, body: lines.slice(0, start).join('\n').replace(/\n+$/, '') }
}

/** The dump line when assembled assistant text is only a Cursor ACP transport dump. */
export function standaloneTransportDump(text: string): string | undefined {
  const found = transportDump(text)
  return found !== undefined && found.body === '' ? found.dump : undefined
}

/** Assistant text with a trailing transport dump (or an in-progress dump line) removed. */
export function visibleAssistantText(text: string): string {
  const found = transportDump(text)
  if (found !== undefined) return found.body
  const lastNl = text.lastIndexOf('\n')
  const tail = lastNl === -1 ? text : text.slice(lastNl + 1)
  if (!isDumpPrefix(tail)) return text
  return lastNl === -1 ? '' : text.slice(0, lastNl).replace(/\n+$/, '')
}

/** True when a native turn already failed as a transport dump (error is the redacted dump line). */
export function dumpFailedNativeTurn(result: { status: string, text: string, error?: string }): boolean {
  if (result.status !== 'failed' || result.error === undefined) return false
  const dump = standaloneTransportDump(result.text)
  return dump !== undefined && result.error === redactCursorAgentText(dump)
}
