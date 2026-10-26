import type { PluginI18n } from "@eidos.space/plugin-sdk"

const messages: Record<string, string> = {
  "Expected an object": "error.0",
  "Unsupported Smart Actions configuration": "error.1",
  "Invalid action configuration": "error.2",
  "Unknown action icon": "error.3",
  "Invalid output definition": "error.4",
  "Provide distinct choices or score levels": "error.5",
  "Invalid checkbox mapping": "error.6",
  "Invalid probability threshold": "error.7",
  "An action field was deleted; update its configuration": "error.8",
  "Incomplete or unexpected model answers; batch was not written": "error.9",
  "Incomplete or unexpected model answers; row was not written": "error.10",
  "Model answer type mismatch": "error.11",
  "Model returned an unknown choice": "error.12",
  "Model returned an invalid numeric value": "error.13",
  "Action no longer exists": "error.14",
  "A record exceeds the 1 MiB request limit": "error.15",
  "请输入 1–8000 字符的需求": "error.16",
  "生成接口没有返回有效的 Action JSON": "error.17",
  "无效的动作配置": "error.18",
  "无效的输出字段": "error.19",
  "生成的输入字段不存在": "error.20",
  "生成的输出与字段类型不匹配": "error.21",
  "请先到插件设置配置 Action Generator 的 Endpoint、API Key 和模型": "error.22"
}

export function localizeError(error: unknown, i18n: PluginI18n): string {
  const message = error instanceof Error ? error.message : String(error).replace(/^Error: /, "")
  if (messages[message]) return i18n.t(messages[message]!)
  const field = /^Unsupported or read-only output field: (.*)$/.exec(message)
  if (field) return i18n.t("error.readOnlyField", { field: field[1]! })
  const choices = /^字段「(.*)」需要 2–255 个非空且不重复的分类选项，请在(字段设置|动作配置)中调整$/.exec(message)
  if (choices) return i18n.t("error.choices", { field: choices[1]!, location: i18n.t(choices[2] === "字段设置" ? "error.fieldSettings" : "error.actionSettings") })
  return message
}
