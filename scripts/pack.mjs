import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFile, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const directory = new URL("../", import.meta.url)
const manifest = JSON.parse(await readFile(new URL("plugin.json", directory), "utf8"))
const name = `${manifest.id}-${manifest.version}.eidos-plugin`
execFileSync(process.execPath, [
  require.resolve("@eidos.space/plugin-tools/bin/eidos-plugin.mjs"),
  "pack",
  fileURLToPath(directory),
], { stdio: "inherit" })
const bytes = await readFile(new URL(`dist/${name}`, directory))
await writeFile(new URL("dist/SHA256SUMS", directory),
  `${createHash("sha256").update(bytes).digest("hex")}  ${name}\n`)
