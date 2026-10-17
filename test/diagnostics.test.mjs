import assert from "node:assert/strict"
import test from "node:test"
import { resolveConfig } from "../src/config/resolve.mjs"
import { glyphReport, glyphSamples, layoutReport, optionsReport, sourcesReport, usageSummary } from "../src/diagnostics.mjs"
import { PILLS } from "../src/pills/index.mjs"
import { LIMIT_MAX_AGE_MS } from "../src/quota.mjs"
import { barModel } from "../src/render/bar.mjs"
import { ICON_SET_NAMES } from "../src/render/icons.mjs"
import { partsWidth, sizesOf } from "../src/render/layout.mjs"
import { TIERS_TTL_MS } from "../src/server/tiers.mjs"

const DATA = {
  mode: "normal", status: "running", now: 1000, createdAt: 1,
  project: "project", agent: "build", model: "model", cost: 1,
  git: { branch: "main", files: 0 }, tier: { outputCost: 10 },
  provider: { id: "github-copilot", copilot: { usedPercent: 50, unlimited: false } },
}

test("diagnostics describe every pill and preserve the displayed fit through shrinking and hysteresis", () => {
  const { config } = resolveConfig({ pills: { elapsed: { minColumns: 120 } } })
  let previous
  for (const columns of [200, 151, 99, 40, 41, 99, 151, 200]) {
    const model = barModel(config, DATA, { bar: "session", budget: columns - 10, columns, previous })
    previous = sizesOf(model.fit)
    assert.equal(model.diagnostics.length, PILLS.length)
    assert.equal(model.diagnostics.find((pill) => pill.id === "elapsed").reason, columns < 120 ? "minColumns" : undefined)
    for (const pill of model.pills) {
      const row = model.diagnostics.find((item) => item.id === pill.id)
      assert.equal(row.size, pill.size)
      assert.equal(row.width, partsWidth(pill.parts))
      assert.equal(row.widths[pill.size], row.width)
      assert.equal(row.reason, undefined)
      assert.ok(layoutReport(model).includes(`${pill.id} (${pill.group}) ${pill.size}: ${row.width} cells`))
    }
    for (const hidden of model.fit.hidden) {
      const row = model.diagnostics.find((item) => item.id === hidden.id)
      assert.equal(row.reason, hidden.reason)
      assert.equal(row.width, 0)
    }
    assert.ok(!JSON.stringify(model.diagnostics).includes("GitHub Copilot"), "no rendered session text in diagnostic metadata")
  }
})

test("diagnostics retain pre-fit hide reasons and report overflow and cap fallback", () => {
  const { config } = resolveConfig({ icons: "ascii", pills: { identity: { enabled: false }, project: { minSize: "full" } } })
  const model = barModel(config, DATA, { bar: "session", budget: 1, columns: 99 })
  const row = (id) => model.diagnostics.find((pill) => pill.id === id)
  assert.equal(row("identity").reason, "disabled")
  assert.equal(row("spinner").reason, "attached")
  assert.equal(row("tier").reason, "attached")
  assert.equal(row("context").reason, "no-data")
  assert.equal(row("hint").reason, "space")
  assert.match(layoutReport(model), /overflow: yes; caps: flat/)
  const home = barModel(config, DATA, { bar: "home", budget: 99, columns: 99 })
  assert.equal(home.diagnostics.find((pill) => pill.id === "cost").reason, "when")
  assert.match(layoutReport(undefined), /No mounted/)
})

test("a hysteresis-held hidden pill is reported from the actual fit rather than a fresh fit", () => {
  const { config } = resolveConfig({ preset: "minimal", layout: { hysteresis: 20 } })
  const data = { now: 1000, project: "project" }
  const previous = new Map([["project", "hidden"]])
  const model = barModel(config, data, { bar: "home", budget: 13, previous })
  assert.equal(model.diagnostics.find((pill) => pill.id === "project").reason, "space")
  const independent = barModel(config, data, { bar: "home", budget: 13 })
  assert.equal(independent.diagnostics.find((pill) => pill.id === "project").size, "full")
  assert.match(layoutReport(model), /including hysteresis/)
})

test("source summaries allowlist fields, preserve zero quota, and remove stale figures", () => {
  const providers = {
    openai: { auth: "oauth", updatedAt: 1000, token: "private-token", accountId: "private-account", windows: [{ period: "week", usedPercent: 0, raw: "private-response" }] },
    anthropic: { auth: "key" },
    gateway: { updatedAt: 1000, windows: [{ period: "5h", usedPercent: 10 }] },
  }
  const fresh = usageSummary(providers, 1000)
  assert.equal(fresh.find((row) => row.id === "github-copilot").state, "not reported")
  assert.equal(fresh.find((row) => row.id === "anthropic").state, "unavailable")
  assert.deepEqual(fresh.find((row) => row.id === "openai").windows, [{ period: "week", usedPercent: 0 }])
  assert.equal(fresh.find((row) => row.id === "gateway").source, "gateway")
  const stale = usageSummary(providers, 1000 + LIMIT_MAX_AGE_MS)
  assert.equal(stale.find((row) => row.id === "openai").state, "stale")
  assert.equal(stale.find((row) => row.id === "openai").windows, undefined)
  assert.doesNotMatch(JSON.stringify(fresh), /private-|accountId|token|raw/)
})

test("source report distinguishes polling, disabled server tiers, old servers, and stale caches", () => {
  const { config } = resolveConfig(undefined)
  const input = {
    config, now: 301000,
    polling: { usage: { state: "error", succeededAt: 1000 }, tiers: { state: "disabled" } },
    usage: { openai: { auth: "oauth", updatedAt: 1000, windows: [{ period: "week", usedPercent: 1 }] } },
    tiers: { models: {}, state: "disabled" },
  }
  const report = sourcesReport(input)
  assert.match(report, /usage RPC: error; refresh 60s; last success 300s ago/)
  assert.match(report, /openai \(direct\): stale/)
  assert.doesNotMatch(report, /1% used/)
  assert.match(report, /tiers RPC: disabled/)
  assert.match(report, /Copilot category source: disabled/)
  assert.match(sourcesReport({ ...input, tiers: { models: {} } }), /unknown \(server supplied no state\)/)
  const tiers = { state: "stale", updatedAt: 1000, models: { "private-model": "private-category", m: "powerful" }, access: "private-token" }
  const cached = sourcesReport({ ...input, tiers })
  assert.match(cached, /powerful=1, other=1/)
  assert.match(cached, /source: stale; updated 300s ago/)
  assert.doesNotMatch(cached, /private-/)
  const expired = sourcesReport({ ...input, now: 1000 + TIERS_TTL_MS, tiers: { ...tiers, state: "ready" } })
  assert.match(expired, /source: stale/, "categories age out in diagnostics even between polls or during an RPC outage")
})

test("options report contains repaired defaults and all option errors", () => {
  const { config, errors } = resolveConfig({ icons: "wrong", pills: { project: { size: "compact" }, cost: { enabled: false } } })
  const report = optionsReport(config, errors)
  for (const error of errors) assert.ok(report.includes(error.path))
  assert.ok(report.includes(JSON.stringify(config, null, 2)))
  assert.equal(config.pills.project.size, "icon")
  assert.equal(config.pills.cost.enabled, false)
  assert.match(optionsReport(resolveConfig({}).config, []), /Option errors\nNone/)
})

test("glyph checks cover every frame, caps, custom icons, and known-width references", () => {
  const { config } = resolveConfig({ pills: { project: { icon: "中" } } })
  const samples = glyphSamples(config)
  assert.equal(samples.find((row) => row.name === "pills.project.icon").width, 2)
  assert.equal(samples.find((row) => row.name === "combining").width, 1)
  assert.equal(samples.filter((row) => row.name.startsWith("nerd.spinner.")).length, 10)
  assert.equal(samples.find((row) => row.name === "nerd.project").codepoints, "U+F024B")
  assert.ok(samples.some((row) => row.name === "caps.left"))
  assert.match(glyphReport(config), /\|中\|\n  \|--\|/)
})

test("all built-in glyph checks agree with the real OpenTUI renderer", async () => {
  const { createTestRenderer } = await import("@opentui/core/testing")
  const { TextRenderable } = await import("@opentui/core")
  const samples = ICON_SET_NAMES.flatMap((icons) => glyphSamples(resolveConfig({ icons }).config))
  const width = 20
  for (const widthMethod of ["wcwidth", "unicode", "unicode-wide"]) {
    const setup = await createTestRenderer({ width, height: samples.length, widthMethod })
    try {
      setup.renderer.root.add(new TextRenderable(setup.renderer, { id: "glyphs", content: samples.map((row) => row.text).join("\n") }))
      await setup.renderOnce()
      const lines = setup.captureSpans().lines
      samples.forEach((sample, index) => {
        const rendered = lines[index].spans.map((span) => span.text).join("")
        const padding = [...rendered].length - [...sample.text].length
        assert.equal(width - padding, sample.width, `${widthMethod}: ${sample.name}`)
      })
    } finally {
      await setup.dispose()
    }
  }
})
