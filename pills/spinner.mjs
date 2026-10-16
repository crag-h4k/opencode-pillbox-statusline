// pills/spinner.mjs
// One animated cell while the session runs model or tool work. Hides with the
// identity pill and while waiting for input or in shell mode.
export default {
  id: "spinner",
  title: "Foreground activity spinner",
  sizes: ["icon"],
  plain: true,
  defaults: { order: 39, priority: 60, attach: "identity", size: "icon", accent: "hue.accent" },
}
