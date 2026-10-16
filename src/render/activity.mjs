// src/render/activity.mjs
// Session activity: spinner frames and the foreground and subagent state that
// drives them. No host imports.

export const SPINNER_INTERVAL_MS = 80
export const FOREGROUND_SPINNER_FRAMES = Object.freeze(["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"])
export const BACKGROUND_SPINNER_FRAMES = Object.freeze([".", "o", "O", "o"])

/**
 * @param {readonly string[]} frames
 * @param {number} tick
 */
function spinnerFrame(frames, tick) {
  return frames[tick % frames.length]
}

/** @param {number} tick */
export function foregroundSpinnerFrame(tick) {
  return spinnerFrame(FOREGROUND_SPINNER_FRAMES, tick)
}

/**
 * The animated frame while children run, else the static queued icon.
 * @param {number} running
 * @param {number} tick
 * @param {string} queuedIcon
 */
export function subagentFrame(running, tick, queuedIcon) {
  return running > 0 ? spinnerFrame(BACKGROUND_SPINNER_FRAMES, tick) : queuedIcon
}

/**
 * @param {number} permissions
 * @param {number} forms
 */
export function waitingForInput(permissions, forms) {
  return permissions > 0 || forms > 0
}

/**
 * @param {{
 *   mode: "normal" | "shell"
 *   status: "idle" | "running"
 *   waiting: boolean
 * }} state
 */
export function foregroundActive(state) {
  return state.mode === "normal" && state.status === "running" && !state.waiting
}

/**
 * @param {boolean} foreground
 * @param {number} runningChildren
 */
export function spinnerClockActive(foreground, runningChildren) {
  return foreground || runningChildren > 0
}

/**
 * @param {string[]} children
 * @param {(sessionID: string) => "idle" | "running"} status
 * @param {(sessionID: string) => number} pending
 */
export function familyActivity(children, status, pending) {
  return children.reduce(
    (activity, child) => ({
      running: activity.running + (status(child) === "running" ? 1 : 0),
      queued: activity.queued + pending(child),
    }),
    { running: 0, queued: 0 },
  )
}

/** @param {{ running: number; queued: number }} activity */
export function subagentLabel(activity) {
  return [
    activity.running ? `${activity.running} run` : "",
    activity.queued ? `${activity.queued} queued` : "",
  ]
    .filter(Boolean)
    .join(" · ")
}
