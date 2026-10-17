/** @jsxImportSource @opentui/solid */
import type { ScrollBoxRenderable } from "@opentui/core"
import { usePlugin } from "@opencode/plugin/tui"
import { useTerminalDimensions } from "@opentui/solid"
import { createSignal, For } from "solid-js"

export function Diagnostics(props: { sections: { title: string; text: string }[] }) {
  const context = usePlugin()
  context.ui.dialog.set({ size: "xlarge", centered: true })
  const terminal = useTerminalDimensions()
  const [selected, setSelected] = createSignal(0)
  // The fit reads keymap shortcuts. Keep its reactive report out of the layer factory.
  const titles = props.sections.map((section) => section.title)
  let scroll: ScrollBoxRenderable | undefined
  context.keymap.layer(() => ({
    mode: "global",
    target: () => scroll,
    commands: [
      { bind: "escape", run: () => context.ui.dialog.clear() },
      ...titles.map((title, index) => ({
        bind: String(index + 1),
        title,
        run: () => {
          setSelected(index)
          scroll?.scrollTo(0)
        },
      })),
    ],
  }))
  return (
    <box paddingX={2} paddingY={1} gap={1}>
      <text fg={context.theme.text.base}>Pillbox diagnostics</text>
      <box flexDirection="row" gap={2}>
        <For each={titles}>
          {(title, index) => (
            <text fg={selected() === index() ? context.theme.text.base : context.theme.text.muted}>
              {index() + 1} {title}
            </text>
          )}
        </For>
      </box>
      <scrollbox ref={scroll} focused height={Math.max(3, terminal().height - 12)} scrollX={false}>
        <text fg={context.theme.text.base} wrapMode="word">{props.sections[selected()].text}</text>
      </scrollbox>
      <text fg={context.theme.text.muted}>1-4 section · arrows/PgUp/PgDn scroll · esc close</text>
    </box>
  )
}
