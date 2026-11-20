import { useEffect, useMemo, useState } from 'react'
import type {
  AnalysisOptions,
  ExamConfig,
  ExamData,
  ExamDraft,
  ExportSelection,
  HistoryItem,
  Template,
} from './types'
import { analyzeSeries } from './lib/analyze'
import { buildExam, detectHeaderRow, guessConfig, parseFile } from './lib/parse'
import { makeDemo } from './lib/demo'
import { exportCsv, exportXlsx } from './lib/export'
import {
  addHistory,
  loadHistory,
  loadOptions,
  loadTemplates,
  removeHistory,
  removeTemplate,
  saveOptions,
  upsertTemplate,
} from './lib/storage'
import { UploadStage } from './components/UploadStage'
import { MappingStage } from './components/MappingStage'
import { SelectStage } from './components/SelectStage'
import { ResultStage } from './components/ResultStage'
import './styles.css'

type Stage = 'upload' | 'mapping' | 'select' | 'result'

const DEFAULT_OPTIONS: AnalysisOptions = {
  rankMode: 'competition',
  bucketSize: 50,
  fullMarks: {},
  passMarks: {},
}

const DEFAULT_SELECTION: ExportSelection = {
  summary: true,
  total: true,
  subjects: true,
  stats: true,
  notes: true,
}

const MARK_DEFAULTS: Record<string, [number, number]> = {
  语文: [120, 72],
  数学: [120, 72],
  英语: [120, 72],
  专业课: [200, 120],
  发动机: [100, 60],
  总分: [660, 0],
}

const uid = () => `exam-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`

function App() {
  const [stage, setStage] = useState<Stage>('upload')
  const [drafts, setDrafts] = useState<ExamDraft[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [exams, setExams] = useState<ExamData[]>([])
  const [options, setOptions] = useState<AnalysisOptions>(() => loadOptions() ?? DEFAULT_OPTIONS)
  const [selection, setSelection] = useState<ExportSelection>(DEFAULT_SELECTION)
  const [className, setClassName] = useState('24汽修高考班')
  const [templates, setTemplates] = useState<Template[]>(() => loadTemplates())
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  const [busy, setBusy] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    saveOptions(options)
  }, [options])

  const result = useMemo(() => {
    if (exams.length < 2) return null
    try {
      return analyzeSeries(exams, options)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    }
  }, [exams, options])

  const updateDraft = (id: string, patch: Partial<ExamDraft>) => {
    setDrafts((list) => list.map((draft) => (draft.id === id ? { ...draft, ...patch } : draft)))
  }

  const addFiles = async (files: File[]) => {
    if (!files.length) return
    setError('')
    setBusy((value) => value + files.length)
    const created: ExamDraft[] = []
    const errors: string[] = []
    for (const file of files) {
      try {
        const workbook = await parseFile(file)
        const sheetIndex = 0
        const rows = workbook.sheets[sheetIndex].rows
        const headerRow = detectHeaderRow(rows)
        const base = file.name.replace(/\.(xlsx|xlsm|csv)$/i, '')
        created.push({
          id: uid(),
          label: base || `考试${drafts.length + created.length + 1}`,
          workbook,
          sheetIndex,
          rows,
          headerRow,
          config: guessConfig(rows, headerRow),
        })
      } catch (err) {
        errors.push(`${file.name}：${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setBusy((value) => Math.max(0, value - 1))
      }
    }
    if (created.length) {
      setDrafts((list) => [...list, ...created])
      setActiveId((current) => current ?? created[0].id)
      setSelectedIds((list) => [...list, ...created.map((draft) => draft.id)])
    }
    if (errors.length) setError(errors.join('；'))
  }

  const removeDraft = (id: string) => {
    setDrafts((list) => list.filter((draft) => draft.id !== id))
    setSelectedIds((list) => list.filter((item) => item !== id))
    setActiveId((current) => (current === id ? null : current))
  }

  const buildFromDraft = (draft: ExamDraft): ExamData =>
    buildExam({
      id: draft.id,
      label: draft.label.trim() || '未命名考试',
      fileName: draft.workbook.fileName,
      sheetName: draft.workbook.sheets[draft.sheetIndex]?.name ?? '',
      rows: draft.rows,
      config: draft.config,
    })

  const draftStatus = (draft: ExamDraft) => {
    try {
      const exam = buildFromDraft(draft)
      return { ok: true as const, count: exam.students.length, subjects: exam.subjects.length }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : String(err) }
    }
  }

  const goMapping = () => {
    if (drafts.length < 2) {
      setError('至少上传 2 份成绩单才能对比')
      return
    }
    setError('')
    setActiveId((current) => current ?? drafts[0]?.id ?? null)
    setStage('mapping')
  }

  const goSelect = () => {
    setError('')
    for (const draft of drafts) {
      const status = draftStatus(draft)
      if (!status.ok) {
        setActiveId(draft.id)
        setError(`「${draft.label}」还有问题：${status.message}`)
        return
      }
    }
    setSelectedIds((list) => {
      const valid = list.filter((id) => drafts.some((draft) => draft.id === id))
      const missing = drafts.filter((draft) => !valid.includes(draft.id)).map((draft) => draft.id)
      return [...valid, ...missing]
    })
    setStage('select')
  }

  const runAnalysis = () => {
    if (selectedIds.length < 2) {
      setError('至少选择 2 场考试')
      return
    }
    setError('')
    try {
      const picked = selectedIds
        .map((id) => drafts.find((draft) => draft.id === id))
        .filter((draft): draft is ExamDraft => Boolean(draft))
        .map(buildFromDraft)
      const subjects = [...new Set(picked.flatMap((exam) => exam.subjects))]
      const fullMarks = { ...options.fullMarks }
      const passMarks = { ...options.passMarks }
      for (const subject of subjects) {
        const preset = MARK_DEFAULTS[subject]
        if (!preset) continue
        if (fullMarks[subject] == null) fullMarks[subject] = preset[0]
        if (passMarks[subject] == null && preset[1]) passMarks[subject] = preset[1]
      }
      setOptions({ ...options, fullMarks, passMarks })
      setExams(picked)
      setSaved(false)
      setStage('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleDemo = (to: 'mapping' | 'select' | 'result' = 'result') => {
    const demo = makeDemo()
    const nextDrafts: ExamDraft[] = demo.exams.map((exam) => ({
      id: exam.id,
      label: exam.label,
      workbook: { fileName: exam.fileName, sheets: [{ name: exam.sheetName, rows: exam.rows }] },
      sheetIndex: 0,
      rows: exam.rows,
      headerRow: exam.config.headerRow,
      config: exam.config,
    }))
    setDrafts(nextDrafts)
    setSelectedIds(nextDrafts.map((draft) => draft.id))
    setActiveId(nextDrafts[0].id)
    setOptions(demo.options)
    setSaved(false)
    if (to === 'result') {
      setExams(demo.exams)
      setStage('result')
    } else {
      setStage(to)
    }
  }

  const applyTemplate = (template: Template) => {
    if (!drafts.length) {
      setError('请先上传成绩单，再应用模板')
      return
    }
    const mapDraft = (draft: ExamDraft): ExamDraft => {
      const header = draft.rows[draft.headerRow] ?? []
      const find = (name: string | null) =>
        name == null ? -1 : header.findIndex((cell) => String(cell ?? '').trim() === name)
      const nameCol = find(template.nameHeader)
      const totalCol = find(template.totalHeader)
      const rankCol = find(template.rankHeader)
      const subjectCols = template.subjectHeaders
        .map((name) => {
          const col = header.findIndex((cell) => String(cell ?? '').trim() === name)
          return col >= 0 ? { name, col } : null
        })
        .filter((item): item is { name: string; col: number } => item != null)
      const config: ExamConfig = {
        ...draft.config,
        nameCol: nameCol >= 0 ? nameCol : draft.config.nameCol,
        totalCol: totalCol >= 0 ? totalCol : draft.config.totalCol,
        rankCol: rankCol >= 0 ? rankCol : draft.config.rankCol,
        subjectCols: subjectCols.length ? subjectCols : draft.config.subjectCols,
      }
      return { ...draft, config }
    }
    setDrafts((list) => list.map(mapDraft))
    setOptions((current) => ({ ...current, ...template.options }))
  }

  const saveTemplate = (name: string) => {
    const base = drafts.find((draft) => draft.id === activeId) ?? drafts[0]
    if (!base) return
    const header = base.rows[base.headerRow] ?? []
    const headerOf = (col: number | null) =>
      col == null ? null : String(header[col] ?? '').trim() || null
    const template: Template = {
      id: `tpl-${Date.now()}`,
      name,
      createdAt: Date.now(),
      subjects: base.config.subjectCols.map((item) => item.name),
      subjectHeaders: base.config.subjectCols.map((item) => String(header[item.col] ?? item.name)),
      nameHeader: headerOf(base.config.nameCol),
      totalHeader: headerOf(base.config.totalCol),
      rankHeader: headerOf(base.config.rankCol),
      options,
    }
    setTemplates(upsertTemplate(template))
  }

  const saveHistory = () => {
    if (!result) return
    const item: HistoryItem = {
      id: `hist-${Date.now()}`,
      createdAt: Date.now(),
      title: className.trim() || '成绩对比',
      labels: result.labels,
      counts: result.counts,
      exams,
      options,
      selection,
    }
    setHistory(addHistory(item))
    setSaved(true)
  }

  const restoreHistory = (item: HistoryItem) => {
    setExams(item.exams)
    setOptions(item.options)
    setSelection(item.selection)
    setClassName(item.title)
    setSaved(true)
    setStage('result')
  }

  const doExportXlsx = async () => {
    if (!result) return
    setExporting(true)
    try {
      await exportXlsx(result, className.trim() || '成绩对比', selection)
    } catch (err) {
      setError(`导出失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExporting(false)
    }
  }

  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get('demo')
    if (demo === '1') handleDemo('result')
    else if (demo === 'mapping') handleDemo('mapping')
    else if (demo === 'select') handleDemo('select')
    // 仅在首次加载时读取 URL 参数
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reset = () => {
    setStage('upload')
    setDrafts([])
    setSelectedIds([])
    setActiveId(null)
    setExams([])
    setError('')
    setSaved(false)
  }

  return (
    <div className="app">
      <header className="topbar no-print">
        <div className="brand">
          <span className="brand-mark">成</span>
          <div>
            <strong>成绩对比分析</strong>
            <span>多场考试 · 横向对比 · 本地处理</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="privacy-badge">本地处理 · 不上传</span>
          <a className="top-link" href="https://edgeone.ai/pages" target="_blank" rel="noreferrer noopener">
            EdgeOne Pages
          </a>
        </div>
      </header>

      <main className={stage === 'result' ? 'container wide' : 'container slim'}>
        {stage === 'upload' ? (
          <UploadStage
            drafts={drafts}
            busy={busy > 0}
            history={history}
            error={error}
            onFiles={addFiles}
            onDemo={() => handleDemo('result')}
            onRemove={removeDraft}
            onRemoveHistory={(id) => setHistory(removeHistory(id))}
            onRestoreHistory={restoreHistory}
            onNext={goMapping}
          />
        ) : null}

        {stage === 'mapping' && drafts.length ? (
          <MappingStage
            drafts={drafts}
            activeId={activeId}
            options={options}
            templates={templates}
            error={error}
            status={draftStatus}
            onSelectDraft={setActiveId}
            onUpdate={updateDraft}
            onRemove={removeDraft}
            onBack={() => setStage('upload')}
            onNext={goSelect}
            onSaveTemplate={saveTemplate}
            onApplyTemplate={applyTemplate}
            onDeleteTemplate={(id) => setTemplates(removeTemplate(id))}
            onOptions={setOptions}
          />
        ) : null}

        {stage === 'select' ? (
          <SelectStage
            drafts={drafts}
            selectedIds={selectedIds}
            selection={selection}
            error={error}
            onToggle={(id) =>
              setSelectedIds((list) =>
                list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
              )
            }
            onMove={(id, delta) =>
              setSelectedIds((list) => {
                const index = list.indexOf(id)
                const target = index + delta
                if (index < 0 || target < 0 || target >= list.length) return list
                const next = [...list]
                next.splice(index, 1)
                next.splice(target, 0, id)
                return next
              })
            }
            onSelection={setSelection}
            onBack={() => setStage('mapping')}
            onRun={runAnalysis}
          />
        ) : null}

        {stage === 'result' && result ? (
          <ResultStage
            result={result}
            className={className}
            selection={selection}
            exporting={exporting}
            saved={saved}
            onClassName={setClassName}
            onSelection={setSelection}
            onExportXlsx={doExportXlsx}
            onExportCsv={() => exportCsv(result, className.trim() || '成绩对比')}
            onSaveHistory={saveHistory}
            onBackSelect={() => setStage('select')}
            onReset={reset}
          />
        ) : null}

        {stage === 'result' && !result ? (
          <div className="panel empty-panel">
            <p>{error || '暂无可分析的数据，请返回重新选择。'}</p>
            <button type="button" className="btn" onClick={() => setStage('select')}>
              返回选择
            </button>
          </div>
        ) : null}
      </main>

      <footer className="site-footer no-print">
        <span>成绩对比分析系统 · 纯前端 · 可部署在 EdgeOne Pages</span>
        <span>数据仅存本机浏览器；导出文件由浏览器直接生成</span>
      </footer>
    </div>
  )
}

export default App


