import type {
  Mount,
  EidosFileContext,
  TablePluginConfig,
} from "@eidos.space/plugin-sdk"
import {
  parseConfig,
  fieldChoices,
  resolveAction,
  type Config,
  type SmartAction,
  type Output,
} from "./core"
import { actionIcons, iconElement, type ActionIcon } from "./icons"
import { generateAction } from "./generator"

async function configureTable(
  root: HTMLElement,
  table: {
    read(): ReturnType<EidosFileContext["readTable"]>
    pluginConfig: Pick<TablePluginConfig, "read" | "write">
  },
  connections: EidosFileContext["connections"],
  navigation: {
    tables: Array<{ id: string; name: string }>
    current: string
    show(id: string): void
    width(): number
    resize(width: number): number
  }
) {
  const [snapshot, stored] = await Promise.all([
    table.read(),
    table.pluginConfig.read(),
  ])
  let config = parseConfig(stored.value),
    version = stored.version,
    selected = config.actions[0]?.id,
    dirty = false
  const fields = snapshot.fields.filter((f) => !f.systemRole)
  const outputs = fields.filter(
    (f) =>
      f.writable !== false &&
      !f.isDerived &&
      ["text", "select", "number", "checkbox"].includes(f.type)
  )
  const style = document.createElement("style")
  style.textContent = `*{box-sizing:border-box}body{margin:0;background:var(--eidos-background);color:var(--eidos-foreground);font:13px/1.5 var(--eidos-font-family,system-ui);color-scheme:var(--eidos-color-scheme)}button,input,select,textarea{font:inherit;color:inherit}button{display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;border:1px solid transparent;background:transparent;padding:5px 9px;border-radius:5px;min-height:30px}button:hover{background:var(--eidos-surface-hover,color-mix(in srgb,var(--eidos-foreground) 6%,var(--eidos-background)))}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--eidos-foreground);outline-offset:2px}button svg{width:16px;height:16px;flex-shrink:0}input,select,textarea{border:1px solid var(--eidos-border);border-radius:5px;background:var(--eidos-background);padding:6px 9px;width:100%;min-height:32px}textarea{resize:vertical;min-height:72px;line-height:1.6}small{display:block;color:color-mix(in srgb,var(--eidos-foreground) 60%,transparent);font-size:12px;margin:0 0 12px}.file-bar{height:52px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;border-bottom:1px solid var(--eidos-border);position:sticky;top:0;background:var(--eidos-background);z-index:2}.file-bar strong{font-size:13px;font-weight:600}.file-bar label{display:flex;gap:10px;align-items:center;color:color-mix(in srgb,var(--eidos-foreground) 65%,transparent);font-size:12px}.file-bar select{width:180px;color:var(--eidos-foreground);min-height:28px;padding:3px 8px}main{display:grid;grid-template-columns:200px minmax(0,1fr);min-height:calc(100vh - 52px)}nav{padding:16px 10px;border-right:1px solid var(--eidos-border)}.nav-heading{font-size:11px;color:color-mix(in srgb,var(--eidos-foreground) 55%,transparent);padding:0 10px 10px;font-weight:500}nav button{display:flex;justify-content:flex-start;width:100%;text-align:left;margin-bottom:3px;overflow-wrap:anywhere}nav button[aria-current=true]{background:var(--eidos-surface-hover,color-mix(in srgb,var(--eidos-foreground) 6%,var(--eidos-background)));font-weight:500}nav button:last-child{margin-top:12px;color:color-mix(in srgb,var(--eidos-foreground) 65%,transparent)}article{padding:26px 32px 0;max-width:800px;min-width:0}article>label:first-child input{font-size:18px;font-weight:600;line-height:1.5;padding:5px 0;border-color:transparent;border-radius:0}article>label:first-child input:focus{border-bottom-color:var(--eidos-border);outline:none}label{display:block;margin:0 0 18px}label>span{display:block;font-size:12px;font-weight:500;margin-bottom:7px;color:color-mix(in srgb,var(--eidos-foreground) 72%,transparent)}.icon-picker{display:flex;flex-wrap:wrap;gap:5px}.icon-picker button{width:32px;height:32px;padding:7px;border-color:var(--eidos-border)}.icon-picker button[aria-pressed=true]{background:var(--eidos-surface-hover,color-mix(in srgb,var(--eidos-foreground) 6%,var(--eidos-background)));border-color:var(--eidos-foreground)}fieldset{min-width:0;border:0;border-top:1px solid var(--eidos-border);padding:18px 0 6px;margin:22px 0 8px}legend{font-size:12px;font-weight:600;padding:0 8px 0 0}.row{display:flex;gap:16px;align-items:start}.row>*{flex:1;min-width:0}.check{display:inline-flex;gap:6px;align-items:center;margin:0 12px 8px 0;padding:4px 8px;border:1px solid var(--eidos-border);border-radius:5px;font-size:12px;cursor:pointer}.check:has(input:checked){background:var(--eidos-surface-hover,color-mix(in srgb,var(--eidos-foreground) 6%,var(--eidos-background)))}.check input{width:13px;height:13px;min-height:0;accent-color:var(--eidos-foreground)}fieldset>p{font-size:12px;color:color-mix(in srgb,var(--eidos-foreground) 65%,transparent);line-height:1.7;margin:0 0 8px}fieldset>button{font-size:12px;color:color-mix(in srgb,var(--eidos-foreground) 55%,transparent);padding-left:0}article>button{border:1px dashed var(--eidos-border);width:100%;margin:4px 0 22px;color:color-mix(in srgb,var(--eidos-foreground) 70%,transparent)}.primary{background:var(--eidos-foreground);color:var(--eidos-background);padding-inline:14px}.primary:hover{opacity:.85;background:var(--eidos-foreground)}footer{position:sticky;bottom:0;display:flex;align-items:center;gap:8px;border-top:1px solid var(--eidos-border);padding:12px 0;margin-top:24px;background:var(--eidos-background)}footer button{font-size:12px}footer button:last-child{margin-left:auto}.notice{margin:12px 0;white-space:pre-wrap;font-size:12px;color:color-mix(in srgb,var(--eidos-foreground) 70%,transparent)}.empty{padding:48px 0;max-width:360px;color:color-mix(in srgb,var(--eidos-foreground) 65%,transparent)}@media(max-width:600px){main{grid-template-columns:150px minmax(0,1fr)}article{padding:20px 16px 0}.row{display:block}.file-bar{padding:0 12px}.file-bar select{width:130px}}@media(max-width:420px){main{grid-template-columns:1fr}nav{border-right:0;border-bottom:1px solid var(--eidos-border)}nav button{width:auto;display:inline-flex}.nav-heading{display:none}}`
  style.textContent += `
summary{cursor:pointer;list-style:none;border-radius:4px}summary::-webkit-details-marker{display:none}summary:focus-visible{outline:2px solid var(--eidos-foreground);outline-offset:3px}summary svg{width:20px;height:20px;flex-shrink:0}summary:hover{background:var(--eidos-surface-hover)}article{max-width:1040px;padding-bottom:32px}.action-heading{display:flex;align-items:center;gap:12px;margin-bottom:24px}.action-heading>input{font-size:20px;font-weight:600;border-color:transparent;padding:4px 0;min-width:0}.action-heading>input:focus{border-bottom-color:var(--eidos-border)}.action-heading footer{position:static;margin:0;padding:0;border:0;flex-shrink:0}.action-heading footer button:last-child{margin-left:0}.icon-menu{position:relative}.icon-menu>summary{display:flex;padding:6px}.icon-picker{position:absolute;top:38px;left:0;width:170px;padding:10px;background:var(--eidos-background);border:1px solid var(--eidos-border);border-radius:6px;z-index:3;box-shadow:0 4px 16px #0001}.input-summary{margin-bottom:28px}.input-summary>summary{display:inline-block;padding:4px 0}.input-summary>div{margin-top:12px}h3{font-size:12px;display:flex;align-items:center;gap:12px;margin:0 0 12px}h3 small{margin:0;font-weight:400}.output{border-top:1px solid var(--eidos-border)}.output>summary{display:flex;align-items:center;gap:14px;padding:15px 8px}.output>summary:after{content:'›';margin-left:auto;font-size:20px}.output[open]>summary:after{content:'⌄'}.output>summary>div{min-width:0}.output>summary strong{font-weight:600}.output>summary span{margin-left:12px;font-size:12px;color:color-mix(in srgb,var(--eidos-foreground) 65%,transparent)}.output>summary small{margin:3px 0 0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:650px}.output fieldset{border:0;margin:0;padding:4px 8px 16px 42px}.output textarea{min-height:88px}.field-options{font-size:12px;margin:0 0 16px;color:color-mix(in srgb,var(--eidos-foreground) 65%,transparent)}.field-options>summary:after{content:' ›'}.field-options p{overflow-wrap:anywhere}.advanced{margin-top:20px;font-size:12px;color:color-mix(in srgb,var(--eidos-foreground) 65%,transparent)}.advanced label{margin-top:12px;max-width:280px}article>button{width:auto;border:0;margin:12px 0 0;padding-left:8px}.more-menu{position:relative}.more-menu>summary{padding:4px 10px;font-size:20px}.more-menu[open]{z-index:4}.more-menu>button{display:block;white-space:nowrap;background:var(--eidos-background);border:1px solid var(--eidos-border);width:120px;text-align:left}.more-menu>button:nth-child(2){position:absolute;right:0;top:34px}.more-menu>button:nth-child(3){position:absolute;right:0;top:66px}.create-menu{margin-top:16px}.create-menu>summary{padding:6px 9px}.create-menu button{font-size:12px;padding-left:20px}nav .create-menu button:last-child{margin-top:0}.notice{margin-top:18px}button:disabled{opacity:.5;cursor:default}@media(max-width:600px){.action-heading{flex-wrap:wrap;gap:8px}.action-heading>input{flex:1;font-size:17px}.action-heading footer{margin-left:auto}.output fieldset{padding-left:8px}.output>summary small{max-width:200px}}
`
  style.textContent += `
main{display:grid;grid-template-columns:minmax(0,1fr) minmax(340px,.85fr);grid-template-rows:auto minmax(0,1fr);height:calc(100vh - 52px);min-height:0}nav{grid-column:1/-1;display:flex;align-items:center;gap:16px;padding:12px 24px;border-right:0;border-bottom:1px solid var(--eidos-border)}nav>select{width:250px}nav footer{position:static;margin:0 0 0 auto;padding:0;border:0}nav footer button{width:auto;margin:0}nav footer button:last-child{margin:0;color:var(--eidos-background)}nav .more-menu button{width:120px;color:var(--eidos-foreground)}.create-menu{position:relative;margin:0}.create-menu>summary{white-space:nowrap}.create-menu>button{position:absolute;top:34px;left:0;width:150px;background:var(--eidos-background);border:1px solid var(--eidos-border);z-index:5;padding:8px 12px}.create-menu>button:last-child{top:70px}article{padding:28px;max-width:none;overflow:auto;min-height:0}.action-heading{margin-bottom:12px}.input-summary{margin-bottom:28px}.inspector{padding:28px;border-left:1px solid var(--eidos-border);overflow:auto;min-width:0;min-height:0}.inspector h2{margin:0 0 4px;font-size:20px}.inspector>small{margin-bottom:28px}.inspector fieldset{border:0;padding:0;margin:0}.inspector textarea{min-height:180px}.inspector .row{gap:12px}article>button.output{display:block;width:100%;border:0;border-bottom:1px solid var(--eidos-border);margin:0;padding:16px 12px;text-align:left;border-radius:0;color:var(--eidos-foreground)}article>button.output[aria-pressed=true]{background:var(--eidos-surface-hover);box-shadow:inset 2px 0 var(--eidos-foreground)}.output-summary{display:flex;align-items:center;gap:12px}.output-summary>div{min-width:0;flex:1}.output-summary svg{width:18px;height:18px;flex-shrink:0}.output-summary span{font-size:12px;margin-left:12px;color:color-mix(in srgb,var(--eidos-foreground) 65%,transparent)}.output-summary small{margin:4px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.output-summary:after{content:'›';font-size:20px}.advanced{margin-top:24px}@media(max-width:800px){main{grid-template-columns:minmax(0,.9fr) minmax(280px,1fr)}article,.inspector{padding:20px 16px}.inspector .row{display:block}nav{padding:10px 16px;gap:8px}nav>select{width:180px}.action-heading>input{font-size:17px}}@media(max-width:580px){main{height:auto;display:block}nav{display:flex;flex-wrap:wrap}nav>select{flex:1}.inspector{border-left:0;border-top:1px solid var(--eidos-border)}article{padding-bottom:20px}}
`
  style.textContent += `
main.empty-state{display:flex;flex-direction:column}main.empty-state article{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px 100px}.empty-state .empty{padding:0;max-width:420px;text-align:center;color:var(--eidos-foreground)}.empty h2{font-size:22px;font-weight:600;margin:0 0 12px}.empty p{font-size:13px;line-height:1.8;margin:0;color:color-mix(in srgb,var(--eidos-foreground) 65%,transparent)}.empty-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:10px;margin-top:24px}.empty-actions button{padding:7px 14px}.empty-actions button:not(.primary){border-color:var(--eidos-border)}main.generator-state{grid-template-columns:1fr}main.generator-state article{width:100%;max-width:680px;margin:0 auto;padding-top:48px}.empty-state nav{flex-shrink:0}.empty-state .notice{text-align:center}@media(max-width:580px){main.empty-state{min-height:calc(100vh - 52px)}main.empty-state article{padding-bottom:60px}}
`
  style.textContent += `
main{grid-template-columns:220px minmax(0,1fr);grid-template-rows:auto 1fr;height:auto;min-height:100vh}nav{grid-column:1;grid-row:1/3;display:block;border-right:1px solid var(--eidos-border);border-bottom:0;padding:22px 12px;position:sticky;top:0;height:100vh;overflow:auto}nav>strong{display:block;margin:0 10px 24px}nav button.table-entry{font-weight:600;margin:18px 0 8px;width:100%;color:var(--eidos-foreground)}.action-list{padding-left:16px}.action-list>button{width:100%;margin:2px 0;font-size:13px}.action-list>button:last-child{margin-top:0}.create-menu{margin:8px 0 14px}.create-menu>button{position:static;width:100%;border:0;padding:7px 9px;font-size:12px}.create-menu>summary{font-size:12px;padding:7px 9px}.action-list button[aria-current=true]{background:var(--eidos-surface-hover)}article{grid-column:2;grid-row:1;padding:22px 26px;overflow:visible}.breadcrumb{margin-bottom:10px}.action-heading{margin-bottom:24px}.action-heading footer{margin-left:auto}.action-heading>input{flex:1}.flow-map{display:grid;grid-template-columns:minmax(150px,1fr) 24px minmax(140px,.7fr) 24px minmax(190px,1fr);align-items:center;gap:8px;padding:22px 0}.flow-input,.flow-output{align-self:stretch;min-width:0;border:1px solid var(--eidos-border);border-radius:6px;padding:16px}.flow-input h3,.flow-output h3{font-size:14px;margin-bottom:16px}.flow-input .check{display:flex;width:100%;padding:10px;margin:0 0 8px;border-color:transparent}.flow-input .check:has(input:checked){border-color:var(--eidos-border)}.flow-route{border:1px solid var(--eidos-border);background:var(--eidos-surface-hover);border-radius:6px;text-align:center;padding:18px 12px;overflow-wrap:anywhere}.flow-route svg{width:22px;height:22px;margin-bottom:8px}.flow-route strong{display:block;font-size:14px}.flow-route small{margin:8px 0 0}.flow-arrow{font-size:26px;text-align:center;color:color-mix(in srgb,var(--eidos-foreground) 55%,transparent)}.flow-output .output{width:100%;display:block;margin:0 0 8px;padding:10px;text-align:left;border:1px solid var(--eidos-border);border-radius:5px}.flow-output .output[aria-pressed=true]{background:var(--eidos-surface-hover);border-color:var(--eidos-foreground)}.flow-output .output-summary small{display:none}.flow-output .output-summary span{display:block;margin:4px 0 0}.flow-output .output-summary:after{display:none}.flow-output>button:last-child{font-size:12px}.advanced{margin-top:8px}.inspector{grid-column:2;grid-row:2;border-left:0;border-top:1px solid var(--eidos-border);padding:24px 26px;overflow:visible}.inspector>p{font-size:12px;color:color-mix(in srgb,var(--eidos-foreground) 65%,transparent);margin:0 0 14px}.inspector>small{display:none}.inspector h2{font-size:18px;margin-bottom:20px}.inspector fieldset{max-width:1000px}.inspector textarea{min-height:110px}.inspector .row{display:flex}.inspector label{margin-bottom:16px}main.empty-state,main.generator-state{display:grid;grid-template-columns:220px minmax(0,1fr)}main.empty-state article{min-height:100vh;grid-row:1/3}main.generator-state article{grid-column:2;grid-row:1/3;margin:0 auto;max-width:740px}.empty-state nav{display:block}.generator-state nav{display:block}@media(max-width:1050px){.flow-map{grid-template-columns:minmax(130px,1fr) 18px 125px 18px minmax(150px,1fr);gap:4px}.flow-input,.flow-output{padding:10px}article,.inspector{padding:20px 16px}main,main.empty-state,main.generator-state{grid-template-columns:180px minmax(0,1fr)}}@media(max-width:760px){.flow-map{grid-template-columns:1fr}.flow-arrow{transform:rotate(90deg)}.flow-input .check{width:auto;display:inline-flex}.flow-route{padding:12px}.flow-route svg{display:none}.flow-output .output-summary span{display:inline;margin-left:10px}.action-heading{flex-wrap:wrap}.inspector .row{display:block}}@media(max-width:480px){main,main.empty-state,main.generator-state{grid-template-columns:130px minmax(0,1fr)}nav{padding:18px 6px}.action-list{padding-left:6px}nav>strong{margin-inline:4px;font-size:12px}article,.inspector{padding:16px 12px}}
`
  style.textContent += `
main,main.empty-state,main.generator-state{grid-template-columns:var(--smart-sidebar-width,220px) minmax(0,1fr)}nav{overflow:visible}nav .table-entry{gap:7px;align-items:center;text-align:left}nav .table-chevron{width:14px;height:14px;flex:0 0 14px;transform:rotate(0)}nav .table-entry[aria-expanded=true] .table-chevron{transform:rotate(90deg)}.action-list[hidden]{display:none!important}.sidebar-resizer{position:absolute;right:-4px;top:0;width:8px;height:100%;z-index:10;cursor:col-resize;touch-action:none}.sidebar-resizer:after{content:'';position:absolute;left:3px;top:0;width:2px;height:100%;background:transparent}.sidebar-resizer:hover:after,.sidebar-resizer:focus-visible:after,.resizing .sidebar-resizer:after{background:var(--eidos-foreground)}.sidebar-resizer:focus-visible{outline:none}.resizing{user-select:none;cursor:col-resize}.resizing *{cursor:col-resize!important}.create-menu>summary{display:flex;align-items:center;gap:8px}.create-menu>summary:after{content:'›';margin-left:auto}.create-menu[open]>summary:after{transform:rotate(90deg)}nav button.table-entry:last-child{margin-top:18px}
`
  style.textContent += `
.create-menu>.create-trigger{position:static;width:100%;margin:0;padding:5px 9px;min-height:30px;font-size:12px;border:0;background:transparent;color:var(--eidos-foreground);justify-content:flex-start}.create-menu>.create-trigger:hover,.create-menu>.create-trigger[aria-expanded=true]{background:var(--eidos-surface-hover)}.create-menu>.create-trigger:focus-visible{outline:1px solid var(--eidos-border);outline-offset:-1px}.create-options{position:fixed;inset:auto;margin:0;min-width:192px;padding:4px;border:1px solid var(--eidos-border);border-radius:8px;background:var(--eidos-background);color:var(--eidos-foreground);box-shadow:0 8px 24px #0002;font-size:12px}.create-options:popover-open{display:grid}.create-options::backdrop{background:transparent}.create-options button,.create-options button:last-child{position:static;display:flex;align-items:center;justify-content:flex-start;gap:8px;min-height:30px;width:100%;margin:0;padding:5px 8px;border:0;border-radius:4px;background:transparent;color:var(--eidos-foreground);font-size:12px;white-space:nowrap}.create-options button:hover,.create-options button:focus-visible{background:var(--eidos-surface-hover);outline:none}.create-options button svg{width:14px;height:14px;color:color-mix(in srgb,var(--eidos-foreground) 65%,transparent)}
`
  root.append(style)
  const surface = document.createElement("div")
  root.append(surface)
  const element = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text?: string
  ) => {
    const el = document.createElement(tag)
    if (text !== undefined) el.textContent = text
    return el
  }
  const mark = () => {
    dirty = true
  }
  const button = (title: string, run: () => void) => {
    const el = element("button", title)
    el.type = "button"
    el.onclick = run
    return el
  }
  const label = (title: string, control: HTMLElement) => {
    const el = element("label")
    el.append(element("span", title), control)
    return el
  }
  const input = (
    value: string,
    change: (value: string) => void,
    multiline = false
  ) => {
    const el = multiline ? element("textarea") : element("input")
    el.value = value
    el.oninput = () => {
      change(el.value)
      mark()
    }
    return el
  }
  const select = (
    options: Array<[string, string]>,
    value: string,
    change: (value: string) => void
  ) => {
    const el = element("select")
    for (const [id, name] of options) {
      const option = element("option", name)
      option.value = id
      el.append(option)
    }
    el.value = value
    el.onchange = () => {
      change(el.value)
      mark()
      render()
    }
    return el
  }
  let notice = ""
  const selectedOutputs = new Map<string, string>()
  let generating = false,
    generatorOpen = false,
    requirement = "",
    generationNotice = "",
    generatorConfigured = false
  const freshOutput = (): Output => ({
    id: crypto.randomUUID(),
    fieldId: "",
    type: "choice",
    instructions: "判断记录所属的类别",
    criteria: ["相关", "不相关"],
  })
  let collapsed = false
  const render = () => {
    surface.replaceChildren()
    const main = element("main"),
      nav = element("nav"),
      article = element("article")
    main.append(nav, article)
    surface.append(main)
    nav.setAttribute("aria-label", "数据表与动作")
    const handle = element("div")
    handle.className = "sidebar-resizer"
    handle.tabIndex = 0
    handle.setAttribute("role", "separator")
    handle.setAttribute("aria-label", "调整侧栏宽度")
    handle.setAttribute("aria-orientation", "vertical")
    handle.setAttribute("aria-valuemin", "160")
    handle.setAttribute("aria-valuemax", "420")
    handle.setAttribute("aria-valuenow", String(navigation.width()))
    const resize = (width: number) =>
      handle.setAttribute("aria-valuenow", String(navigation.resize(width)))
    handle.onpointerdown = (event) => {
      if (event.button !== 0) return
      event.preventDefault()
      const startX = event.clientX,
        startWidth = navigation.width()
      handle.setPointerCapture(event.pointerId)
      main.classList.add("resizing")
      handle.onpointermove = (move) =>
        resize(startWidth + move.clientX - startX)
    }
    const endResize = () => {
      handle.onpointermove = null
      main.classList.remove("resizing")
    }
    handle.onpointerup = endResize
    handle.onpointercancel = endResize
    handle.onlostpointercapture = endResize
    handle.ondblclick = () => resize(220)
    handle.onkeydown = (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
      event.preventDefault()
      resize(navigation.width() + (event.key === "ArrowLeft" ? -10 : 10))
    }
    nav.append(handle)
    nav.append(element("strong", "Smart Actions"))
    for (const table of navigation.tables) {
      const tableButton = button(table.name, () => {
        if (table.id === navigation.current) {
          collapsed = !collapsed
          const list = nav.querySelector<HTMLElement>(".action-list")
          if (list) list.hidden = collapsed
          tableButton.setAttribute("aria-expanded", String(!collapsed))
        } else navigation.show(table.id)
      })
      tableButton.className = "table-entry"
      tableButton.setAttribute(
        "aria-expanded",
        String(table.id === navigation.current && !collapsed)
      )
      const chevron = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      )
      chevron.setAttribute("viewBox", "0 0 16 16")
      chevron.setAttribute("aria-hidden", "true")
      chevron.classList.add("table-chevron")
      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      )
      path.setAttribute("d", "M6 3.5 10.5 8 6 12.5")
      path.setAttribute("fill", "none")
      path.setAttribute("stroke", "currentColor")
      path.setAttribute("stroke-width", "1.5")
      path.setAttribute("stroke-linecap", "round")
      path.setAttribute("stroke-linejoin", "round")
      chevron.append(path)
      tableButton.prepend(chevron)
      nav.append(tableButton)
      if (table.id !== navigation.current) continue
      const actionList = element("div")
      actionList.className = "action-list"
      actionList.hidden = collapsed
      for (const item of config.actions) {
        const entry = button(item.title || "未命名动作", () => {
          generatorOpen = false
          selected = item.id
          render()
        })
        entry.prepend(iconElement(item.icon))
        entry.setAttribute(
          "aria-current",
          String(item.id === selected && !generatorOpen)
        )
        actionList.append(entry)
      }
      nav.append(actionList)
    }
    const createMenu = element("div")
    createMenu.className = "create-menu"
    const createOptions = element("div")
    createOptions.className = "create-options"
    createOptions.setAttribute("popover", "auto")
    createOptions.setAttribute("role", "menu")
    createOptions.setAttribute("aria-label", "新建动作")
    const createTrigger = button("＋ 新建动作", () => {
      if (createOptions.matches(":popover-open")) {
        createOptions.hidePopover()
        return
      }
      const rect = createTrigger.getBoundingClientRect()
      createOptions.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 208))}px`
      createOptions.style.top = `${Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - 92))}px`
      createOptions.showPopover()
      createOptions.querySelector<HTMLButtonElement>("button")?.focus()
    })
    createTrigger.className = "create-trigger"
    createTrigger.setAttribute("aria-haspopup", "menu")
    createTrigger.setAttribute("aria-expanded", "false")
    createOptions.addEventListener("toggle", () =>
      createTrigger.setAttribute(
        "aria-expanded",
        String(createOptions.matches(":popover-open"))
      )
    )
    createOptions.onkeydown = (event) => {
      const items = Array.from(createOptions.querySelectorAll("button"))
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        event.preventDefault()
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                items.length
        items[next]?.focus()
      }
      if (event.key === "Escape" || event.key === "Tab") {
        createOptions.hidePopover()
        createTrigger.focus()
        if (event.key === "Escape") event.preventDefault()
      }
    }
    createMenu.append(createTrigger, createOptions)
    nav.querySelector(".action-list")!.append(createMenu)
    createOptions.append(
      button("用 AI 生成动作", () => {
        generatorOpen = !generatorOpen
        render()
        if (generatorOpen)
          void connections
            ?.configured("action-generator")
            .then((configured) => {
              generatorConfigured = configured
              generationNotice = configured
                ? ""
                : "请先到 插件 → Smart Actions → 设置 配置 Action Generator 的 Endpoint、API Key 和模型，再重新打开此入口。"
              render()
            })
            .catch((error: unknown) => {
              generationNotice = String(error)
              render()
            })
      }),
      button("手动创建", () => {
        generatorOpen = false
        const action: SmartAction = {
          id: crypto.randomUUID(),
          title: "新动作",
          icon: "sparkles",
          inputs: fields
            .filter((f) => f.type === "text")
            .slice(0, 1)
            .map((f) => f.id),
          outputs: [freshOutput()],
          model: "jev-latest",
          connection: "typesafe-default",
        }
        config.actions.push(action)
        selectedOutputs.set(action.id, action.outputs[0]!.id)
        selected = action.id
        mark()
        render()
      })
    )
    Array.from(createOptions.querySelectorAll("button")).forEach(
      (item, index) => {
        item.setAttribute("role", "menuitem")
        item.prepend(iconElement(index === 0 ? "sparkles" : "text"))
      }
    )
    if (generatorOpen) {
      main.className = "generator-state"
      article.append(element("h2", "用自然语言生成动作"))
      article.append(
        element(
          "small",
          "仅发送当前表的字段结构和你的需求，不发送记录内容。生成后可修改，保存前不会生效。"
        )
      )
      const prompt = element("textarea")
      prompt.setAttribute("aria-label", "动作需求")
      prompt.placeholder = "例如：根据消息给客户请求分类，并判断紧急程度"
      prompt.value = requirement
      prompt.maxLength = 8000
      prompt.disabled = generating
      prompt.oninput = () => {
        requirement = prompt.value
      }
      article.append(label("你想让这个动作做什么？", prompt))
      const generate = button(generating ? "正在生成…" : "生成草稿", () => {
        if (generating) return
        generating = true
        generationNotice = ""
        render()
        void generateAction(connections, requirement, fields)
          .then((action) => {
            if (config.actions.length >= 50)
              throw new Error("最多支持 50 个动作")
            config.actions.push(action)
            if (action.outputs[0])
              selectedOutputs.set(action.id, action.outputs[0].id)
            selected = action.id
            dirty = true
            generatorOpen = false
            notice = "已生成草稿，请检查字段和判断规则后保存。"
          })
          .catch((error: unknown) => {
            generationNotice =
              error instanceof Error ? error.message : String(error)
          })
          .finally(() => {
            generating = false
            render()
          })
      })
      generate.className = "primary"
      generate.disabled = generating || !generatorConfigured
      article.append(generate)
      if (generationNotice) {
        const status = element("p", generationNotice)
        status.setAttribute("role", "status")
        article.append(status)
      }
      return
    }
    const action = config.actions.find((a) => a.id === selected)
    if (!action) {
      main.className = "empty-state"
      const empty = element("div")
      empty.className = "empty"
      empty.append(
        element("h2", "创建第一个动作"),
        element("p", "为当前数据表添加分类、评分或判断规则。")
      )
      const actions = element("div")
      actions.className = "empty-actions"
      const creationButtons = Array.from(
        createOptions.querySelectorAll("button")
      )
      creationButtons.forEach((item) => item.removeAttribute("role"))
      creationButtons[0]!.className = "primary"
      actions.append(...creationButtons)
      empty.append(actions)
      createMenu.remove()
      article.append(empty)
    } else {
      const iconPicker = element("div")
      iconPicker.className = "icon-picker"
      iconPicker.setAttribute("aria-label", "动作图标")
      for (const [key, icon] of Object.entries(actionIcons)) {
        const choice = button(icon.label, () => {
          action.icon = key as ActionIcon
          mark()
          render()
        })
        choice.textContent = ""
        choice.title = icon.label
        choice.setAttribute("aria-label", icon.label)
        choice.setAttribute(
          "aria-pressed",
          String((action.icon ?? "sparkles") === key)
        )
        choice.append(iconElement(key as ActionIcon))
        iconPicker.append(choice)
      }
      const heading = element("header")
      heading.className = "action-heading"
      const icons = element("details")
      icons.className = "icon-menu"
      const iconTrigger = element("summary")
      iconTrigger.setAttribute("aria-label", "选择动作图标")
      iconTrigger.title = "选择动作图标"
      iconTrigger.append(iconElement(action.icon))
      icons.append(iconTrigger, iconPicker)
      const title = input(action.title, (v) => {
        action.title = v
        const node = surface.querySelector(".flow-route strong")
        if (node) node.textContent = v || "未命名动作"
        const entry = surface.querySelector('nav button[aria-current="true"]')
        if (entry) {
          entry.replaceChildren(
            iconElement(action.icon),
            document.createTextNode(v || "未命名动作")
          )
        }
      })
      title.setAttribute("aria-label", "动作名称")
      heading.append(icons, title)
      article.append(heading)
      const breadcrumb = element(
        "small",
        navigation.tables.find((t) => t.id === navigation.current)?.name
      )
      breadcrumb.className = "breadcrumb"
      article.prepend(breadcrumb)
      const inputs = element("details")
      inputs.className = "input-summary"
      const inputSummary = element("summary")
      const refreshInputSummary = () => {
        inputSummary.textContent = `读取 ${
          fields
            .filter((f) => action.inputs.includes(f.id))
            .map((f) => f.name)
            .join("、") || "选择输入字段"
        } · 修改`
      }
      refreshInputSummary()
      inputs.append(inputSummary)
      const choices = element("div")
      for (const field of fields) {
        const check = element("input")
        check.type = "checkbox"
        check.checked = action.inputs.includes(field.id)
        check.onchange = () => {
          action.inputs = check.checked
            ? [...action.inputs, field.id]
            : action.inputs.filter((id) => id !== field.id)
          mark()
          refreshInputSummary()
          const mapping = surface.querySelector(".inspector>p")
          if (mapping)
            mapping.textContent = `从 ${
              fields
                .filter((f) => action.inputs.includes(f.id))
                .map((f) => f.name)
                .join("、") || "所选输入字段"
            } 读取 → 写入 ${surface.querySelector(".inspector h2")?.textContent || "待选择字段"}`
        }
        const item = element("label")
        item.className = "check"
        item.append(check, document.createTextNode(field.name))
        choices.append(item)
      }
      inputs.append(choices)
      article.append(inputs)
      const outputHeading = element("h3", "写入字段")
      outputHeading.append(element("small", `${action.outputs.length} 个输出`))
      article.append(outputHeading)
      const inspector = element("aside")
      inspector.className = "inspector"
      inspector.setAttribute("aria-label", "输出设置")
      main.append(inspector)
      const activeOutput =
        action.outputs.find((o) => o.id === selectedOutputs.get(action.id)) ??
        action.outputs[0]
      if (!activeOutput)
        inspector.append(element("p", "添加一个输出，设置写入字段与判断规则。"))
      for (const [index, output] of action.outputs.entries()) {
        const disclosure = button("", () => {
          selectedOutputs.set(action.id, output.id)
          render()
          surface
            .querySelector<HTMLButtonElement>(
              `button[data-output-id="${output.id}"]`
            )
            ?.focus()
        })
        disclosure.className = "output"
        disclosure.dataset.outputId = output.id
        disclosure.setAttribute("aria-pressed", String(activeOutput === output))
        const summary = element("div")
        summary.className = "output-summary"
        const summaryText = element("div")
        const outputField = outputs.find((f) => f.id === output.fieldId)
        summaryText.append(
          element("strong", outputField?.name || "选择写入字段"),
          element(
            "span",
            output.type === "choice"
              ? "分类"
              : output.type === "score"
                ? "评分"
                : output.checkbox
                  ? "是 / 否"
                  : "概率"
          )
        )
        const description = element("small", output.instructions)
        summaryText.append(description)
        summary.append(
          iconElement(
            output.type === "choice"
              ? "tag"
              : output.type === "score"
                ? "chart"
                : "check"
          ),
          summaryText
        )
        disclosure.append(summary)
        article.append(disclosure)
        if (activeOutput !== output) continue
        inspector.append(
          element("h2", outputField?.name || "新输出"),
          element("small", "输出设置")
        )
        const group = element("fieldset")
        const row = element("div")
        row.className = "row"
        row.append(
          label(
            "写入字段",
            select(
              [
                ["", "选择已有字段"],
                ...outputs.map((f): [string, string] => [f.id, f.name]),
              ],
              output.fieldId,
              (id) => {
                output.fieldId = id
                const field = outputs.find((f) => f.id === id)
                output.type =
                  field?.type === "text" || field?.type === "select"
                    ? "choice"
                    : field?.type === "checkbox"
                      ? "noul"
                      : "score"
                output.checkbox = field?.type === "checkbox"
                output.criteria =
                  output.type === "choice"
                    ? ["相关", "不相关"]
                    : ["低", "中", "高"]
                if (field?.type === "select") delete output.criteria
              }
            )
          )
        )
        const field = outputs.find((f) => f.id === output.fieldId)
        row.append(
          label(
            "判断类型",
            select(
              field?.type === "text" || field?.type === "select"
                ? [["choice", "分类"]]
                : field?.type === "checkbox"
                  ? [["noul", "是 / 否"]]
                  : [
                      ["score", "评分"],
                      ["noul", "是的概率（0–1）"],
                    ],
              output.type,
              (v) => {
                output.type = v as Output["type"]
              }
            )
          )
        )
        group.append(
          row,
          label(
            "判断规则",
            input(
              output.instructions,
              (v) => {
                output.instructions = v
                description.textContent = v
              },
              true
            )
          )
        )
        if (field?.type === "select") {
          const choices = fieldChoices(field)
          const options = element("details")
          options.className = "field-options"
          options.append(
            element("summary", `使用字段的 ${choices.length} 个选项`),
            element(
              "p",
              choices.length ? choices.join("、") : "请先在字段设置中添加选项。"
            )
          )
          group.append(options)
        }
        if (output.type !== "noul" && field?.type !== "select")
          group.append(
            label(
              output.type === "choice"
                ? "类别（每行一个）"
                : "评分等级（由低到高，每行一个；结果从 0 开始）",
              input(
                (output.criteria ?? []).join("\n"),
                (v) => {
                  output.criteria = v
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean)
                },
                true
              )
            )
          )
        if (output.checkbox)
          group.append(
            label(
              "勾选阈值（0–1）",
              input(String(output.threshold ?? 0.5), (v) => {
                output.threshold = Number(v)
              })
            )
          )
        group.append(
          button("删除此输出", () => {
            action.outputs.splice(index, 1)
            mark()
            render()
          })
        )
        inspector.append(group)
      }
      article.append(
        button("＋ 添加输出", () => {
          const output = freshOutput()
          action.outputs.push(output)
          selectedOutputs.set(action.id, output.id)
          mark()
          render()
        })
      )
      const advanced = element("details")
      advanced.className = "advanced"
      advanced.append(element("summary", "高级设置"))
      advanced.append(
        label(
          "模型",
          input(action.model, (v) => {
            action.model = v
          })
        )
      )
      article.append(advanced)
      const graph = element("div")
      graph.className = "flow-map"
      const inputPanel = element("div")
      inputPanel.className = "flow-input"
      inputPanel.append(element("h3", "输入字段"), choices)
      inputs.remove()
      const route = element("div")
      route.className = "flow-route"
      route.append(
        iconElement(action.icon),
        element("strong", action.title || "未命名动作"),
        element("small", `${action.outputs.length} 条独立判断规则`)
      )
      const outputPanel = element("div")
      outputPanel.className = "flow-output"
      outputHeading.firstChild!.textContent = "输出字段"
      outputPanel.append(
        outputHeading,
        ...Array.from(article.querySelectorAll("button.output"))
      )
      const add = Array.from(article.children).find(
        (el) => el.tagName === "BUTTON" && el.textContent === "＋ 添加输出"
      )
      if (add) outputPanel.append(add)
      const arrow = () => {
        const el = element("span", "→")
        el.className = "flow-arrow"
        el.setAttribute("aria-hidden", "true")
        return el
      }
      graph.append(inputPanel, arrow(), route, arrow(), outputPanel)
      article.insertBefore(graph, advanced)
      inspector.prepend(
        element(
          "p",
          `从 ${
            fields
              .filter((f) => action.inputs.includes(f.id))
              .map((f) => f.name)
              .join("、") || "所选输入字段"
          } 读取 → 写入 ${outputs.find((f) => f.id === activeOutput?.fieldId)?.name || "待选择字段"}`
        )
      )
    }
    if (notice) {
      const p = element("p", notice)
      p.className = "notice"
      p.setAttribute("role", "status")
      article.append(p)
    }
    const footer = element("footer")
    const save = button("保存", () => {
      void (async () => {
        try {
          const next = parseConfig(config)
          const latest = await table.read()
          for (const action of next.actions) {
            resolveAction(action, latest.fields)
            for (const output of action.outputs) {
              if (
                latest.fields.some(
                  (f) => f.id === output.fieldId && f.type === "select"
                )
              )
                delete output.criteria
            }
          }
          const result = await table.pluginConfig.write({
            value: JSON.parse(JSON.stringify(next)),
            expectedVersion: version,
          })
          version = result.version
          config = next
          dirty = false
          notice = "已保存"
          render()
        } catch (error) {
          notice = String(error)
          render()
        }
      })()
    })
    save.className = "primary"
    const more = element("details")
    more.className = "more-menu"
    const moreTrigger = element("summary", "⋯")
    moreTrigger.setAttribute("aria-label", "更多操作")
    more.append(moreTrigger)
    footer.append(more, save)
    if (action)
      more.append(
        button("删除动作", () => {
          config.actions = config.actions.filter((a) => a !== action)
          selected = config.actions[0]?.id
          mark()
          render()
        })
      )
    more.append(
      button("重新读取", () => {
        void table.pluginConfig.read().then((saved) => {
          config = parseConfig(saved.value)
          version = saved.version
          selected = config.actions[0]?.id
          dirty = false
          notice = "已重新读取"
          render()
        })
      })
    )
    if (action) article.querySelector(".action-heading")!.append(footer)
    else if (dirty) {
      footer.prepend(element("span", "删除尚未保存"))
      article.prepend(footer)
    }
  }
  render()
  return {
    dispose() {
      root.replaceChildren()
    },
  }
}
const mount: Mount = async (ctx, root) => {
  if (ctx.binding.kind !== "eidos")
    throw new Error("使用 Smart Actions 打开一个 .eidos 文件")
  const file = ctx.binding.file
  const tables = await file.listTables()
  // Table navigation lives next to its actions in the persistent sidebar.
  const panels = new Map<string, HTMLElement>()
  let sidebarWidth = 220
  root.style.setProperty("--smart-sidebar-width", `${sidebarWidth}px`)
  const loads = new Map<string, Promise<unknown>>()
  let alive = true
  let sequence = 0
  async function show(id: string) {
    const request = ++sequence
    for (const value of panels.values()) value.inert = true
    let panel = panels.get(id)
    if (!panel) {
      panel = document.createElement("section")
      panel.hidden = true
      panels.set(id, panel)
      root.append(panel)
      const target = panel
      loads.set(
        id,
        configureTable(
          panel,
          {
            read: () => file.readTable(id),
            pluginConfig: {
              read: () => file.readPluginConfig(id),
              write: (input) => file.writePluginConfig(id, input),
            },
          },
          file.connections,
          {
            tables,
            current: id,
            width: () => sidebarWidth,
            resize: (width) => {
              sidebarWidth = Math.max(
                160,
                Math.min(
                  420,
                  Math.max(160, (root.clientWidth || 1024) - 320),
                  width
                )
              )
              root.style.setProperty(
                "--smart-sidebar-width",
                `${sidebarWidth}px`
              )
              return sidebarWidth
            },
            show: (next) => {
              void show(next)
            },
          }
        ).catch((error: unknown) => {
          target.textContent = String(error)
          const retry = document.createElement("button")
          retry.textContent = "重试"
          retry.onclick = () => {
            panels.delete(id)
            loads.delete(id)
            target.remove()
            void show(id)
          }
          target.append(retry)
        })
      )
    }
    await loads.get(id)
    if (!alive || request !== sequence) return
    for (const [key, value] of panels) value.hidden = key !== id
    panel.hidden = false
    panel.inert = false
  }
  if (tables[0]) await show(tables[0].id)
  else
    root.append(
      document.createTextNode("此文件没有数据表。请先在默认编辑器中创建表。")
    )
  return {
    dispose() {
      alive = false
      sequence++
      root.replaceChildren()
    },
  }
}
export default mount
