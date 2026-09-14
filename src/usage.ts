/** Stock ACP usage is discarded for Agent chrome. Keep parsers for mapping no-ops. */
import type { TokenUsage } from '@deepseek-ai/dsh-llm'

export function reportedUsage(_value: unknown): TokenUsage | undefined {
  return undefined
}

export function sumTurnUsage(_first: TokenUsage | undefined, _second: TokenUsage | undefined): TokenUsage | undefined {
  return undefined
}

export function acpUsage(_value: unknown): TokenUsage | undefined {
  return undefined
}
