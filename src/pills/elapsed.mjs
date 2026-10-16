// src/pills/elapsed.mjs
// Wall-clock age since the session was created.
import { duration } from "../render/format.mjs"

export default {
  id: "elapsed",
  title: "Session age",
  sizes: ["full", "icon"],
  defaults: { order: 50, priority: 30, accent: "hue.accent" },
  render(data, _settings, icons) {
    if (!data.createdAt) return undefined
    return { icon: icons.elapsed, sizes: { full: duration(data.now - data.createdAt), icon: "" } }
  },
}
