// index.ts
// Server half: registers the quota and model-tier RPCs. Its only option, set
// on the opencode.jsonc entry, is `tiers: true` to allow the GitHub Copilot
// model-category requests; the terminal half decides how often to call.
import { Plugin } from "@opencode/plugin"
import { Tiers, Usage } from "./rpc.ts"
import { createTiers } from "./server/tiers.mjs"
import { createUsage } from "./server/usage.mjs"

export default Plugin.define({
  id: "pillbox",
  async setup(ctx) {
    const usage = createUsage({ integration: ctx.integration })
    const tiers = createTiers({ integration: ctx.integration, enabled: ctx.options?.tiers === true })
    const registrations = await Promise.all([
      ctx.rpc.register(Usage, { get: () => usage.get() }),
      ctx.rpc.register(Tiers, { get: () => tiers.get() }),
    ])
    return async () => {
      await Promise.all(registrations.map((registration) => registration.dispose()))
    }
  },
})
