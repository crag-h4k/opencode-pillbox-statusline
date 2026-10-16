// src/pills/project.mjs
// Project name, falling back to the working directory's basename.
import { fit } from "../render/width.mjs"

export default {
  id: "project",
  title: "Project",
  sizes: ["full", "icon"],
  defaults: { when: "always", order: 10, priority: 95, maxWidth: 18, accent: "feedback.info" },
  render(data, settings, icons) {
    if (!data.project) return undefined
    return { icon: icons.project, sizes: { full: fit(data.project, settings.maxWidth), icon: "" } }
  },
}
