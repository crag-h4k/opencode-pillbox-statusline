// test/theme.test.mjs
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { resolveConfig } from "../config/resolve.mjs"
import { agentColor, isOpaque, isValidToken, resolveColor, resolveToken, toHex } from "../theme.mjs"

const rgba = (hex, a = 1) => ({
  r: Number.parseInt(hex.slice(1, 3), 16) / 255,
  g: Number.parseInt(hex.slice(3, 5), 16) / 255,
  b: Number.parseInt(hex.slice(5, 7), 16) / 255,
  a,
})
const scale = (hex) => Object.fromEntries([100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) => [step, rgba(hex)]))
const lightScale = (dark, light) => ({ ...scale(dark), 300: rgba(light) })

const THEME = {
  text: {
    base: rgba("#e0def4"),
    muted: rgba("#6e6a86"),
    feedback: {
      error: { base: rgba("#eb6f92"), muted: rgba("#eb6f92") },
      warning: { base: rgba("#f6c177"), muted: rgba("#f6c177") },
      success: { base: rgba("#31748f"), muted: rgba("#31748f") },
      info: { base: rgba("#c4a7e7"), muted: rgba("#c4a7e7") },
    },
  },
  background: { base: rgba("#000000", 0), raised: { base: rgba("#000000", 0), high: rgba("#000000", 0), max: rgba("#2c232c", 0.5) } },
  diff: { background: { context: rgba("#1f1d2e") } },
  hue: { cyan: lightScale("#9ccfd8", "#56949f"), accent: scale("#f6c177") },
  categorical: [scale("#9ccfd8"), scale("#ebbcba")],
}

test("token grammar accepts the documented forms and rejects the rest", () => {
  for (const token of ["text.base", "feedback.warning", "hue.cyan", "hue.cyan.200", "categorical.0", "categorical.1.300", "agent", "#aabbcc", "#AABBCC80", "diff.background.context"]) {
    assert.equal(isValidToken(token), true, token)
  }
  for (const token of ["", "text", "#abc", "red", "hue..cyan", "Hue.cyan", "hue.cyan.", 42, undefined]) {
    assert.equal(isValidToken(token), false, String(token))
  }
})

test("tokens resolve against the theme; unknown paths resolve to nothing", () => {
  assert.equal(toHex(resolveToken(THEME, "text.base")), "#e0def4")
  assert.equal(toHex(resolveToken(THEME, "feedback.warning")), "#f6c177")
  assert.equal(toHex(resolveToken(THEME, "hue.cyan")), "#9ccfd8")
  assert.equal(toHex(resolveToken(THEME, "hue.cyan", { mode: "light" })), "#56949f")
  assert.equal(toHex(resolveToken(THEME, "categorical.1")), "#ebbcba")
  assert.equal(toHex(resolveToken(THEME, "diff.background.context")), "#1f1d2e")
  assert.equal(resolveToken(THEME, "#ABCDEF"), "#abcdef")
  assert.equal(resolveToken(THEME, "hue.yellow"), undefined)
  assert.equal(resolveToken(THEME, "hue.cyan.250"), undefined)
  assert.equal(resolveToken(THEME, "categorical.9"), undefined)
  assert.equal(resolveToken(THEME, "feedback.panic"), undefined)
  assert.equal(resolveToken(THEME, "not a token"), undefined)
  assert.equal(toHex(resolveToken(THEME, "agent", { agentColor: "#123456" })), "#123456")
})

test("fallback lists skip missing and translucent colors", () => {
  assert.equal(isOpaque(rgba("#000000", 0)), false)
  assert.equal(isOpaque("#11223380"), false)
  assert.equal(isOpaque("#112233"), true)
  assert.equal(toHex(resolveColor(THEME, ["background.raised.base", "background.raised.max", "diff.background.context"])), "#1f1d2e")
  assert.equal(toHex(resolveColor(THEME, ["hue.yellow", "feedback.warning"])), "#f6c177")
  assert.equal(resolveColor(THEME, ["hue.yellow", "background.base"]), undefined)
  assert.equal(resolveColor(THEME, undefined), undefined)
})

test("agents use their own color, else a categorical color by position", () => {
  const agents = [{ id: "build", color: "#31748f" }, { id: "general" }, { id: "explore" }]
  assert.equal(agentColor(THEME, agents, "build"), "#31748f")
  assert.equal(toHex(agentColor(THEME, agents, "general")), "#ebbcba")
  assert.equal(toHex(agentColor(THEME, agents, "explore")), "#9ccfd8")
  assert.equal(agentColor(THEME, agents, "missing"), undefined)
  assert.equal(agentColor({}, agents, "general"), undefined)
})

// Real gud-lucent renders for rose-pine: the native V2 theme and the V1 theme
// it replaced, resolved through OpenCode's own theme package.
test("default pill colors resolve to opaque colors under real gud-lucent themes", async (t) => {
  let Theme
  try {
    Theme = await import("@opencode/theme/tui")
  } catch (error) {
    t.skip(`@opencode/theme unavailable: ${error?.code ?? error}`)
    return
  }
  const load = (file) => {
    const json = JSON.parse(readFileSync(new URL(`fixtures/${file}`, import.meta.url), "utf8"))
    const document = "theme" in json ? Theme.migrateV1(json) : Theme.parseThemeDocument(json, "gud-lucent")
    return Theme.resolveThemeDocument(document, "dark")
  }
  const v2 = load("gud-lucent-v2-rose-pine.json")
  const v1 = load("gud-lucent-v1-rose-pine.json")
  const { config } = resolveConfig(undefined)

  const tokens = new Set()
  for (const pill of Object.values(config.pills)) {
    for (const [key, value] of Object.entries(pill)) {
      if (["accent", "value", "dirtyAccent", "effortColor", "warning", "error"].includes(key)) tokens.add(value)
      if (key === "bands") for (const band of Object.values(value)) tokens.add(band)
    }
  }
  tokens.delete("agent")
  for (const theme of [v2, v1]) {
    for (const token of tokens) {
      assert.ok(isOpaque(resolveColor(theme, token)), `${token} resolves to an opaque color`)
    }
  }

  assert.equal(toHex(resolveColor(v2, config.style.surface)), "#1f1d2e")
  assert.equal(toHex(resolveColor(v1, config.style.surface)), "#1f1d2e")
  assert.equal(toHex(resolveColor(v2, ["hue.yellow", "feedback.warning"])), "#ebbcba")
  assert.equal(toHex(resolveColor(v1, ["hue.yellow", "feedback.warning"])), "#f6c177")
})
