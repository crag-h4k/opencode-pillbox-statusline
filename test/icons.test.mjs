// test/icons.test.mjs
import assert from "node:assert/strict"
import test from "node:test"
import {
  CAP_STYLE_NAMES,
  CAP_STYLES,
  capsFor,
  ICON_SET_NAMES,
  ICON_SETS,
  iconSet,
  iconSetName,
} from "../icons.mjs"
import { displayWidth } from "../width.mjs"

const SCALAR_KEYS = ["project", "git", "identity", "elapsed", "subagentQueued", "context", "cost", "provider", "limit"]
const TIER_BANDS = ["included", "standard", "premium", "heavy"]

/** Every glyph in a set, labelled by its path. */
function glyphs(set) {
  const out = SCALAR_KEYS.map((key) => [key, set[key]])
  for (const ramp of ["value", "heat"]) {
    for (const band of TIER_BANDS) out.push([`tier.${ramp}.${band}`, set.tier[ramp][band]])
  }
  for (const [index, frame] of set.spinner.entries()) out.push([`spinner[${index}]`, frame])
  for (const [index, frame] of set.subagentSpinner.entries()) out.push([`subagentSpinner[${index}]`, frame])
  return out
}

function codePoints(text) {
  return [...text].map((char) => char.codePointAt(0))
}

function isPrivateUse(codePoint) {
  return (
    (codePoint >= 0xe000 && codePoint <= 0xf8ff) ||
    (codePoint >= 0xf0000 && codePoint <= 0xffffd) ||
    (codePoint >= 0x100000 && codePoint <= 0x10fffd)
  )
}

/** Code point rule each set promises. */
const RULES = {
  nerd: () => true,
  "nerd-bmp": (codePoint) => codePoint <= 0xffff,
  unicode: (codePoint) => !isPrivateUse(codePoint),
  ascii: (codePoint) => codePoint >= 0x20 && codePoint <= 0x7e,
}

function shape(set) {
  return {
    keys: Object.keys(set).sort(),
    tier: Object.keys(set.tier).sort(),
    value: Object.keys(set.tier.value).sort(),
    heat: Object.keys(set.tier.heat).sort(),
  }
}

test("the four icon sets ship", () => {
  assert.deepEqual([...ICON_SET_NAMES], ["nerd", "nerd-bmp", "unicode", "ascii"])
})

test("every set has the same keys", () => {
  const expected = shape(ICON_SETS.nerd)
  assert.deepEqual(expected.keys, [...SCALAR_KEYS, "spinner", "subagentSpinner", "tier"].sort())
  assert.deepEqual(expected.value, [...TIER_BANDS].sort())
  for (const name of ICON_SET_NAMES) {
    assert.deepEqual(shape(ICON_SETS[name]), expected, name)
    assert.ok(ICON_SETS[name].spinner.length > 1, `${name} spinner`)
    assert.ok(ICON_SETS[name].subagentSpinner.length > 1, `${name} subagentSpinner`)
  }
})

test("every glyph and frame is one code point and one cell", () => {
  for (const name of ICON_SET_NAMES) {
    for (const [path, glyph] of glyphs(ICON_SETS[name])) {
      assert.equal(typeof glyph, "string", `${name} ${path}`)
      assert.equal(codePoints(glyph).length, 1, `${name} ${path} is one code point`)
      assert.equal(displayWidth(glyph), 1, `${name} ${path} is one cell`)
    }
  }
})

test("each set keeps its code point rule", () => {
  for (const name of ICON_SET_NAMES) {
    for (const [path, glyph] of glyphs(ICON_SETS[name])) {
      for (const codePoint of codePoints(glyph)) {
        assert.ok(RULES[name](codePoint), `${name} ${path} U+${codePoint.toString(16).toUpperCase()}`)
      }
    }
  }
})

test("tier ramps use four distinct glyphs", () => {
  for (const name of ICON_SET_NAMES) {
    for (const ramp of ["value", "heat"]) {
      const values = TIER_BANDS.map((band) => ICON_SETS[name].tier[ramp][band])
      assert.equal(new Set(values).size, 4, `${name} ${ramp}`)
    }
  }
})

test("nerd reproduces today's footer glyphs, with the intended tier ramps", () => {
  const nerd = ICON_SETS.nerd
  const expected = {
    project: 0xf024b,
    git: 0xe0a0,
    identity: 0xf06a9,
    elapsed: 0xf0954,
    subagentQueued: 0xf04fb,
    context: 0xf035b,
    cost: 0x2248,
    provider: 0xf02a4,
    limit: 0xf04c5,
  }
  for (const [key, codePoint] of Object.entries(expected)) assert.deepEqual(codePoints(nerd[key]), [codePoint], key)
  assert.deepEqual(TIER_BANDS.map((band) => nerd.tier.value[band].codePointAt(0)), [0xf0766, 0xf0114, 0xf01c8, 0xf0d2e])
  assert.deepEqual(TIER_BANDS.map((band) => nerd.tier.heat[band].codePointAt(0)), [0xf0717, 0xf0edd, 0xf0238, 0xf15d7])
  assert.deepEqual(
    nerd.spinner.map((frame) => frame.codePointAt(0)),
    [0x280b, 0x2819, 0x2839, 0x2838, 0x283c, 0x2834, 0x2826, 0x2827, 0x2807, 0x280f],
  )
  assert.deepEqual([...nerd.subagentSpinner], [".", "o", "O", "o"])
})

test("sets are frozen", () => {
  for (const name of ICON_SET_NAMES) {
    const set = ICON_SETS[name]
    for (const value of [set, set.tier, set.tier.value, set.tier.heat, set.spinner, set.subagentSpinner]) {
      assert.ok(Object.isFrozen(value), name)
    }
  }
  assert.ok(Object.isFrozen(ICON_SETS))
  assert.ok(Object.isFrozen(CAP_STYLES.round))
})

test("round caps match today's pills and flat caps are empty", () => {
  assert.deepEqual(codePoints(CAP_STYLES.round.left + CAP_STYLES.round.right), [0xe0b6, 0xe0b4])
  assert.equal(CAP_STYLES.flat.left, "")
  assert.equal(CAP_STYLES.flat.right, "")
  assert.deepEqual([...CAP_STYLES.flat.sets], [...ICON_SET_NAMES])
})

test("cap glyphs are one cell and keep the rules of every set they claim", () => {
  for (const style of CAP_STYLE_NAMES) {
    const cap = CAP_STYLES[style]
    for (const set of cap.sets) assert.ok(ICON_SET_NAMES.includes(set), `${style} names ${set}`)
    for (const glyph of [cap.left, cap.right]) {
      if (style === "flat") continue
      assert.equal(codePoints(glyph).length, 1, style)
      assert.equal(displayWidth(glyph), 1, style)
      for (const set of cap.sets) assert.ok(codePoints(glyph).every(RULES[set]), `${style} in ${set}`)
    }
  }
  assert.ok(!CAP_STYLES.round.sets.includes("unicode"))
  assert.ok(!CAP_STYLES.round.sets.includes("ascii"))
})

test("iconSet falls back to nerd for unknown names", () => {
  assert.equal(iconSet("ascii"), ICON_SETS.ascii)
  assert.equal(iconSet("nerd-bmp"), ICON_SETS["nerd-bmp"])
  for (const name of ["", "emoji", "NERD", "constructor", "__proto__", undefined, null, 3]) {
    assert.equal(iconSet(name), ICON_SETS.nerd, String(name))
    assert.equal(iconSetName(name), "nerd", String(name))
  }
})

test("capsFor keeps valid caps and falls back to flat or round", () => {
  const pick = (style, set) => {
    const caps = capsFor(style, set)
    return [caps.style, caps.left, caps.right]
  }
  assert.deepEqual(pick("round", "nerd"), ["round", "\uE0B6", "\uE0B4"])
  assert.deepEqual(pick("round", "nerd-bmp"), ["round", "\uE0B6", "\uE0B4"])
  assert.deepEqual(pick("angled", "nerd-bmp"), ["angled", "\uE0B2", "\uE0B0"])
  assert.deepEqual(pick("square", "unicode"), ["square", "\u2590", "\u258C"])

  // Private-use caps never reach unicode or ascii, and ascii is always flat.
  for (const style of ["round", "angled"]) assert.deepEqual(pick(style, "unicode"), ["flat", "", ""], style)
  for (const style of CAP_STYLE_NAMES) assert.deepEqual(pick(style, "ascii"), ["flat", "", ""], style)

  // "none" is an alias for flat; unknown styles mean round, then the set rule applies.
  assert.deepEqual(pick("none", "nerd"), ["flat", "", ""])
  for (const style of ["bubble", "", "toString", "__proto__", undefined, 7]) {
    assert.deepEqual(pick(style, "nerd"), ["round", "\uE0B6", "\uE0B4"], String(style))
    assert.deepEqual(pick(style, "ascii"), ["flat", "", ""], String(style))
  }

  // An unknown set resolves to nerd first.
  assert.deepEqual(pick("round", "emoji"), ["round", "\uE0B6", "\uE0B4"])
})
