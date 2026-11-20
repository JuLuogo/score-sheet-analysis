import type { AnalysisOptions, HistoryItem, Template } from '../types'

const TEMPLATE_KEY = 'grade-compare.templates.v1'
const HISTORY_KEY = 'grade-compare.history.v1'
const OPTIONS_KEY = 'grade-compare.options.v1'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export function loadTemplates(): Template[] {
  return read<Template[]>(TEMPLATE_KEY, [])
}

export function saveTemplates(templates: Template[]): boolean {
  return write(TEMPLATE_KEY, templates.slice(0, 12))
}

export function upsertTemplate(template: Template): Template[] {
  const list = loadTemplates().filter((item) => item.id !== template.id)
  const next = [template, ...list].slice(0, 12)
  saveTemplates(next)
  return next
}

export function removeTemplate(id: string): Template[] {
  const next = loadTemplates().filter((item) => item.id !== id)
  saveTemplates(next)
  return next
}

export function loadHistory(): HistoryItem[] {
  return read<HistoryItem[]>(HISTORY_KEY, [])
}

export function addHistory(item: HistoryItem): HistoryItem[] {
  const next = [item, ...loadHistory()].slice(0, 6)
  write(HISTORY_KEY, next)
  return next
}

export function removeHistory(id: string): HistoryItem[] {
  const next = loadHistory().filter((item) => item.id !== id)
  write(HISTORY_KEY, next)
  return next
}

export function loadOptions(): AnalysisOptions | null {
  return read<AnalysisOptions | null>(OPTIONS_KEY, null)
}

export function saveOptions(options: AnalysisOptions) {
  write(OPTIONS_KEY, options)
}

export function clearLocalData() {
  localStorage.removeItem(TEMPLATE_KEY)
  localStorage.removeItem(HISTORY_KEY)
  localStorage.removeItem(OPTIONS_KEY)
}
