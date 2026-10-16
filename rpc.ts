// rpc.ts
// The contract between the server half (index.ts) and the terminal half
// (tui.tsx), in portable JSON Schema form. Outputs carry quota figures only:
// never credentials, account ids, or raw provider responses.
import { Rpc } from "@opencode/plugin/rpc"

const EMPTY = { type: "object", properties: {}, additionalProperties: false } as const

const WINDOW = {
  type: "object",
  properties: {
    period: { type: "string", enum: ["5h", "week"] },
    usedPercent: { type: "number", minimum: 0, maximum: 100 },
  },
  required: ["period", "usedPercent"],
  additionalProperties: false,
} as const

const PROVIDER_USAGE = {
  type: "object",
  properties: {
    auth: { type: "string", enum: ["oauth", "key"] },
    updatedAt: { type: "number" },
    copilot: {
      type: "object",
      properties: {
        usedPercent: { type: "number", minimum: 0, maximum: 100 },
        unlimited: { type: "boolean" },
      },
      required: ["usedPercent", "unlimited"],
      additionalProperties: false,
    },
    windows: { type: "array", items: WINDOW },
  },
  additionalProperties: false,
} as const

export const Usage = Rpc.define({
  id: "pillbox.usage",
  methods: {
    get: {
      input: EMPTY,
      output: {
        type: "object",
        properties: { providers: { type: "object", additionalProperties: PROVIDER_USAGE } },
        required: ["providers"],
        additionalProperties: false,
      },
    },
  },
  events: {},
})

export const Tiers = Rpc.define({
  id: "pillbox.tiers",
  methods: {
    get: {
      input: EMPTY,
      output: {
        type: "object",
        properties: { models: { type: "object", additionalProperties: { type: "string" } } },
        required: ["models"],
        additionalProperties: false,
      },
    },
  },
  events: {},
})

export type ProviderUsage = {
  auth?: "oauth" | "key"
  updatedAt?: number
  copilot?: { usedPercent: number; unlimited: boolean }
  windows?: { period: "5h" | "week"; usedPercent: number }[]
}
export type UsageResult = { providers: Record<string, ProviderUsage> }
export type TiersResult = { models: Record<string, string> }
