import type { Activate } from "@eidos.space/plugin-sdk"
import { parseConfig, runAction } from "./core"
import { iconDefinition } from "./icons"
import { localizeError } from "./errors"
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
    async run(context, itemId) {
      try { return await runAction(context, itemId) }
      catch (error) { throw new Error(localizeError(error, context.i18n)) }
    },
  })
}
export default activate
