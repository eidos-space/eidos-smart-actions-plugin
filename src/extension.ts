import type { Activate } from "@eidos.space/plugin-sdk"
import { parseConfig, runAction } from "./core"
import { iconDefinition } from "./icons"
const activate: Activate = (ctx) => {
  ctx.capabilities.actions.registerTableProvider("smart-actions", {
    async getItems({ capabilities: { eidos: { table, config } } }) {
      return parseConfig((await config.read(table.tableId)).value).actions.map(
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
