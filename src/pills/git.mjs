// src/pills/git.mjs
// Branch and dirty-file count; the full size adds line additions and deletions.
import { Color } from "../config/types.mjs"
import { fit } from "../render/width.mjs"

export default {
  id: "git",
  title: "Git branch and changes",
  sizes: ["full", "compact", "icon"],
  options: {
    dirtyAccent: Color.annotate({ description: "Icon color while the worktree has changes" }),
  },
  defaults: {
    when: "always",
    order: 20,
    priority: 90,
    maxWidth: 18,
    accent: "feedback.success",
    dirtyAccent: "feedback.warning",
  },
  render(data, settings, icons) {
    const git = data.git
    if (!git?.branch) return undefined
    const branch = fit(git.branch, settings.maxWidth)
    if (!git.files) return { icon: icons.git, sizes: { full: branch, compact: branch, icon: "" } }
    return {
      icon: icons.git,
      accent: settings.dirtyAccent,
      sizes: {
        full: `${branch} \u2022${git.files} +${git.additions} -${git.deletions}`,
        compact: `${branch} \u2022${git.files}`,
        icon: "",
      },
    }
  },
}
