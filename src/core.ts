import type {
  TableActionContext,
  TableActionRecord,
  TableViewSnapshot,
} from "@eidos.space/plugin-sdk"
import { actionIcons, type ActionIcon } from "./icons.ts"
import { createUsageTotals } from "./usage.ts"

export interface Output {
  id: string
  fieldId: string
  type: "choice" | "score" | "noul"
  instructions: string
  criteria?: string[]
  threshold?: number
  checkbox?: boolean
}
export interface SmartAction {
  id: string
  title: string
  icon?: ActionIcon
  inputs: string[]
  outputs: Output[]
  connection: string
  model: string
}
export interface Config {
  version: 1
  actions: SmartAction[]
}
const object = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new Error("Expected an object")
  return v as Record<string, unknown>
}
export function parseConfig(value: unknown): Config {
  if (value === null) return { version: 1, actions: [] }
  const c = object(value)
  if (c.version !== 1 || !Array.isArray(c.actions) || c.actions.length > 50)
    throw new Error("Unsupported Smart Actions configuration")
  const ids = new Set<string>()
  for (const item of c.actions) {
    const a = object(item)
    if (
      typeof a.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(a.id) ||
      ids.has(a.id) ||
      typeof a.title !== "string" ||
      !a.title.trim() ||
      a.title.length > 120 ||
      !Array.isArray(a.inputs) ||
      !a.inputs.length ||
      a.inputs.length > 32 ||
      a.inputs.some((v) => typeof v !== "string" || !v.trim()) ||
      new Set(a.inputs).size !== a.inputs.length ||
      !Array.isArray(a.outputs) ||
      !a.outputs.length ||
      a.outputs.length > 16 ||
      a.connection !== "typesafe-default" ||
      typeof a.model !== "string" ||
      !a.model.trim() ||
      a.model.length > 120
    )
      throw new Error("Invalid action configuration")
    ids.add(a.id)
    if (
      a.icon !== undefined &&
      (typeof a.icon !== "string" || !Object.hasOwn(actionIcons, a.icon))
    )
      throw new Error("Unknown action icon")
    const fields = new Set<string>(),
      questions = new Set<string>()
    for (const raw of a.outputs) {
      const o = object(raw)
      if (
        typeof o.id !== "string" ||
        !/^[a-zA-Z0-9_-]{1,64}$/.test(o.id) ||
        questions.has(o.id) ||
        typeof o.fieldId !== "string" ||
        !o.fieldId.trim() ||
        fields.has(o.fieldId) ||
        typeof o.instructions !== "string" ||
        !o.instructions.trim() ||
        o.instructions.length > 8000 ||
        !["choice", "score", "noul"].includes(String(o.type))
      )
        throw new Error("Invalid output definition")
      if (
        (o.type === "score" ||
          (o.type === "choice" && o.criteria !== undefined)) &&
        (!Array.isArray(o.criteria) ||
          o.criteria.length < 2 ||
          o.criteria.length > (o.type === "score" ? 10 : 255) ||
          o.criteria.some((v) => typeof v !== "string" || !v.trim()) ||
          new Set(o.criteria).size !== o.criteria.length)
      )
        throw new Error("Provide distinct choices or score levels")
      if (o.checkbox !== undefined && typeof o.checkbox !== "boolean")
        throw new Error("Invalid checkbox mapping")
      if (
        o.threshold !== undefined &&
        (typeof o.threshold !== "number" ||
          !Number.isFinite(o.threshold) ||
          o.threshold < 0 ||
          o.threshold > 1)
      )
        throw new Error("Invalid probability threshold")
      fields.add(o.fieldId)
      questions.add(o.id)
    }
  }
  return structuredClone(c) as unknown as Config
}
export function fieldChoices(
  field: TableViewSnapshot["fields"][number]
): string[] {
  const options = field.property?.options
  if (!Array.isArray(options)) return []
  return options.flatMap((option: unknown) => {
    if (
      !option ||
      typeof option !== "object" ||
      !("name" in option) ||
      typeof option.name !== "string"
    )
      return []
    return [option.name]
  })
}

export function resolveAction(
  action: SmartAction,
  fields: TableViewSnapshot["fields"]
): SmartAction {
  const resolved = structuredClone(action)
  for (const output of resolved.outputs) {
    const field = fields.find((f) => f.id === output.fieldId)
    if (!field)
      throw new Error("An action field was deleted; update its configuration")
    if (output.type === "choice" && field.type === "select") {
      output.criteria = fieldChoices(field)
    }
    if (
      output.type === "choice" &&
      (!output.criteria ||
        output.criteria.length < 2 ||
        output.criteria.length > 255 ||
        output.criteria.some((v) => !v.trim()) ||
        new Set(output.criteria).size !== output.criteria.length)
    ) {
      throw new Error(
        `字段「${field.name}」需要 2–255 个非空且不重复的分类选项，请在${field.type === "select" ? "字段设置" : "动作配置"}中调整`
      )
    }
  }
  return resolved
}

export function requestBody(
  action: SmartAction,
  row: TableActionRecord,
  names: Map<string, string>
) {
  return {
    model: action.model,
    state: Object.fromEntries(
      action.inputs.map((id) => [
        id,
        { field: names.get(id) ?? id, value: row.values[id] ?? null },
      ])
    ),
    questions: Object.fromEntries(
      action.outputs.map((output) => [
        output.id,
        {
          type: output.type,
          instructions: `Input field mapping (JSON, display name to internal key): ${JSON.stringify(action.inputs.map((id) => ({ name: names.get(id) ?? id, key: id })))}. Read each field's value from the current record.\n\n${output.instructions}`,
          ...(output.type === "choice"
            ? {
                criteria: Object.fromEntries(
                  output.criteria!.map((label) => [label, null])
                ),
              }
            : output.type === "score"
              ? { criteria: output.criteria! }
              : {}),
        },
      ])
    ),
  }
}
export function batchRequestBody(
  action: SmartAction,
  rows: TableActionRecord[],
  names: Map<string, string>
) {
  const requests = rows.map((row) => requestBody(action, row, names))
  return {
    model: action.model,
    state: { rows: requests.map((request) => request.state) },
    questions: Object.fromEntries(
      requests.flatMap((request, rowIndex) =>
        action.outputs.map((output, outputIndex) => [
          `r${rowIndex}_o${outputIndex}`,
          {
            ...request.questions[output.id],
            // Question IDs are not visible to the model. Bind the row explicitly.
            instructions: `Use only state.rows[${rowIndex}] (zero-based index) to answer this question. Do not use any other row.\n\n${request.questions[output.id]!.instructions}`,
          },
        ])
      )
    ),
  }
}

export function decodeBatchAnswers(
  action: SmartAction,
  rows: TableActionRecord[],
  value: unknown
) {
  const answers = object(object(value).answers)
  const expected = rows.flatMap((_, r) =>
    action.outputs.map((_, o) => `r${r}_o${o}`)
  )
  if (
    Object.keys(answers).length !== expected.length ||
    expected.some((key) => !Object.hasOwn(answers, key))
  )
    throw new Error(
      "Incomplete or unexpected model answers; batch was not written"
    )
  return rows.map((row, r) => ({
    readToken: row.readToken,
    values: decodeAnswers(action, {
      answers: Object.fromEntries(
        action.outputs.map((output, o) => [output.id, answers[`r${r}_o${o}`]])
      ),
    }),
  }))
}

export function decodeAnswers(
  action: SmartAction,
  value: unknown
): Record<string, string | number | boolean> {
  const answers = object(object(value).answers)
  if (Object.keys(answers).length !== action.outputs.length)
    throw new Error(
      "Incomplete or unexpected model answers; row was not written"
    )
  const values: Record<string, string | number | boolean> = {}
  for (const output of action.outputs) {
    const answer = object(answers[output.id])
    if (answer.type !== output.type)
      throw new Error("Model answer type mismatch")
    if (output.type === "choice") {
      if (
        typeof answer.choice !== "string" ||
        !output.criteria!.includes(answer.choice)
      )
        throw new Error("Model returned an unknown choice")
      values[output.fieldId] = answer.choice
    } else {
      const result = answer[output.type]
      if (
        typeof result !== "number" ||
        !Number.isFinite(result) ||
        result < 0 ||
        result > (output.type === "noul" ? 1 : output.criteria!.length - 1)
      )
        throw new Error("Model returned an invalid numeric value")
      values[output.fieldId] =
        output.type === "noul" && output.checkbox
          ? result >= (output.threshold ?? 0.5)
          : result
    }
  }
  return values
}
async function delay(ms: number, signal: AbortSignal) {
  signal.throwIfAborted()
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer)
      reject(new Error("Cancelled"))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort)
      resolve()
    }, ms)
    signal.addEventListener("abort", abort, { once: true })
  })
}
export async function runAction(ctx: TableActionContext, itemId: string) {
  const config = parseConfig((await ctx.table.pluginConfig.read()).value)
  const configured = config.actions.find((a) => a.id === itemId)
  if (!configured) throw new Error("Action no longer exists")
  const { fields } = await ctx.table.read()
  const action = resolveAction(configured, fields)
  const required = [
    ...new Set([...action.inputs, ...action.outputs.map((o) => o.fieldId)]),
  ]
  for (const id of required)
    if (!fields.some((f) => f.id === id))
      throw new Error("An action field was deleted; update its configuration")
  for (const output of action.outputs) {
    const field = fields.find((f) => f.id === output.fieldId)!
    if (
      field.writable === false ||
      field.isDerived ||
      !["text", "select", "number", "checkbox"].includes(field.type) ||
      (output.type === "choice"
        ? !["text", "select"].includes(field.type)
        : output.type === "score"
          ? field.type !== "number"
          : field.type !== (output.checkbox ? "checkbox" : "number"))
    )
      throw new Error(`Unsupported or read-only output field: ${field.name}`)
  }
  const names = new Map(fields.map((f) => [f.id, f.name]))
  let completed = 0,
    skipped = 0,
    approved = false
  const usage = createUsageTotals()
  const report = () =>
    ctx.task.report({
      completed: completed + skipped,
      message:
        [skipped ? `跳过 ${skipped} 条已删除记录` : "", usage.message()]
          .filter(Boolean)
          .join(" · ") || undefined,
    })
  const infer = async (
    rows: TableActionRecord[]
  ): Promise<ReturnType<typeof decodeBatchAnswers>> => {
    if (!rows.length) return []
    const body = batchRequestBody(action, rows, names)
    // Stay below the host's 1 MiB request limit without dropping input content.
    if (
      new TextEncoder().encode(JSON.stringify(body)).byteLength >
      1024 * 1024
    ) {
      if (rows.length === 1)
        throw new Error("A record exceeds the 1 MiB request limit")
      const middle = Math.ceil(rows.length / 2)
      const first = await infer(rows.slice(0, middle))
      return [...first, ...(await infer(rows.slice(middle)))]
    }
    for (let attempt = 0; ; attempt++) {
      ctx.signal.throwIfAborted()
      let received = false
      try {
        const response = await ctx.connections.request({
          connection: action.connection,
          body,
        })
        received = true
        usage.add(response)
        if (!ctx.signal.aborted) await report()
        ctx.signal.throwIfAborted()
        return decodeBatchAnswers(action, rows, response)
      } catch (error) {
        if (attempt >= 2 || !/HTTP (429|529)/.test(String(error))) {
          // A transport failure may have incurred usage we cannot observe.
          if (!received) {
            usage.unavailable()
            if (!ctx.signal.aborted) await report()
          }
          throw error
        }
        await delay(1000 * 2 ** attempt, ctx.signal)
      }
    }
  }
  for (let offset = 0; offset < ctx.target.count; ) {
    ctx.signal.throwIfAborted()
    // Bounded windows: at most 20 retained records, two network requests, one writer.
    const batches: TableActionRecord[][] = []
    for (let batch = 0; batch < 2 && offset < ctx.target.count; batch++) {
      ctx.signal.throwIfAborted()
      const limit = Math.min(10, ctx.target.count - offset)
      const rows = await ctx.target.read({ offset, limit, fields: required })
      skipped += limit - rows.length
      batches.push(rows)
      offset += limit
    }
    // Drain both promises before returning, including on failure/cancellation.
    const settled = await Promise.allSettled(batches.map(infer))
    ctx.signal.throwIfAborted()
    const results = settled.flatMap((result) => {
      if (result.status === "rejected") throw result.reason
      return result.value
    })
    if (!approved && results.length) {
      if (!(await ctx.task.preview(results.slice(0, 3)))) return
      ctx.signal.throwIfAborted()
      approved = true
    }
    for (const result of results) {
      ctx.signal.throwIfAborted()
      await ctx.target.update(result)
      completed++
      await report()
    }
    if (!results.length) await report()
  }
}
