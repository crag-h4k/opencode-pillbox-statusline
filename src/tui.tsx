/** @jsxImportSource @opentui/solid */
// src/tui.tsx
// Terminal half: reads options from the cli.json plugin entry, builds a data
// snapshot from OpenCode's live session state, and draws the session and home
// footers from bar.mjs. Decisions live in the .mjs modules; this file only
// gathers data, measures width, resolves colors, and draws.
import type { BoxRenderable } from "@opentui/core"
import { Plugin, usePlugin } from "@opencode/plugin/tui"
import { useTerminalDimensions } from "@opentui/solid"
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { familyActivity, foregroundActive, SPINNER_INTERVAL_MS, spinnerClockActive, waitingForInput } from "./render/activity.mjs"
import { barModel } from "./render/bar.mjs"
import { resolveConfig } from "./config/resolve.mjs"
import { basename, contextUsage } from "./render/format.mjs"
import { sizesOf } from "./render/layout.mjs"
import { Tiers, type TiersResult, Usage, type UsageResult } from "./rpc.ts"
import { agentColor, resolveColor } from "./render/theme.mjs"
import { freshUsage } from "./quota.mjs"
import { glyphReport, layoutReport, optionsReport, sourcesReport } from "./diagnostics.mjs"
import { Diagnostics } from "./diagnostics.tsx"

type Context = ReturnType<typeof usePlugin>
type Location = ReturnType<Context["data"]["location"]["default"]>
type Config = ReturnType<typeof resolveConfig>["config"]
type Model = ReturnType<typeof barModel>
type BarPill = Model["pills"][number]
type Tokens = string | readonly string[] | undefined
type Paint = (tokens: Tokens) => any
type GitStats = { files: number; additions: number; deletions: number }
type PollState = { state: "disabled" | "loading" | "ready" | "error"; succeededAt?: number }

const NO_CHANGES: GitStats = { files: 0, additions: 0, deletions: 0 }

function useTick(active: () => boolean) {
  const [tick, setTick] = createSignal(0)
  createEffect(() => {
    if (!active()) return
    const timer = setInterval(() => setTick((value) => value + 1), SPINNER_INTERVAL_MS)
    onCleanup(() => clearInterval(timer))
  })
  return tick
}

function PillView(props: { pill: BarPill; paint: Paint; surface: () => any }) {
  const background = () => (props.pill.plain ? undefined : props.surface())
  const foreground = (part: BarPill["parts"][number]) => {
    if (part.role === "icon") return props.paint(props.pill.accent)
    if (part.role === "text") return props.paint(("color" in part ? part.color : undefined) ?? props.pill.value)
    return undefined
  }
  return (
    <text wrapMode="none" flexShrink={0}>
      <For each={props.pill.parts}>
        {(part) =>
          part.role === "cap" ? (
            <span style={{ fg: props.surface() }}>{part.text}</span>
          ) : (
            <span style={{ fg: foreground(part), bg: background() }}>{part.text}</span>
          )}
      </For>
    </text>
  )
}

function BarView(props: {
  model: Model
  gap: number
  paint: Paint
  surface: () => any
  grow: boolean
  onWidth?: (width: number) => void
}) {
  const left = createMemo(() => props.model.pills.filter((pill) => pill.group === "left"))
  const right = createMemo(() => props.model.pills.filter((pill) => pill.group === "right"))
  return (
    <box
      flexDirection="row"
      flexGrow={props.grow ? 1 : 0}
      flexShrink={1}
      minWidth={0}
      onSizeChange={function (this: BoxRenderable) {
        props.onWidth?.(this.width)
      }}
    >
      <box flexDirection="row" flexShrink={0} gap={props.gap}>
        <For each={left()}>{(pill) => <PillView pill={pill} paint={props.paint} surface={props.surface} />}</For>
      </box>
      <Show when={right().length > 0}>
        <box flexGrow={1} minWidth={props.gap} />
        <box flexDirection="row" flexShrink={0} gap={props.gap}>
          <For each={right()}>{(pill) => <PillView pill={pill} paint={props.paint} surface={props.surface} />}</For>
        </box>
      </Show>
    </box>
  )
}

function projectName(context: Context, location: Location, sessionID?: string) {
  const session = sessionID ? context.data.session.get(sessionID) : undefined
  const info = session ? context.data.project.get(session.projectID) : undefined
  return info?.name || basename(info?.canonical || session?.location.directory || location.directory)
}

export default Plugin.define({
  id: "pillbox.tui",
  setup(context) {
    const { config, errors } = resolveConfig(context.options)
    for (const error of errors) console.error(`[pillbox] option ${error.path || "(root)"}: ${error.message}`)
    if (errors.length) {
      const first = errors[0]
      context.ui.toast.show({
        message: `pillbox: ${errors.length} option ${errors.length === 1 ? "error" : "errors"}; ${first.path || "options"}: ${first.message}`,
        variant: "warning",
      })
    }

    const location = context.location ?? context.data.location.default()
    const [git, setGit] = createSignal<GitStats>(NO_CHANGES)
    const [now, setNow] = createSignal(Date.now())
    let gitTimer: ReturnType<typeof setTimeout> | undefined

    async function refreshGit() {
      try {
        const result = await context.client.vcs.status({ location })
        const files = result.data
        setGit({
          files: files.length,
          additions: files.reduce((total, file) => total + file.additions, 0),
          deletions: files.reduce((total, file) => total + file.deletions, 0),
        })
      } catch {
        setGit(NO_CHANGES)
      }
    }
    const scheduleGit = () => {
      if (gitTimer) clearTimeout(gitTimer)
      gitTimer = setTimeout(() => void refreshGit(), 250)
    }

    void context.data.location.vcs.sync(location)
    void context.data.location.agent.sync(location)
    void context.data.location.model.sync(location)
    void context.data.location.provider.sync(location)
    void context.data.project.sync()
    void refreshGit()
    const clock = setInterval(() => setNow(Date.now()), 30_000)
    const stopFiles = context.data.on("filesystem.changed", scheduleGit)
    const stopBranch = context.data.on("vcs.branch.updated", () => {
      void context.data.location.vcs.sync(location)
      scheduleGit()
    })

    // Quota and model tiers come from the server half. Without it the calls
    // fail quietly and the provider pill stays hidden. Each call times out,
    // and a new one waits until the previous call has settled.
    const usageRpc = context.client.rpc(Usage)
    const tiersRpc = context.client.rpc(Tiers)
    const [usage, setUsage] = createSignal<UsageResult["providers"]>({})
    const [tiers, setTiers] = createSignal<TiersResult>({ models: {} })
    const [polling, setPolling] = createSignal<Record<"usage" | "tiers", PollState>>({
      usage: { state: "disabled" },
      tiers: { state: "disabled" },
    })
    const timers: ReturnType<typeof setInterval>[] = []
    const busy = new Set<string>()
    async function poll(name: "usage" | "tiers", call: () => Promise<void>) {
      if (busy.has(name)) return
      busy.add(name)
      setPolling((value) => ({ ...value, [name]: { ...value[name], state: "loading" } }))
      try {
        await call()
        setPolling((value) => ({ ...value, [name]: { state: "ready", succeededAt: Date.now() } }))
      } catch {
        // keep the last figures; freshUsage drops them once they are stale
        setPolling((value) => ({ ...value, [name]: { ...value[name], state: "error" } }))
      } finally {
        busy.delete(name)
      }
    }
    const refreshUsage = () =>
      poll("usage", async () => {
        const result = (await usageRpc.get({}, { signal: AbortSignal.timeout(15_000) })) as UsageResult
        if (!result?.providers || typeof result.providers !== "object" || Array.isArray(result.providers)) throw new Error("Invalid usage response")
        setUsage(result.providers)
      })
    const refreshTiers = () =>
      poll("tiers", async () => {
        const result = (await tiersRpc.get({}, { signal: AbortSignal.timeout(15_000) })) as TiersResult
        if (!result?.models || typeof result.models !== "object" || Array.isArray(result.models)) throw new Error("Invalid tiers response")
        setTiers(result)
      })
    if (config.pills.provider.enabled) {
      void refreshUsage()
      timers.push(setInterval(() => void refreshUsage(), config.sources.usage.refresh * 1000))
    }
    if (config.pills.tier.enabled) {
      void refreshTiers()
      timers.push(setInterval(() => void refreshTiers(), config.sources.tiers.refresh * 1000))
    }

    const branch = () => context.data.location.vcs.info(location)?.branch.current
    const gitData = () => {
      const current = branch()
      return current ? { branch: current, ...git() } : undefined
    }
    const surface = () => resolveColor(context.theme, config.style.surface, { mode: context.themeMode })
    const bars = new Map<string, () => Model>()
    const resolvedOptions = optionsReport(config, errors)
    const glyphs = glyphReport(config)
    let diagnosticsOpen = false
    context.keymap.layer(() => ({
      mode: "global",
      commands: [{
        id: "pillbox.diagnostics",
        title: "Pillbox diagnostics",
        group: "Pillbox",
        palette: true,
        slash: { name: "pillbox" },
        run: () => {
          const route = context.ui.router.current()
          const key = route.type === "session" ? route.sessionID : route.type === "home" ? "home" : undefined
          context.ui.dialog.show(() => (
            <Diagnostics sections={[
              { title: "Layout", text: layoutReport(key ? bars.get(key)?.() : undefined) },
              { title: "Sources", text: sourcesReport({ usage: usage(), tiers: tiers(), polling: polling(), config, now: Math.max(now(), Date.now()) }) },
              { title: "Options", text: resolvedOptions },
              { title: "Glyphs", text: `OpenTUI width method: ${context.renderer.widthMethod}\n${glyphs}` },
            ]} />
          ), () => { diagnosticsOpen = false })
          diagnosticsOpen = true
        },
      }],
    }))

    function SessionFooter(props: { sessionID?: string; mode: "normal" | "shell" }) {
      const terminal = useTerminalDimensions()
      const [width, setWidth] = createSignal(terminal().width)
      const session = createMemo(() => (props.sessionID ? context.data.session.get(props.sessionID) : undefined))

      createEffect(() => {
        const id = props.sessionID
        if (!id) return
        void context.data.session.sync(id)
        void context.data.session.message.sync(id)
      })

      const state = createMemo(() => {
        const id = props.sessionID
        if (!id) return undefined
        const status = context.data.session.status(id)
        const waiting = waitingForInput(
          context.data.session.permission.list(id)?.length ?? 0,
          context.data.session.form.list(id)?.length ?? 0,
        )
        const root = context.data.session.root(id)
        const children = context.data.session.family(root).filter((child) => child !== root)
        const subagents = familyActivity(
          children,
          (child: string) => context.data.session.status(child),
          (child: string) => context.data.session.pending.list(child).length,
        )
        return { status, waiting, subagents }
      })

      const tick = useTick(() => {
        const current = state()
        if (!current) return false
        const foreground = foregroundActive({ mode: props.mode, status: current.status, waiting: current.waiting })
        return spinnerClockActive(foreground, current.subagents.running)
      })

      const agentPaint = createMemo(() => {
        const active = session()
        const agents = context.data.location.agent.list(active?.location ?? location) ?? []
        return active?.agent ? agentColor(context.theme, agents, active.agent, context.themeMode) : undefined
      })
      const paint: Paint = (tokens) =>
        resolveColor(context.theme, tokens, { mode: context.themeMode, agentColor: agentPaint() })

      let previous: Map<string, string> | undefined
      const model = createMemo(() => {
        const id = props.sessionID
        const active = session()
        const current = state()
        const models = context.data.location.model.list(active?.location ?? location) ?? []
        const modelRef = active?.model
        const info = modelRef ? models.find((item) => item.providerID === modelRef.providerID && item.id === modelRef.id) : undefined
        const output = info?.cost?.[0]?.output
        const providerID = modelRef?.providerID
        const providerName = providerID
          ? context.data.location.provider.list(active?.location ?? location)?.find((item) => item.id === providerID)?.name
          : undefined
        const ownTiers = tiers().models
        const category = providerID === "github-copilot" && modelRef && Object.hasOwn(ownTiers, modelRef.id)
          ? ownTiers[modelRef.id]
          : undefined
        const ownUsage = usage()
        const providerUsage = providerID && Object.hasOwn(ownUsage, providerID) ? ownUsage[providerID] : undefined
        const data = {
          mode: props.mode,
          status: current?.status,
          waiting: current?.waiting,
          interrupt: context.keymap.shortcuts("session.interrupt")[0],
          now: now(),
          tick: tick(),
          project: projectName(context, location, id),
          git: gitData(),
          agent: active?.agent,
          model: modelRef?.id,
          variant: modelRef?.variant,
          createdAt: active?.time.created,
          subagents: current?.subagents,
          context: id
            ? contextUsage({
                messages: context.data.session.message.list(id),
                revertMessageID: active?.revert?.messageID,
                models,
              })
            : undefined,
          cost: id ? context.data.session.cost(id) : undefined,
          tier: category || typeof output === "number" ? { category, outputCost: output } : undefined,
          provider: providerID
            ? { id: providerID, name: providerName ?? providerID, ...freshUsage(providerUsage, now()) }
            : undefined,
        }
        const result = barModel(config, data, {
          bar: "session",
          budget: Math.max(0, width() - config.layout.reserve),
          columns: terminal().width,
          previous,
          flat: !surface(),
        })
        previous = sizesOf(result.fit)
        return result
      })

      createEffect(() => {
        const id = props.sessionID
        if (!id) return
        bars.set(id, model)
        onCleanup(() => {
          if (bars.get(id) === model) bars.delete(id)
        })
      })

      return (
        <Show when={props.sessionID} fallback={<box />}>
          <BarView
            model={model()}
            gap={config.style.gap}
            paint={paint}
            surface={surface}
            grow
            onWidth={(value) => {
              if (value > 0 && value !== width()) setWidth(value)
            }}
          />
        </Show>
      )
    }

    function HomeFooter() {
      const terminal = useTerminalDimensions()
      const paint: Paint = (tokens) => resolveColor(context.theme, tokens, { mode: context.themeMode })
      const model = createMemo(() =>
        barModel(
          config,
          { mode: "normal", now: now(), project: projectName(context, location), git: gitData() },
          {
            bar: "home",
            budget: Math.max(0, terminal().width - config.layout.reserve),
            columns: terminal().width,
            flat: !surface(),
          },
        ),
      )
      createEffect(() => {
        bars.set("home", model)
        onCleanup(() => {
          if (bars.get("home") === model) bars.delete("home")
        })
      })
      return <BarView model={model()} gap={config.style.gap} paint={paint} surface={surface} grow={false} />
    }

    const sessionSlot = context.ui.slot({
      replace: "prompt.footer.status",
      render: (input) => <SessionFooter sessionID={input.sessionID} mode={input.mode} />,
    })
    const homeSlot = context.ui.slot({
      prepend: "home.footer.status",
      render: () => <HomeFooter />,
    })

    return () => {
      if (diagnosticsOpen) context.ui.dialog.clear()
      if (gitTimer) clearTimeout(gitTimer)
      clearInterval(clock)
      for (const timer of timers) clearInterval(timer)
      stopFiles()
      stopBranch()
      sessionSlot()
      homeSlot()
    }
  },
})
