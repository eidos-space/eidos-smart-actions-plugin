import { createInterface } from "node:readline/promises"
import { writeFile } from "node:fs/promises"
import { decodeAnswers } from "../core.ts"
const input = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
})
const key = process.env.TYPESAFE_API_KEY ?? (await input.question(""))
input.close()
if (!key.trim()) throw new Error("Provide TYPESAFE_API_KEY or a key on stdin")
const action = {
  outputs: [
    {
      id: "department",
      fieldId: "category",
      type: "choice",
      criteria: ["billing", "technical", "sales"],
    },
    { id: "urgency", fieldId: "urgent", type: "noul" },
    {
      id: "frustration",
      fieldId: "score",
      type: "score",
      criteria: ["Calm", "Frustrated", "Very angry"],
    },
  ],
}
const result = await fetch("https://api.typesafe.ai/v1/systemone", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key.trim()}`,
    "Content-Type": "application/json",
  },
  signal: AbortSignal.timeout(30000),
  body: JSON.stringify({
    model: "jev-latest",
    state:
      "My payout has been failing for three days. Please fix this urgently.",
    questions: {
      department: {
        type: "choice",
        instructions: "Which team should handle this request?",
        criteria: {
          billing: "Payments and refunds",
          technical: "Bugs and integrations",
          sales: "Pricing and upgrades",
        },
      },
      urgency: {
        type: "noul",
        instructions: "Does this request express urgency?",
      },
      frustration: {
        type: "score",
        instructions: "How frustrated is the customer?",
        criteria: ["Calm", "Frustrated", "Very angry"],
      },
    },
  }),
})
if (!result.ok) throw new Error(`TypeSafe HTTP ${result.status}`)
const body = await result.json()
const values = decodeAnswers(action, body)
await writeFile(
  "/tmp/eidos-smart-actions-live-response.json",
  JSON.stringify({ model: body.model, values, answers: body.answers }, null, 2),
  { mode: 0o600 }
)
console.log(JSON.stringify({ ok: true, model: body.model, values }))
