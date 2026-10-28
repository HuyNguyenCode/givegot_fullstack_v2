import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { setImmediate as nextTurn } from 'node:timers/promises'
import ts from 'typescript'

// Same transpile-and-mock approach as the offline legacy regression scripts.
export function loadSource<T>(file: string, mocks: Record<string, unknown>) {
  const code = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
    fileName: file,
  }).outputText
  const loadedModule = { exports: {} }
  runInNewContext(code, {
    module: loadedModule, exports: loadedModule.exports, Date,
    require: (id: string) => {
      if (!(id in mocks)) throw new Error(`Unexpected dependency: ${id}`)
      return mocks[id]
    },
    console: { log() {}, error() {} },
    setTimeout() {},
  }, { filename: file })
  return loadedModule.exports as T
}

export function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

type Element = { type: unknown; props: Record<string, unknown> }
type Hook = { value?: unknown; deps?: unknown[]; cleanup?: () => void }

// Exercise the actual component's callbacks/effects without adding a DOM framework.
// This harness does not simulate FullCalendar layout or browser pointer interaction.
export function calendarHarness(mocks: Record<string, unknown>, mentorId = 'mentor') {
  const hooks: Hook[] = []
  let cursor = 0
  let dirty = true
  let tree: Element
  let pendingEffects: Array<() => void> = []
  const equal = (a?: unknown[], b?: unknown[]) => !!a && !!b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]))
  const jsx = (type: unknown, props: Record<string, unknown>): Element => ({ type, props })
  const react = {
    useState(initial: unknown) {
      const hook = hooks[cursor++] ??= { value: initial }
      return [hook.value, (next: unknown) => {
        hook.value = typeof next === 'function' ? next(hook.value) : next
        dirty = true
      }]
    },
    useRef(initial: unknown) {
      const hook = hooks[cursor++] ??= { value: { current: initial } }
      return hook.value
    },
    useCallback(callback: unknown, deps: unknown[]) {
      const hook = hooks[cursor++] ??= {}
      if (!equal(hook.deps, deps)) { hook.value = callback; hook.deps = deps }
      return hook.value
    },
    useEffect(effect: () => void | (() => void), deps: unknown[]) {
      const hook = hooks[cursor++] ??= {}
      if (!equal(hook.deps, deps)) {
        hook.deps = deps
        pendingEffects.push(() => { hook.cleanup?.(); hook.cleanup = effect() || undefined })
      }
    },
  }
  const component = loadSource<{ default: (props: { mentorId: string }) => Element }>('src/components/MentorCalendarManager.tsx', {
    react,
    'react/jsx-runtime': { jsx, jsxs: jsx },
    '@fullcalendar/react': { __esModule: true, default: 'FullCalendar' },
    '@fullcalendar/timegrid': {}, '@fullcalendar/daygrid': {}, '@fullcalendar/interaction': {},
    '@/components/SessionDetailDialog': { __esModule: true, default: 'SessionDetailDialog' },
    ...mocks,
  }).default
  function flush() {
    for (let guard = 0; dirty; guard++) {
      if (guard > 20) throw new Error('Component did not settle')
      dirty = false
      cursor = 0
      tree = component({ mentorId })
      const effects = pendingEffects
      pendingEffects = []
      effects.forEach(effect => effect())
    }
  }
  function find(type: unknown, node: unknown): Element | undefined {
    if (!node || typeof node !== 'object') return undefined
    if (Array.isArray(node)) {
      for (const child of node) { const match = find(type, child); if (match) return match }
      return undefined
    }
    const element = node as Element
    return element.type === type ? element : find(type, element.props?.children)
  }
  flush()
  return {
    flush,
    async settle() { await nextTurn(); flush() },
    props<T>(type: unknown) {
      const element = find(type, tree)
      if (!element) throw new Error(`Missing element: ${String(type)}`)
      return element.props as T
    },
    find: (type: unknown) => find(type, tree),
    changeMentor(id: string) { mentorId = id; dirty = true; flush() },
    unmount() { hooks.forEach(hook => hook.cleanup?.()) },
  }
}
