// Public list price checked 2026-09-22: https://docs.typesafe.ai/models
// Use the response's versioned model, never assume an alias keeps its price.
const inputUsdPerMillion: Record<string, number> = { "jev-1.13.0": 0.042 }

export function createUsageTotals() {
  let cost = 0
  let responses = 0
  let incomplete = false
  return {
    add(response: unknown) {
      responses++
      const result = response as {
        model?: string
        usage?: { input_tokens?: number; output_tokens?: number }
      } | null
      const input = result?.usage?.input_tokens
      const rate = result?.model ? inputUsdPerMillion[result.model] : undefined
      if (
        typeof input !== "number" ||
        !Number.isSafeInteger(input) ||
        input < 0 ||
        typeof rate !== "number"
      ) {
        incomplete = true
        return
      }
      cost += (input * rate) / 1_000_000
    },
    unavailable() {
      incomplete = true
    },
    message() {
      if (!responses && !incomplete) return ""
      if (incomplete) return "预估费用不可用（用量或价格信息不完整）"
      const amount =
        cost > 0 && cost < 0.000001 ? "< $0.000001" : `$${cost.toFixed(6)}`
      return `预估费用 ${amount} USD`
    },
  }
}
