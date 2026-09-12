// Contract check. Validates every golden fixture against the zod schema.
// services/api/contract_test.go validates the SAME files against the Go
// structs, so a change on either side that the other has not made fails here
// or there. Run: node verify.mjs
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { DashboardResponse } from "./index.ts"

const dir = join(dirname(fileURLToPath(import.meta.url)), "fixtures")
const schemas = { "dashboard.json": DashboardResponse }

let failed = 0
for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const schema = schemas[file]
  if (!schema) {
    console.error(`✗ ${file}: no schema registered in verify.mjs`)
    failed++
    continue
  }
  const result = schema.safeParse(JSON.parse(readFileSync(join(dir, file), "utf8")))
  if (result.success) {
    console.log(`✓ ${file}`)
  } else {
    console.error(`✗ ${file}`)
    for (const issue of result.error.issues) {
      console.error(`    ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    }
    failed++
  }
}
process.exit(failed === 0 ? 0 : 1)
