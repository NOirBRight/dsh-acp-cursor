import { describe, expect, it } from 'vitest'
import { dumpFailedNativeTurn, standaloneTransportDump } from '../src/transport-dump.js'

const DUMP = 'Error: ConnectError: [unavailable] transport closed'

describe('activity compatibility with native transport classification', () => {
  it('keeps standalone dump failure classification unchanged', () => {
    expect(standaloneTransportDump(DUMP)).toBe(DUMP)
    expect(dumpFailedNativeTurn({ status: 'failed', text: DUMP, error: DUMP })).toBe(true)
    expect(dumpFailedNativeTurn({ status: 'completed', text: DUMP, error: DUMP })).toBe(false)
  })
})
