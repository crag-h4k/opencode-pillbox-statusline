// pills/git.mjs
// Branch and dirty-file count; the full size adds line additions and deletions.
import { Color } from "../config/types.mjs"

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
}
