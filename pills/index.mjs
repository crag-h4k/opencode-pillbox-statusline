// pills/index.mjs
// The pill registry. Adding a pill means adding its module here.
import context from "./context.mjs"
import cost from "./cost.mjs"
import elapsed from "./elapsed.mjs"
import git from "./git.mjs"
import hint from "./hint.mjs"
import identity from "./identity.mjs"
import project from "./project.mjs"
import provider from "./provider.mjs"
import sidequest from "./sidequest.mjs"
import spinner from "./spinner.mjs"
import subagents from "./subagents.mjs"
import tier from "./tier.mjs"

export const PILLS = Object.freeze([
  hint,
  project,
  git,
  spinner,
  identity,
  elapsed,
  subagents,
  sidequest,
  context,
  cost,
  tier,
  provider,
])

export const PILL_IDS = Object.freeze(PILLS.map((pill) => pill.id))

/** @param {string} id */
export function pillById(id) {
  return PILLS.find((pill) => pill.id === id)
}
