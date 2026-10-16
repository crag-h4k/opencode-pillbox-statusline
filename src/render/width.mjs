// src/render/width.mjs
// Terminal cell widths, matching OpenTUI: Nerd Font icons (private-use code
// points) take one cell; CJK and emoji take two. Ported from opencode-sidequest's
// layout.mjs. No host imports.

const ZERO_WIDTH = [
  [0x0300, 0x036f], [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064],
  [0x20d0, 0x20ff], [0xfe00, 0xfe0f], [0xe0100, 0xe01ef],
]

const WIDE = [
  [0x1100, 0x115f], [0x231a, 0x231b], [0x2329, 0x232a], [0x23e9, 0x23ec], [0x23f0, 0x23f0], [0x23f3, 0x23f3],
  [0x25fd, 0x25fe], [0x2614, 0x2615], [0x2648, 0x2653], [0x267f, 0x267f], [0x2693, 0x2693], [0x26a1, 0x26a1],
  [0x26aa, 0x26ab], [0x26bd, 0x26be], [0x26c4, 0x26c5], [0x26ce, 0x26ce], [0x26d4, 0x26d4], [0x26ea, 0x26ea],
  [0x26f2, 0x26f3], [0x26f5, 0x26f5], [0x26fa, 0x26fa], [0x26fd, 0x26fd], [0x2705, 0x2705], [0x270a, 0x270b],
  [0x2728, 0x2728], [0x274c, 0x274c], [0x274e, 0x274e], [0x2753, 0x2755], [0x2757, 0x2757], [0x2795, 0x2797],
  [0x27b0, 0x27b0], [0x27bf, 0x27bf], [0x2b1b, 0x2b1c], [0x2b50, 0x2b50], [0x2b55, 0x2b55],
  [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf], [0x4e00, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7a3],
  [0xf900, 0xfaff], [0xfe30, 0xfe6f], [0xff00, 0xff60], [0xffe0, 0xffe6],
  [0x1f300, 0x1f64f], [0x1f680, 0x1f6ff], [0x1f900, 0x1f9ff], [0x20000, 0x3fffd],
]

function inRanges(codePoint, ranges) {
  for (const [low, high] of ranges) {
    if (codePoint >= low && codePoint <= high) return true
  }
  return false
}

/** @param {number} codePoint */
export function charWidth(codePoint) {
  if (codePoint < 0x300) return 1
  if (inRanges(codePoint, ZERO_WIDTH)) return 0
  return inRanges(codePoint, WIDE) ? 2 : 1
}

/** @param {string} text */
export function displayWidth(text) {
  let total = 0
  for (const char of text) total += charWidth(char.codePointAt(0))
  return total
}

/** Strips escape sequences and control characters that would corrupt a terminal row. */
export function clean(value) {
  return String(value ?? "")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: matching terminal escapes is the point
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, " ")
}

/** Cleans text and truncates it to `columns` cells, ending with an ellipsis when cut. */
export function fit(text, columns, pad = false) {
  const value = clean(text)
  if (columns <= 0) return ""
  const width = displayWidth(value)
  if (width <= columns) return pad ? value + " ".repeat(columns - width) : value
  let out = ""
  let used = 0
  for (const char of value) {
    const size = charWidth(char.codePointAt(0))
    if (used + size > columns - 1) break
    out += char
    used += size
  }
  out += "…"
  used += 1
  return pad ? out + " ".repeat(Math.max(0, columns - used)) : out
}
