import { test } from "node:test"
import assert from "node:assert/strict"
import { build } from "esbuild"
import { JSDOM } from "jsdom"

test("AI generation requires configuration and creates only an editable unsaved draft", async () => {
  const dom = new JSDOM('<div id="root"></div>')
  globalThis.document = dom.window.document
  const result = await build({
    entryPoints: [new URL("./settings.ts", import.meta.url).pathname],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
  })
  const { default: mount } = await import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].text).toString("base64")
  )
  let configured = false,
    writes = 0,
    requests = 0
  const file = {
    listTables: async () => [{ id: "a", name: "Requests" }],
    readTable: async () => ({
      fields: [
        { id: "message", name: "Message", type: "text" },
        {
          id: "category",
          name: "Category",
          type: "select",
          property: { options: [{ name: "billing" }, { name: "sales" }] },
        },
      ],
    }),
    readPluginConfig: async () => ({ value: null, version: "old" }),
    writePluginConfig: async () => {
      writes++
      return { version: "new" }
    },
    connections: {
      configured: async () => configured,
      request: async (input) => {
        requests++
        assert.equal(input.connection, "action-generator")
        assert.equal(input.body.messages.length, 2)
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  title: "自动分类",
                  icon: "tag",
                  inputs: ["message"],
                  outputs: [
                    {
                      fieldId: "category",
                      type: "choice",
                      instructions: "按部门分类",
                    },
                  ],
                }),
              },
            },
          ],
        }
      },
    },
  }
  const root = document.querySelector("#root")
  const mounted = await mount({ binding: { kind: "eidos", file } }, root)
  assert.equal(root.querySelector('select[aria-label="选择动作"]'), null)
  assert.equal(root.querySelector("footer"), null)
  assert.match(root.textContent, /创建第一个动作/)
  const click = (text) =>
    [...root.querySelectorAll("button")]
      .find((b) => b.textContent === text)
      .click()
  const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  }
  click("用 AI 生成动作")
  await flush()
  assert.match(root.textContent, /请先到/)
  assert.equal(
    [...root.querySelectorAll("button")].find(
      (b) => b.textContent === "生成草稿"
    ).disabled,
    true
  )
  configured = true
  click("用 AI 生成动作")
  click("用 AI 生成动作")
  await flush()
  const prompt = root.querySelector('textarea[aria-label="动作需求"]')
  prompt.value = "对客户请求分类"
  prompt.dispatchEvent(new dom.window.Event("input"))
  click("生成草稿")
  await flush()
  assert.equal(requests, 1)
  assert.equal(writes, 0)
  assert.match(root.textContent, /已生成草稿/)
  assert.equal(root.querySelector("article input").value, "自动分类")
  assert.equal(
    root.querySelector("button.output").getAttribute("aria-pressed"),
    "true"
  )
  assert.equal(root.querySelectorAll(".inspector fieldset").length, 1)
  click("保存")
  await flush()
  assert.equal(writes, 1)
  click("删除动作")
  assert.match(root.textContent, /删除尚未保存/)
  click("保存")
  await flush()
  assert.equal(writes, 2)
  assert.equal(root.querySelector("footer"), null)
  mounted.dispose()
  dom.window.close()
  delete globalThis.document
})

test("file editor preserves drafts across tables and saves only the selected table config", async () => {
  const dom = new JSDOM('<div id="root"></div>')
  globalThis.document = dom.window.document
  const result = await build({
    entryPoints: [new URL("./settings.ts", import.meta.url).pathname],
    bundle: true,
    write: false,
    format: "esm",
    platform: "browser",
  })
  const { default: mount } = await import(
    "data:text/javascript;base64," +
      Buffer.from(result.outputFiles[0].text).toString("base64")
  )
  const root = document.querySelector("#root")
  const writes = []
  const context = {
    binding: {
      kind: "eidos",
      file: {
        listTables: async () => [
          { id: "a", name: "Requests" },
          { id: "b", name: "Books" },
        ],
        readTable: async () => ({
          fields: [
            { id: "message", name: "Message", type: "text" },
            {
              id: "category",
              name: "Category",
              type: "select",
              property: { options: [{ name: "billing" }, { name: "sales" }] },
            },
          ],
        }),
        readPluginConfig: async () => ({ value: null, version: "old" }),
        writePluginConfig: async (id, input) => {
          writes.push({ id, input })
          return { version: "new" }
        },
      },
    },
  }
  const mounted = await mount(context, root)
  const flush = async () => {
    for (let n = 0; n < 12; n++) await Promise.resolve()
  }
  const visible = () => root.querySelector("section:not([hidden])")
  const click = (text) =>
    [...visible().querySelectorAll("button")]
      .find((b) => b.textContent === text)
      .click()
  click("手动创建")
  visible().querySelector('button[aria-label="分类"]').click()
  const title = visible().querySelector("article input")
  title.value = "Classify requests"
  title.dispatchEvent(new dom.window.Event("input"))
  const output = visible().querySelector("fieldset select")
  output.value = "category"
  output.dispatchEvent(new dom.window.Event("change"))
  const prompt = visible().querySelector("textarea")
  prompt.value = "Choose the department"
  prompt.dispatchEvent(new dom.window.Event("input"))
  assert.match(visible().textContent, /使用字段的 2 个选项/)
  assert.match(visible().textContent, /billing、sales/)
  assert.doesNotMatch(visible().textContent, /类别（每行一个）/)
  click("Requests")
  assert.equal(visible().querySelector(".action-list").hidden, true)
  click("Requests")
  assert.equal(visible().querySelector(".action-list").hidden, false)
  const resize = visible().querySelector('[role="separator"]')
  resize.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "ArrowRight" })
  )
  assert.equal(root.style.getPropertyValue("--smart-sidebar-width"), "230px")
  click("Books")
  await flush()
  assert.doesNotMatch(visible().textContent, /Classify requests/)
  assert.equal(
    visible().querySelector('[role="separator"]').getAttribute("aria-valuenow"),
    "230"
  )
  click("Requests")
  await flush()
  assert.equal(
    visible().querySelector("article input").value,
    "Classify requests"
  )
  click("＋ 添加输出")
  assert.equal(visible().querySelectorAll("button.output").length, 2)
  visible().querySelector("button.output").click()
  assert.equal(
    visible().querySelector("textarea").value,
    "Choose the department"
  )
  visible().querySelectorAll("button.output")[1].click()
  click("删除此输出")
  click("保存")
  await flush()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].id, "a")
  assert.equal(writes[0].input.value.actions[0].icon, "tag")
  assert.equal(writes[0].input.expectedVersion, "old")
  assert.equal(writes[0].input.value.actions[0].outputs[0].criteria, undefined)
  assert.equal(visible().querySelectorAll(".inspector fieldset").length, 1)
  mounted.dispose()
  dom.window.close()
  delete globalThis.document
})
