import type {
  EidosFileContext,
  TableViewSnapshot,
} from "@eidos.space/plugin-sdk"
import { parseConfig, resolveAction, type SmartAction } from "./core.ts"
import {
  actionDraftSchema,
  generationExamples,
  generationInstructions,
} from "./generation-contract.ts"

export function generationBody(
  requirement: string,
  fields: TableViewSnapshot["fields"]
) {
  if (!requirement.trim() || requirement.length > 8000)
    throw new Error("请输入 1–8000 字符的需求")
  return {
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${generationInstructions}\n\nILLUSTRATIVE EXAMPLES (their field IDs apply only inside each example):\n${JSON.stringify(generationExamples)}\n\nJSON SCHEMA FOR THE ACTUAL CURRENT TABLE (takes precedence over examples):\n${JSON.stringify(actionDraftSchema(fields))}`,
      },
      {
        role: "user",
        content: JSON.stringify({
          requirement,
          fields: fields.map((f) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            writable: f.writable !== false && !f.isDerived && !f.systemRole,
            options: f.type === "select" ? f.property?.options : undefined,
          })),
        }),
      },
    ],
  }
}

export function generatedAction(
  response: unknown,
  fields: TableViewSnapshot["fields"]
): SmartAction {
  const content = (
    response as { choices?: Array<{ message?: { content?: unknown } }> }
  )?.choices?.[0]?.message?.content
  if (typeof content !== "string" || content.length > 65536)
    throw new Error("生成接口没有返回有效的 Action JSON")
  const draft = JSON.parse(
    content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "")
  )
  if (!draft || typeof draft !== "object" || Array.isArray(draft))
    throw new Error("无效的动作配置")
  if (typeof draft.error === "string")
    throw new Error(draft.error.slice(0, 500))
  const outputs = Array.isArray(draft.outputs)
    ? draft.outputs.map((o: unknown) => {
        if (!o || typeof o !== "object" || Array.isArray(o))
          throw new Error("无效的输出字段")
        const item = o as Record<string, unknown>
        return {
          id: crypto.randomUUID(),
          fieldId: item.fieldId,
          type: item.type,
          instructions:
            typeof item.instructions === "string"
              ? fields.reduce((text, field) => {
                  const readable = `「${field.name}」字段`
                  let result = text.replaceAll(`${field.id}.value`, readable)
                  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(field.id))
                    result = result.replaceAll(field.id, readable)
                  return result
                }, item.instructions)
              : item.instructions,
          criteria:
            fields.find((f) => f.id === item.fieldId)?.type === "select"
              ? undefined
              : item.criteria,
          checkbox: item.checkbox,
          threshold: item.threshold,
        }
      })
    : []
  const action = parseConfig({
    version: 1,
    actions: [
      {
        id: crypto.randomUUID(),
        title: draft.title,
        icon: draft.icon ?? "sparkles",
        inputs: draft.inputs,
        outputs,
        model: "jev-latest",
        connection: "typesafe-default",
      },
    ],
  }).actions[0]!
  for (const id of action.inputs)
    if (!fields.some((f) => f.id === id && !f.systemRole))
      throw new Error("生成的输入字段不存在")
  for (const output of action.outputs) {
    const field = fields.find((f) => f.id === output.fieldId)
    if (
      !field ||
      field.systemRole ||
      field.isDerived ||
      field.writable === false ||
      (output.type === "choice"
        ? !["text", "select"].includes(field.type)
        : field.type !==
          (output.type === "noul" && output.checkbox ? "checkbox" : "number"))
    )
      throw new Error("生成的输出与字段类型不匹配")
  }
  resolveAction(action, fields)
  return action
}

export async function generateAction(
  connections: EidosFileContext["connections"],
  requirement: string,
  fields: TableViewSnapshot["fields"]
) {
  if (!(await connections.configured("action-generator")))
    throw new Error(
      "请先到插件设置配置 Action Generator 的 Endpoint、API Key 和模型"
    )
  const body = generationBody(requirement, fields)
  let response: unknown
  try {
    response = await connections.request({
      connection: "action-generator",
      body,
    })
  } catch (error) {
    const message = String(error)
    if (
      !/HTTP (400|422)\b/.test(message) ||
      !/response_format|json[_ ]?(object|output|mode)/i.test(message) ||
      !/not support|unsupported|not allowed|not available|unknown parameter|unrecognized/i.test(
        message
      )
    )
      throw error
    // Retry only an explicit parameter rejection, not authentication/transport errors.
    response = await connections.request({
      connection: "action-generator",
      body: { messages: body.messages },
    })
  }
  return generatedAction(response, fields)
}
