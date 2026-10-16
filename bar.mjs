// bar.mjs
// Builds one footer bar: renders every enabled pill from a data snapshot,
// measures each size, runs the priority fit, and returns the runs to draw with
// their color tokens. Pure; the terminal plugin resolves tokens and draws.
//
// Data snapshot (every field optional unless noted):
//   mode: "normal" | "shell"          status: "idle" | "running"
//   waiting: boolean                  interrupt: shortcut label, such as "esc"
//   now: epoch ms (required)          tick: spinner frame counter
//   project: string                   git: { branch, files, additions, deletions }
//   agent, model, variant: strings    createdAt: epoch ms
//   subagents: { running, queued }    context: { tokens, limit? }
//   cost: USD                         tier: { category?, outputCost? }
//   provider: { id, name?, auth?, copilot?: { usedPercent, unlimited }, windows? }
//   sidequest: { name, done, total, failed }

import { capsFor, iconSet } from "./icons.mjs"
import { fitBar, partsWidth, pillParts, SIZES } from "./layout.mjs"
import { PILLS } from "./pills/index.mjs"

/**
 * @param {object} config  a resolved config (config/resolve.mjs)
 * @param {object} data  the data snapshot described above
 * @param {{
 *   bar: "session" | "home",
 *   budget: number,
 *   columns?: number,
 *   previous?: Map<string, string>,
 *   flat?: boolean,
 * }} options  `flat` drops pill caps, for themes with no opaque surface color
 */
export function barModel(config, data, { bar, budget, columns, previous, flat = false }) {
  const icons = iconSet(config.icons)
  const caps = capsFor(flat ? "flat" : config.style.caps, config.icons)
  const rendered = new Map()
  const entries = []
  for (const pill of PILLS) {
    const settings = config.pills[pill.id]
    if (!settings.enabled || (settings.when !== "always" && settings.when !== bar)) continue
    const output = pill.render(data, settings, icons)
    if (!output) continue
    const icon = settings.icon ?? output.icon ?? ""
    const sizes = {}
    for (const size of SIZES) {
      if (!pill.sizes.includes(size) || output.sizes[size] === undefined) continue
      sizes[size] = pillParts({ icon, text: output.sizes[size], size, caps, plain: Boolean(pill.plain) })
    }
    if (!Object.keys(sizes).length) continue
    rendered.set(pill.id, { pill, settings, output, sizes })
    entries.push({
      id: pill.id,
      group: settings.group,
      order: settings.order,
      priority: settings.priority,
      size: settings.size,
      minSize: settings.minSize,
      minColumns: settings.minColumns,
      attach: settings.attach,
      widths: Object.fromEntries(Object.entries(sizes).map(([size, parts]) => [size, partsWidth(parts)])),
    })
  }
  const fit = fitBar({
    pills: entries,
    budget,
    columns,
    gap: config.style.gap,
    hysteresis: config.layout.hysteresis,
    previous,
  })
  const pills = fit.placed.map(({ id, group, size }) => {
    const { pill, settings, output, sizes } = rendered.get(id)
    return {
      id,
      group,
      size,
      plain: Boolean(pill.plain),
      accent: output.accent ?? settings.accent,
      value: output.value ?? settings.value,
      parts: sizes[size],
    }
  })
  return { pills, fit }
}
