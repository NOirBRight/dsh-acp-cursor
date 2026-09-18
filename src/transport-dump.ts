const maxLineLength = 4096
const transportError =
  /^Error: (?:RetriableError: (?!\[internal\]).+|ConnectError: \[(?:unavailable|aborted|deadline_exceeded)\].*)$/
const serverError = 'Something went wrong communicating with the server. Please try again.'

interface ReplyState {
  disqualified: boolean
  failure: string | undefined
}

function consumeLine(state: ReplyState, line: string) {
  if (state.disqualified) return
  const text = line.trimEnd()
  if (transportError.test(text) || text === serverError) {
    state.failure = text
  } else if (text.trim() !== '' && !(state.failure && /^\s+at\s/.test(text))) {
    state.disqualified = true
    state.failure = undefined
  }
}

/** The dump line when assembled assistant text is only a Cursor ACP transport dump. */
export function standaloneTransportDump(text: string): string | undefined {
  const state: ReplyState = { disqualified: false, failure: undefined }
  let line = ''
  for (const [index, part] of text.split('\n').entries()) {
    if (state.disqualified) return undefined
    if (index > 0) {
      consumeLine(state, line)
      line = ''
    }
    if (line.length + part.length > maxLineLength) return undefined
    line += part
  }
  consumeLine(state, line)
  return state.failure
}
