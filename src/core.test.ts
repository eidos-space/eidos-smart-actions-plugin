import { test } from "node:test"
import assert from "node:assert/strict"
import { createUsageTotals } from "./usage.ts"
import { generatedAction, generationBody, generateAction } from "./generator.ts"
import { actionDraftSchema, generationExamples } from "./generation-contract.ts"
import {
  parseConfig,
  decodeAnswers,
  requestBody,
  batchRequestBody,
  decodeBatchAnswers,
  runAction,
  resolveAction,
  type SmartAction,
} from "./core.ts"
import type { TableActionContext } from "@eidos.space/plugin-sdk"

const action: SmartAction = {
  id: "classify",
  title: "Classify",
  inputs: ["message"],
  model: "jev-latest",
  connection: "typesafe-default",
  outputs: [
    {
      id: "department",
      fieldId: "category",
      type: "choice",
      instructions: "Which team?",
      criteria: ["billing", "technical"],
    },
    {
      id: "urgency",
      fieldId: "score",
      type: "noul",
      instructions: "Is it urgent?",
    },
  ],
}
test("generated rules keep field names readable while runtime binds names to internal keys", () => {
  const id = "01a0c79e-2996-7770-80ab-74e18be75b80"
  const fields = [
    { id, name: "Message", type: "text" as const },
    { id: "target", name: "Result", type: "text" as const },
  ]
  const draft = generatedAction(
    {
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "分类",
              inputs: [id],
              outputs: [
                {
                  fieldId: "target",
                  type: "choice",
                  instructions: `根据 ${id}.value 分类`,
                  criteria: ["相关", "无关"],
                },
              ],
            }),
          },
        },
      ],
    },
    fields
  )
  assert.equal(draft.outputs[0].instructions, "根据 「Message」字段 分类")
  const body = requestBody(
    draft,
    { id: "r", values: { [id]: "Hello" } },
    new Map([[id, "Message"]])
  )
  assert.match(
    body.questions[draft.outputs[0].id].instructions,
    /"name":"Message"/
  )
  assert.match(body.questions[draft.outputs[0].id].instructions, new RegExp(id))
  const prompt = generationBody("分类", fields)
  assert.match(prompt.messages[0].content, /field DISPLAY NAMES/)
  for (const example of generationExamples) {
    if ("outputs" in example.output)
      for (const output of example.output.outputs)
        assert.doesNotMatch(output.instructions, /\.value/)
  }
})
test("generation examples pass the real draft validator and unsupported requests remain errors", () => {
  for (const example of generationExamples) {
    const response = {
      choices: [{ message: { content: JSON.stringify(example.output) } }],
    }
    const fields = structuredClone(example.fields) as unknown as Parameters<
      typeof generatedAction
    >[1]
    if ("error" in example.output)
      assert.throws(() => generatedAction(response, fields), /不能生成/)
    else {
      const action = generatedAction(response, fields)
      assert.equal(action.title, example.output.title)
      assert.equal(action.outputs.length, example.output.outputs.length)
      if (action.outputs.some((output) => output.checkbox))
        assert.equal(action.outputs[0].threshold, 0.8)
    }
  }
})
test("generation schema binds input and output IDs to current fields and excludes read-only outputs", () => {
  const fields = [
    { id: "body_real", name: "Body", type: "text" },
    { id: "probability_real", name: "Probability", type: "number" },
    { id: "derived_real", name: "Derived", type: "number", isDerived: true },
    { id: "readonly_real", name: "Readonly", type: "number", writable: false },
  ] as unknown as Parameters<typeof generatedAction>[1]
  const schema = actionDraftSchema(fields)
  const success = schema.oneOf[0]
  assert.deepEqual(success.properties.inputs?.items, {
    enum: fields.map((f) => f.id),
  })
  const outputSchema = JSON.stringify(success.properties.outputs)
  assert.match(outputSchema, /probability_real/)
  assert.doesNotMatch(outputSchema, /derived_real|readonly_real/)
  const body = generationBody("判断是否紧急", fields)
  assert.match(
    body.messages[0].content,
    /JSON SCHEMA FOR THE ACTUAL CURRENT TABLE/
  )
  assert.match(body.messages[0].content, /ILLUSTRATIVE EXAMPLES/)
  assert.deepEqual(
    JSON.parse(body.messages[1].content).fields.map(
      (f: { id: string }) => f.id
    ),
    fields.map((f) => f.id)
  )
})
test("generated drafts are validated and cannot select nonexistent or read-only fields", async () => {
  const fields = [
    { id: "message", name: "Message", type: "text" },
    {
      id: "category",
      name: "Category",
      type: "select",
      property: { options: [{ name: "billing" }, { name: "sales" }] },
    },
  ] as unknown as Parameters<typeof generatedAction>[1]
  const draft = {
    title: "分类",
    inputs: ["message"],
    outputs: [
      {
        fieldId: "category",
        type: "choice",
        instructions: "按部门分类",
        criteria: ["invented", "other"],
      },
    ],
  }
  const response = (value: unknown) => ({
    choices: [{ message: { content: JSON.stringify(value) } }],
  })
  const result = generatedAction(response(draft), fields)
  assert.equal(result.connection, "typesafe-default")
  assert.equal(result.outputs[0].criteria, undefined)
  assert.throws(() =>
    generatedAction(response({ ...draft, inputs: ["missing"] }), fields)
  )
  assert.throws(() =>
    generatedAction(
      response(draft),
      fields.map((f) => ({ ...f, writable: false }))
    )
  )
  assert.throws(() =>
    generatedAction(
      response({ ...draft, outputs: [{ ...draft.outputs[0], type: "noul" }] }),
      fields
    )
  )
  assert.throws(
    () => generatedAction(response({ error: "需要分类字段" }), fields),
    /需要分类字段/
  )
  assert.throws(() =>
    generatedAction({ choices: [{ message: { content: "not JSON" } }] }, fields)
  )
  assert.throws(() => generationBody("", fields))
  let requested = false
  await assert.rejects(
    generateAction(
      {
        configured: async () => false,
        request: async () => {
          requested = true
          return {}
        },
      },
      "分类",
      fields
    ),
    /请先/
  )
  assert.equal(requested, false)
})
test("generation retries explicit unsupported JSON mode once but does not retry other failures", async () => {
  const fields = [
    { id: "message", name: "Message", type: "text" },
    { id: "score", name: "Score", type: "number" },
  ] as unknown as Parameters<typeof generatedAction>[1]
  let calls = 0
  const result = await generateAction(
    {
      configured: async () => true,
      request: async ({ body }) => {
        calls++
        if (calls === 1) {
          assert.ok(body.response_format)
          throw new Error(
            "Connection HTTP 400: response_format json_object is not supported"
          )
        }
        assert.equal(body.response_format, undefined)
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "Urgent",
                  inputs: ["message"],
                  outputs: [
                    {
                      fieldId: "score",
                      type: "noul",
                      instructions: "Is this urgent?",
                    },
                  ],
                }),
              },
            },
          ],
        }
      },
    },
    "判断是否紧急",
    fields
  )
  assert.equal(result.title, "Urgent")
  assert.equal(calls, 2)
  for (const message of [
    "Connection HTTP 400: Unknown model",
    "Connection HTTP 401: Unauthorized",
    "Connection request failed",
  ]) {
    let attempts = 0
    await assert.rejects(
      generateAction(
        {
          configured: async () => true,
          request: async () => {
            attempts++
            throw new Error(message)
          },
        },
        "判断是否紧急",
        fields
      )
    )
    assert.equal(attempts, 1)
  }
})
const response = {
  answers: {
    department: { type: "choice", choice: "billing" },
    urgency: { type: "noul", noul: 0.9 },
  },
}
test("cost sums known model input usage, ignores free output and preserves tiny amounts", () => {
  const usage = createUsageTotals()
  assert.equal(usage.message(), "")
  usage.add({
    model: "jev-1.13.0",
    usage: { input_tokens: 1, output_tokens: 9000 },
  })
  assert.match(usage.message(), /< \$0\.000001/)
  usage.add({
    model: "jev-1.13.0",
    usage: { input_tokens: 999999, output_tokens: 9999 },
  })
  assert.equal(usage.message(), "预估费用 $0.042000 USD")
})
test("missing usage, unknown model and failed requests never appear as zero cost", () => {
  for (const value of [
    {},
    { model: "jev-latest", usage: { input_tokens: 10 } },
    { model: "jev-1.13.0", usage: { input_tokens: -1 } },
  ]) {
    const usage = createUsageTotals()
    usage.add(value)
    assert.match(usage.message(), /不可用/)
  }
  const usage = createUsageTotals()
  usage.unavailable()
  assert.match(usage.message(), /不可用/)
})
test("run reports aggregated cost before completion", async () => {
  const f = fixture()
  f.context.target.count = 20
  const messages: string[] = []
  f.context.task.report = async ({ message }) => {
    if (message) messages.push(message)
  }
  f.context.connections.request = async ({ body }) => ({
    ...batchResponse(body as ReturnType<typeof batchRequestBody>),
    model: "jev-1.13.0",
    usage: { input_tokens: 1000, output_tokens: 20 },
  })
  await runAction(f.context, "classify")
  assert.equal(messages.at(-1), "预估费用 $0.000084 USD")
})
function batchResponse(body: ReturnType<typeof batchRequestBody>) {
  return {
    answers: Object.fromEntries(
      Object.keys(body.questions).map((key) => [
        key,
        key.endsWith("_o0")
          ? response.answers.department
          : response.answers.urgency,
      ])
    ),
  }
}
test("validates portable configuration and rejects duplicate outputs", () => {
  assert.equal(parseConfig({ version: 1, actions: [action] }).actions.length, 1)
  assert.throws(() =>
    parseConfig({
      version: 1,
      actions: [{ ...action, outputs: [...action.outputs, action.outputs[0]] }],
    })
  )
  assert.throws(() => parseConfig({ version: 2, actions: [] }))
  assert.throws(() =>
    parseConfig({
      version: 1,
      actions: [
        { ...action, outputs: [{ ...action.outputs[0], fieldId: "" }] },
      ],
    })
  )
  assert.throws(() =>
    parseConfig({
      version: 1,
      actions: [{ ...action, inputs: ["message", "message"] }],
    })
  )
})
test("sends only selected input fields and decodes all outputs before writing", () => {
  const request = requestBody(
    action,
    {
      id: "r",
      readToken: "r",
      values: { message: "Refund", secret: "Do not send", category: "old" },
    },
    new Map()
  )
  assert.deepEqual(Object.keys(request.state), ["message"])
  assert.deepEqual(decodeAnswers(action, response), {
    category: "billing",
    score: 0.9,
  })
  assert.throws(() =>
    decodeAnswers(action, {
      answers: { ...response.answers, urgency: { type: "noul", noul: 9 } },
    })
  )
  assert.throws(() =>
    decodeAnswers(action, {
      answers: {
        department: { type: "choice", choice: "invented" },
        urgency: response.answers.urgency,
      },
    })
  )
})
function fixture(preview = true) {
  const events: string[] = [],
    updates: unknown[] = []
  const controller = new AbortController()
  const context = {
    signal: controller.signal,
    table: {
      pluginConfig: {
        read: async () => ({
          value: { version: 1, actions: [action] },
          version: "1",
        }),
      },
      read: async () => ({
        fields: [
          { id: "message", name: "Message", type: "text", writable: true },
          { id: "category", name: "Category", type: "text", writable: true },
          { id: "score", name: "Score", type: "number", writable: true },
        ],
      }),
    },
    target: {
      count: 5,
      read: async ({ offset, limit }: { offset: number; limit: number }) =>
        Array.from({ length: limit }, (_, i) => ({
          id: String(offset + i),
          readToken: String(offset + i),
          values: { message: "Refund", category: "", score: 0 },
        })),
      update: async (input: unknown) => {
        events.push("write")
        updates.push(input)
      },
    },
    connections: {
      request: async ({
        body,
      }: {
        body: ReturnType<typeof batchRequestBody>
      }) => {
        events.push("request")
        return batchResponse(body)
      },
    },
    task: {
      preview: async () => {
        events.push("preview")
        return preview
      },
      report: async () => {},
    },
  } as unknown as TableActionContext
  return { context, events, updates, controller }
}
test("40 records use four requests, two concurrent, with serial ordered writes", async () => {
  const f = fixture()
  f.context.target.count = 40
  let requests = 0,
    active = 0,
    peak = 0,
    writing = false
  const write = f.context.target.update
  f.context.target.update = async (input) => {
    assert.equal(writing, false)
    writing = true
    await new Promise((resolve) => setTimeout(resolve, 1))
    await write(input)
    writing = false
  }
  f.context.task.preview = async (rows) => {
    assert.equal(rows.length, 3)
    return true
  }
  f.context.connections.request = async ({ body }) => {
    const batch = body as ReturnType<typeof batchRequestBody>
    assert.equal(batch.state.rows.length, 10)
    const index = requests++
    peak = Math.max(peak, ++active)
    await new Promise((resolve) => setTimeout(resolve, index % 2 ? 1 : 10))
    active--
    const result = batchResponse(batch)
    for (let r = 0; r < 10; r++)
      result.answers[`r${r}_o1`] = {
        type: "noul",
        noul: (index * 10 + r) / 100,
      }
    return result
  }
  await runAction(f.context, "classify")
  assert.equal(requests, 4)
  assert.equal(peak, 2)
  assert.deepEqual(
    f.updates,
    Array.from({ length: 40 }, (_, i) => ({
      readToken: String(i),
      values: { category: "billing", score: i / 100 },
    }))
  )
})

test("batch payload isolates rows and rejects missing, extra and invalid answers", () => {
  const rows = [
    {
      id: "private-id",
      readToken: "private-token",
      values: { message: "Refund", secret: "private-value" },
    },
  ]
  const body = batchRequestBody(action, rows, new Map())
  assert.deepEqual(body.state.rows, [
    { message: { field: "message", value: "Refund" } },
  ])
  assert.match(body.questions.r0_o0.instructions, /state.rows\[0\]/)
  assert.doesNotMatch(JSON.stringify(body), /private-/)
  const valid = batchResponse(body)
  assert.equal(
    decodeBatchAnswers(action, rows, valid)[0].readToken,
    "private-token"
  )
  assert.throws(() =>
    decodeBatchAnswers(action, rows, {
      answers: { ...valid.answers, extra: {} },
    })
  )
  assert.throws(() =>
    decodeBatchAnswers(action, rows, {
      answers: { r0_o0: valid.answers.r0_o0, wrong: valid.answers.r0_o1 },
    })
  )
  assert.throws(() =>
    decodeBatchAnswers(action, rows, {
      answers: { ...valid.answers, r0_o1: { type: "noul", noul: 2 } },
    })
  )
})

test("failed sibling batch is drained without writing the window", async () => {
  const f = fixture()
  f.context.target.count = 20
  let calls = 0,
    drained = false
  f.context.connections.request = async ({ body }) => {
    if (++calls === 1) throw new Error("HTTP 500")
    await new Promise((resolve) => setTimeout(resolve, 5))
    drained = true
    return batchResponse(body as ReturnType<typeof batchRequestBody>)
  }
  await assert.rejects(runAction(f.context, "classify"), /500/)
  assert.equal(drained, true)
  assert.equal(f.updates.length, 0)
})

test("cancellation during inference or writing stops further writes", async () => {
  for (const duringWrite of [false, true]) {
    const f = fixture()
    f.context.target.count = 20
    if (duringWrite) {
      const write = f.context.target.update
      f.context.target.update = async (input) => {
        await write(input)
        f.controller.abort()
      }
    } else {
      f.context.connections.request = async ({ body }) => {
        f.controller.abort()
        return batchResponse(body as ReturnType<typeof batchRequestBody>)
      }
    }
    await assert.rejects(runAction(f.context, "classify"))
    assert.equal(f.updates.length, duringWrite ? 1 : 0)
  }
})

test("partial final batches and deleted records retain frozen offsets and progress", async () => {
  const f = fixture()
  f.context.target.count = 23
  const read = f.context.target.read
  const offsets: number[] = [],
    sizes: number[] = [],
    progress: number[] = []
  f.context.target.read = async (input) => {
    offsets.push(input.offset)
    return (await read(input)).filter(
      (row) => Number(row.id) >= 10 && Number(row.id) !== 21
    )
  }
  f.context.connections.request = async ({ body }) => {
    const batch = body as ReturnType<typeof batchRequestBody>
    sizes.push(batch.state.rows.length)
    return batchResponse(batch)
  }
  f.context.task.report = async ({ completed }) => {
    progress.push(completed)
  }
  await runAction(f.context, "classify")
  assert.deepEqual(offsets, [0, 10, 20])
  assert.deepEqual(sizes, [10, 2])
  assert.equal(f.updates.length, 12)
  assert.equal(progress.at(-1), 23)
})

test("large inputs split under the host byte limit without truncation", async () => {
  const f = fixture()
  const read = f.context.target.read
  const text = "测".repeat(100_000)
  f.context.target.read = async (input) =>
    (await read(input)).map((row) => ({
      ...row,
      values: { ...row.values, message: text },
    }))
  const sizes: number[] = []
  f.context.connections.request = async ({ body }) => {
    assert.ok(
      new TextEncoder().encode(JSON.stringify(body)).byteLength <= 1024 * 1024
    )
    const batch = body as ReturnType<typeof batchRequestBody>
    assert.equal(batch.state.rows[0].message.value, text)
    sizes.push(batch.state.rows.length)
    return batchResponse(batch)
  }
  await runAction(f.context, "classify")
  assert.deepEqual(sizes, [3, 2])
  assert.equal(f.updates.length, 5)
})

test("all deleted records complete progress without model requests", async () => {
  const f = fixture()
  f.context.target.read = async () => []
  let completed = 0
  f.context.task.report = async (report) => {
    completed = report.completed
  }
  await runAction(f.context, "classify")
  assert.deepEqual(f.events, [])
  assert.equal(completed, 5)
})
test("authorizes up to three samples and writes all records from one batch", async () => {
  const f = fixture()
  await runAction(f.context, "classify")
  assert.deepEqual(f.events.slice(0, 2), ["request", "preview"])
  assert.equal(f.updates.length, 5)
})
test("declined preview, cancellation and malformed output never write", async () => {
  const declined = fixture(false)
  await runAction(declined.context, "classify")
  assert.equal(declined.updates.length, 0)
  const cancelled = fixture()
  cancelled.controller.abort()
  await assert.rejects(() => runAction(cancelled.context, "classify"))
  assert.equal(cancelled.updates.length, 0)
  const bad = fixture()
  bad.context.connections.request = async () => ({ answers: {} })
  await assert.rejects(() => runAction(bad.context, "classify"))
  assert.equal(bad.updates.length, 0)
})

test("single-select uses current field options without storing a duplicate catalog", async () => {
  const f = fixture()
  const read = f.context.table.read
  f.context.table.read = async () => {
    const snapshot = await read()
    snapshot.fields[1] = {
      ...snapshot.fields[1],
      type: "select",
      property: { options: [{ name: "billing" }, { name: "sales" }] },
    }
    return snapshot
  }
  const config = structuredClone(action)
  delete config.outputs[0].criteria
  f.context.table.pluginConfig.read = async () => ({
    value: { version: 1, actions: [config] },
    version: "1",
  })
  f.context.connections.request = async (input) => {
    const body = input.body as ReturnType<typeof batchRequestBody>
    assert.deepEqual(body.questions.r0_o0.criteria, {
      billing: null,
      sales: null,
    })
    return batchResponse(body)
  }
  await runAction(f.context, "classify")
  assert.equal(f.updates.length, 5)
  assert.equal(config.outputs[0].criteria, undefined)
  const { fields } = await f.context.table.read()
  const resolved = resolveAction(action, fields)
  assert.deepEqual(resolved.outputs[0].criteria, ["billing", "sales"])
  assert.throws(() =>
    decodeAnswers(resolved, {
      answers: {
        ...response.answers,
        department: { type: "choice", choice: "technical" },
      },
    })
  )
})

test("invalid single-select options fail before any API request or write", async () => {
  for (const options of [
    [],
    [{ name: "only" }],
    [{ name: "same" }, { name: "same" }],
  ]) {
    const f = fixture()
    const read = f.context.table.read
    f.context.table.read = async () => {
      const snapshot = await read()
      snapshot.fields[1] = {
        ...snapshot.fields[1],
        type: "select",
        property: { options },
      }
      return snapshot
    }
    await assert.rejects(() => runAction(f.context, "classify"), /字段设置/)
    assert.deepEqual(f.events, [])
    assert.deepEqual(f.updates, [])
  }
})
