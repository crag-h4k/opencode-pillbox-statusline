// pills/hint.mjs
// The interrupt shortcut while a turn runs, or the exit hint in shell mode. Plain
// text, no pill surface.
export default {
  id: "hint",
  title: "Interrupt and shell-mode hint",
  sizes: ["full"],
  plain: true,
  defaults: { when: "session", order: 0, priority: 100, accent: "text.muted", value: "text.muted" },
}
