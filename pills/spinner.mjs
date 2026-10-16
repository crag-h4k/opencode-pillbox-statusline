// pills/spinner.mjs
// One animated cell while the session runs model or tool work. Hides with the
// identity pill and while waiting for input or in shell mode.
import { foregroundActive } from "../activity.mjs"

export default {
  id: "spinner",
  title: "Foreground activity spinner",
  sizes: ["icon"],
  plain: true,
  defaults: { order: 39, priority: 60, attach: "identity", size: "icon", accent: "hue.accent" },
  render(data, _settings, icons) {
    if (!foregroundActive({ mode: data.mode, status: data.status, waiting: Boolean(data.waiting) })) return undefined
    const frames = icons.spinner
    return { icon: frames[(data.tick ?? 0) % frames.length], sizes: { icon: "" } }
  },
}
