// src/render/layout.mjs
// Pill anatomy and the priority fit that decides which pills show, and at
// which size, in the space a bar has. Pure: widths in, placements out. No host
// imports.

import { displayWidth } from "./width.mjs"

/** Sizes from largest to smallest; "hidden" is the step after the smallest. */
export const SIZES = Object.freeze(["full", "compact", "icon"])
const LADDER = Object.freeze([...SIZES, "hidden"])

/**
 * The text runs that make up one pill. The renderer colors each run by its
 * role; the fit measures the same runs, so the two never disagree. `text` is a
 * string or a list of runs, each with an optional color token that overrides
 * the pill's value color.
 * @param {{
 *   icon?: string,
 *   text?: string | { text: string, color?: string | readonly string[] }[],
 *   size: string,
 *   caps?: { left: string, right: string },
 *   plain?: boolean,
 * }} pill
 * @returns {{ role: "cap" | "pad" | "icon" | "text", text: string, color?: string | readonly string[] }[]}
 */
export function pillParts({ icon = "", text = "", size, caps = { left: "", right: "" }, plain = false }) {
  const runs = (typeof text === "string" ? [{ text }] : text).filter((run) => run.text)
  const showText = size !== "icon" && runs.length > 0
  const parts = []
  if (plain) {
    // No surface to pad: the icon, one space before any text, then the text.
    if (icon) parts.push({ role: "icon", text: icon })
    if (icon && showText) parts.push({ role: "pad", text: " " })
  } else {
    if (caps.left) parts.push({ role: "cap", text: caps.left })
    if (icon) parts.push({ role: "pad", text: " " }, { role: "icon", text: icon })
    if (showText) parts.push({ role: "pad", text: " " })
  }
  if (showText) {
    for (const run of runs) parts.push(run.color ? { role: "text", text: run.text, color: run.color } : { role: "text", text: run.text })
  }
  if (!plain) {
    parts.push({ role: "pad", text: " " })
    if (caps.right) parts.push({ role: "cap", text: caps.right })
  }
  return parts
}

/** @param {{ text: string }[]} parts */
export function partsWidth(parts) {
  return parts.reduce((total, part) => total + displayWidth(part.text), 0)
}

function rank(size) {
  const index = LADDER.indexOf(size)
  return index === -1 ? LADDER.length - 1 : index
}

/** Largest supported size at or below `size`, else "hidden". */
function settle(pill, size) {
  for (let index = rank(size); index < SIZES.length; index++) {
    if (pill.widths[SIZES[index]] !== undefined) return SIZES[index]
  }
  return "hidden"
}

/** Next supported size below the current one, respecting minSize; undefined when it cannot shrink. */
function nextSmaller(pill, size) {
  const floor = rank(pill.minSize ?? "hidden")
  for (let index = rank(size) + 1; index <= floor && index < LADDER.length; index++) {
    const candidate = LADDER[index]
    if (candidate === "hidden" || pill.widths[candidate] !== undefined) return candidate
  }
  return undefined
}

function totalWidth(pills, sizes, gap) {
  let width = 0
  let visible = 0
  for (const pill of pills) {
    const size = sizes.get(pill.id)
    if (size === "hidden") continue
    width += pill.widths[size]
    visible += 1
  }
  return width + Math.max(0, visible - 1) * gap
}

function fit(pills, { budget, gap, columns, cap }) {
  const sizes = new Map()
  const reasons = new Map()
  const byId = new Map(pills.map((pill) => [pill.id, pill]))
  const hide = (id, reason) => {
    sizes.set(id, "hidden")
    if (!reasons.has(id)) reasons.set(id, reason)
  }

  for (const pill of pills) {
    if (columns < (pill.minColumns ?? 0)) {
      hide(pill.id, "minColumns")
      continue
    }
    let start = pill.size ?? "full"
    const capped = cap?.get(pill.id)
    if (capped !== undefined && rank(capped) > rank(start)) start = capped
    const size = settle(pill, start)
    if (size === "hidden") hide(pill.id, capped === "hidden" ? "space" : "empty")
    else sizes.set(pill.id, size)
  }

  const cascade = () => {
    for (const pill of pills) {
      if (!pill.attach || sizes.get(pill.id) === "hidden") continue
      const parent = byId.get(pill.attach)
      if (!parent || sizes.get(parent.id) === "hidden") hide(pill.id, "attached")
    }
  }
  cascade()

  let overflow = false
  while (totalWidth(pills, sizes, gap) > budget) {
    let pick
    for (const pill of pills) {
      const size = sizes.get(pill.id)
      if (size === "hidden" || nextSmaller(pill, size) === undefined) continue
      if (
        !pick ||
        pill.priority < pick.priority ||
        (pill.priority === pick.priority && pill.order > pick.order)
      ) {
        pick = pill
      }
    }
    if (!pick) {
      overflow = true
      break
    }
    const next = nextSmaller(pick, sizes.get(pick.id))
    if (next === "hidden") hide(pick.id, "space")
    else sizes.set(pick.id, next)
    cascade()
  }

  const ordered = [...pills].sort((a, b) => (a.group === b.group ? a.order - b.order : a.group === "left" ? -1 : 1))
  return {
    placed: ordered.filter((pill) => sizes.get(pill.id) !== "hidden").map((pill) => ({
      id: pill.id,
      group: pill.group,
      size: sizes.get(pill.id),
      width: pill.widths[sizes.get(pill.id)],
    })),
    hidden: ordered.filter((pill) => sizes.get(pill.id) === "hidden").map((pill) => ({
      id: pill.id,
      reason: reasons.get(pill.id) ?? "space",
    })),
    width: totalWidth(pills, sizes, gap),
    overflow,
  }
}

/**
 * Fits one bar's pills into `budget` columns.
 *
 * Each pill starts at its preferred size. While the bar is too wide, the
 * lowest-priority pill that can still shrink steps down one size (full,
 * compact, icon, hidden); ties go to the pill with the higher order. A pill
 * attached to another hides with it. A pill hides outright below its
 * minColumns terminal width.
 *
 * Hysteresis: a pill only grows back when the result leaves `hysteresis`
 * spare columns; otherwise it keeps its previous size. Shrinking is immediate.
 *
 * @param {{
 *   pills: {
 *     id: string, group: "left" | "right", order: number, priority: number,
 *     size?: string, minSize?: string, minColumns?: number, attach?: string,
 *     widths: { full?: number, compact?: number, icon?: number },
 *   }[],
 *   budget: number,
 *   columns?: number,
 *   gap?: number,
 *   hysteresis?: number,
 *   previous?: Map<string, string> | Record<string, string>,
 * }} input
 */
export function fitBar({ pills, budget, columns = Number.POSITIVE_INFINITY, gap = 1, hysteresis = 0, previous }) {
  const result = fit(pills, { budget, gap, columns })
  if (!previous || hysteresis <= 0) return result
  const prior = previous instanceof Map ? previous : new Map(Object.entries(previous))
  const grew = pills.some((pill) => {
    const before = prior.get(pill.id)
    if (before === undefined) return false
    const placed = result.placed.find((item) => item.id === pill.id)
    return placed !== undefined && rank(placed.size) < rank(before)
  })
  if (!grew || result.width <= budget - hysteresis) return result
  return fit(pills, { budget, gap, columns, cap: prior })
}

/** Sizes keyed by pill id, for the next call's `previous`. */
export function sizesOf(result) {
  const sizes = new Map(result.placed.map((item) => [item.id, item.size]))
  for (const item of result.hidden) sizes.set(item.id, "hidden")
  return sizes
}
