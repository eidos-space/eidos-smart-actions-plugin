import type { Activate } from "@eidos.space/plugin-sdk"
import { parseConfig, runAction } from "./core"
import { iconDefinition } from "./icons"
const activate: Activate = (ctx) => {
  ctx.actions.registerTableProvider("smart-actions", {
    async getItems({ table }) {
      return parseConfig((await table.pluginConfig.read()).value).actions.map(
        (a) => ({
          id: a.id,
          title: a.title,
          icon: iconDefinition(a.icon),
          targets: ["row", "selection", "view"],
        })
      )
    },
    run: runAction,
  })
}
export default activate
