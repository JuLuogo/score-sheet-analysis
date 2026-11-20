import { useEffect, useMemo, useState } from 'react'
import type {
  AnalysisOptions,
  ExamConfig,
  ExamData,
  ExamDraft,
  ExamRole,
  HistoryItem,
  Template,
} from './types'
import { analyze } from './lib/analyze'
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
import { ResultStage } from './components/ResultStage'
import './styles.css'

type Stage = 'upload' | 'mapping' | 'result'

const DEFAULT_OPTIONS: AnalysisOptions = {
  rankMode: 'competition',
  bucketSize: 50,
  fullMarks: {},
  passMarks: {},
}

const MARK_DEFAULTS: Record<string, [number, number]> = {
  语文: [120, 72],
  数学: [120, 72],
  英语: [120, 72],
  专业课: [200, 120],
  发动机: [100, 60],
  总分: [660, 0],
}

function App() {
  const [stage, setStage] = useState<Stage>('upload')
  const [baseDraft, setBaseDraft] = useState<ExamDraft | null>(null)
  const [targetDraft, setTargetDraft] = useState<ExamDraft | null>(null)
  const [baseExam, setBaseExam] = useState<ExamData | null>(null)
  const [targetExam, setTargetExam] = useState<ExamData | null>(null)
  const [options, setOptions] = useState<AnalysisOptions>(() => loadOptions() ?? DEFAULT_OPTIONS)
  const [className, setClassName] = useState('24汽修高考班')
  const [templates, setTemplates] = useState<Template[]>(() => loadTemplates())
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  const [busyRole, setBusyRole] = useState<ExamRole | null>(null)
  const [exporting, setExporting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    saveOptions(options)
  }, [options])

  const result = useMemo(() => {
    if (!baseExam || !targetExam) return null
    try {
      return analyze(baseExam, targetExam, options)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    }
  }, [baseExam, targetExam, options])

  const setDraft = (role: ExamRole, draft: ExamDraft | null) => {
    if (role === 'base') setBaseDraft(draft)
    else setTargetDraft(draft)
  }

  const handleFile = async (role: ExamRole, file: File) => {
    setBusyRole(role)
    setError('')
    try {
      const workbook = await parseFile(file)
      const sheetIndex = 0
      const rows = workbook.sheets[sheetIndex].rows
      const headerRow = detectHeaderRow(rows)
      const config = guessConfig(rows, headerRow)
      setDraft(role, {
        role,
        label: role === 'base' ? '基准考试' : '对比考试',
        workbook,
        sheetIndex,
        rows,
        headerRow,
        config,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusyRole(null)
    }
  }

  const changeSheet = (role: ExamRole, sheetIndex: number) => {
    const draft = role === 'base' ? baseDraft : targetDraft
    if (!draft) return
    const rows = draft.workbook.sheets[sheetIndex]?.rows ?? []
    const headerRow = detectHeaderRow(rows)
    setDraft(role, { ...draft, sheetIndex, rows, headerRow, config: guessConfig(rows, headerRow) })
  }

  const changeHeader = (role: ExamRole, headerRow: number) => {
    const draft = role === 'base' ? baseDraft : targetDraft
    if (!draft) return
    setDraft(role, { ...draft, headerRow, config: guessConfig(draft.rows, headerRow) })
  }

  const changeConfig = (role: ExamRole, config: ExamConfig) => {
    const draft = role === 'base' ? baseDraft : targetDraft
    if (!draft) return
    setDraft(role, { ...draft, config })
  }

  const changeLabel = (role: ExamRole, label: string) => {
    const draft = role === 'base' ? baseDraft : targetDraft
    if (!draft) return
    setDraft(role, { ...draft, label })
  }

  const withMarks = (next: AnalysisOptions, subjects: string[]): AnalysisOptions => {
    const fullMarks = { ...next.fullMarks }
    const passMarks = { ...next.passMarks }
    for (const subject of subjects) {
      const preset = MARK_DEFAULTS[subject]
      if (!preset) continue
      if (fullMarks[subject] == null) fullMarks[subject] = preset[0]
      if (passMarks[subject] == null && preset[1]) passMarks[subject] = preset[1]
    }
    return { ...next, fullMarks, passMarks }
  }

  const buildFromDraft = (draft: ExamDraft): ExamData =>
    buildExam({
      role: draft.role,
      label: draft.label.trim() || (draft.role === 'base' ? '基准考试' : '对比考试'),
      fileName: draft.workbook.fileName,
      sheetName: draft.workbook.sheets[draft.sheetIndex]?.name ?? '',
      rows: draft.rows,
      config: draft.config,
    })

  const runAnalysis = () => {
    if (!baseDraft || !targetDraft) return
    setError('')
    try {
      const base = buildFromDraft(baseDraft)
      const target = buildFromDraft(targetDraft)
      const subjects = [...new Set([...base.subjects, ...target.subjects])]
      setOptions((current) => withMarks(current, subjects))
      setBaseExam(base)
      setTargetExam(target)
      setSaved(false)
      setStage('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const applyTemplate = (template: Template) => {
    if (!baseDraft && !targetDraft) {
      setError('请先上传至少一份成绩单，再应用模板')
      return
    }
    const mapDraft = (draft: ExamDraft): ExamDraft => {
      const header = draft.rows[draft.headerRow] ?? []
      const findCol = (name: string | null) => {
        if (!name) return null
        const index = header.findIndex((cell) => String(cell ?? '').trim() === name)
        return index >= 0 ? index : null
      }
      const nameCol = findCol(template.nameHeader) ?? draft.config.nameCol
      const totalCol = findCol(template.totalHeader) ?? draft.config.totalCol
      const rankCol = findCol(template.rankHeader) ?? draft.config.rankCol
      const subjectCols = template.subjectHeaders
        .map((name) => {
          const col = header.findIndex((cell) => String(cell ?? '').trim() === name)
          return col >= 0 ? { name, col } : null
        })
        .filter((item): item is { name: string; col: number } => item != null)
      const config: ExamConfig = {
        ...draft.config,
        nameCol,
        totalCol,
        rankCol,
        subjectCols: subjectCols.length ? subjectCols : draft.config.subjectCols,
      }
      return { ...draft, config }
    }
    if (baseDraft) setBaseDraft(mapDraft(baseDraft))
    if (targetDraft) setTargetDraft(mapDraft(targetDraft))
    setOptions({ ...options, ...template.options })
  }

  const saveTemplate = (name: string) => {
    if (!baseDraft) return
    const header = baseDraft.rows[baseDraft.headerRow] ?? []
    const headerOf = (col: number | null) => (col == null ? null : String(header[col] ?? '').trim() || null)
    const template: Template = {
      id: `tpl-${Date.now()}`,
      name,
      createdAt: Date.now(),
      subjects: baseDraft.config.subjectCols.map((item) => item.name),
      subjectHeaders: baseDraft.config.subjectCols.map((item) => String(header[item.col] ?? item.name)),
      nameHeader: headerOf(baseDraft.config.nameCol),
      totalHeader: headerOf(baseDraft.config.totalCol),
      rankHeader: headerOf(baseDraft.config.rankCol),
      options,
    }
    setTemplates(upsertTemplate(template))
  }

  const handleDemo = (toResult = true) => {
    const demo = makeDemo()
    const base: ExamDraft = {
      role: 'base',
      label: demo.base.label,
      workbook: { fileName: demo.base.fileName, sheets: [{ name: 'Sheet1', rows: demo.base.rows }] },
      sheetIndex: 0,
      rows: demo.base.rows,
      headerRow: demo.base.config.headerRow,
      config: demo.base.config,
    }
    const target: ExamDraft = {
      role: 'target',
      label: demo.target.label,
      workbook: { fileName: demo.target.fileName, sheets: [{ name: 'Sheet1', rows: demo.target.rows }] },
      sheetIndex: 0,
      rows: demo.target.rows,
      headerRow: demo.target.config.headerRow,
      config: demo.target.config,
    }
    setBaseDraft(base)
    setTargetDraft(target)
    setBaseExam(demo.base)
    setTargetExam(demo.target)
    setOptions(demo.options)
    setSaved(false)
    setStage(toResult ? 'result' : 'mapping')
  }

  const restoreHistory = (item: HistoryItem) => {
    setBaseExam(item.base)
    setTargetExam(item.target)
    setOptions(item.options)
    setClassName(item.title || '成绩对比')
    setSaved(true)
    setStage('result')
  }

  useEffect(() => {
    const demoParam = new URLSearchParams(window.location.search).get('demo')
    if (demoParam === '1' || demoParam === 'mapping') {
      handleDemo(demoParam === '1')
    }
    // 只在首次加载时根据 URL 决定是否进入演示
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const saveHistory = () => {
    if (!result || !baseExam || !targetExam) return
    const item: HistoryItem = {
      id: `hist-${Date.now()}`,
      createdAt: Date.now(),
      title: className.trim() || '成绩对比',
      baseLabel: baseExam.label,
      targetLabel: targetExam.label,
      baseFileName: baseExam.fileName,
      targetFileName: targetExam.fileName,
      counts: result.counts,
      base: baseExam,
      target: targetExam,
      options,
    }
    setHistory(addHistory(item))
    setSaved(true)
  }

  const doExportXlsx = async () => {
    if (!result) return
    setExporting(true)
    try {
      await exportXlsx(result, className.trim() || '成绩对比')
    } catch (err) {
      setError(`导出失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExporting(false)
    }
  }

  const reset = () => {
    setStage('upload')
    setBaseDraft(null)
    setTargetDraft(null)
    setBaseExam(null)
    setTargetExam(null)
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
            <span>Grade Compare · 可复用 / 可导出 / 纯前端</span>
          </div>
        </div>
        <div className="topbar-right">
          <span className="privacy-badge" title="数据不会离开你的电脑">
            本地处理 · 不上传
          </span>
          <a
            className="top-link"
            href="https://edgeone.ai/pages"
            target="_blank"
            rel="noreferrer noopener"
          >
            EdgeOne Pages
          </a>
        </div>
      </header>

      <main className="container">
        {stage === 'upload' ? (
          <UploadStage
            base={baseDraft}
            target={targetDraft}
            templates={templates}
            history={history}
            busyRole={busyRole}
            error={error}
            onFile={handleFile}
            onDemo={handleDemo}
            onNext={() => setStage('mapping')}
            onRestoreHistory={restoreHistory}
            onRemoveHistory={(id) => setHistory(removeHistory(id))}
            onApplyTemplate={applyTemplate}
            onDeleteTemplate={(id) => setTemplates(removeTemplate(id))}
          />
        ) : null}

        {stage === 'mapping' && baseDraft && targetDraft ? (
          <MappingStage
            base={baseDraft}
            target={targetDraft}
            options={options}
            templates={templates}
            error={error}
            onConfig={changeConfig}
            onLabel={changeLabel}
            onSheet={changeSheet}
            onHeader={changeHeader}
            onOptions={setOptions}
            onBack={() => setStage('upload')}
            onRun={runAnalysis}
            onSaveTemplate={saveTemplate}
            onApplyTemplate={applyTemplate}
          />
        ) : null}

        {stage === 'result' && result ? (
          <ResultStage
            result={result}
            className={className}
            onClassName={setClassName}
            exporting={exporting}
            saved={saved}
            onExportXlsx={doExportXlsx}
            onExportCsv={() => exportCsv(result, className.trim() || '成绩对比')}
            onSaveHistory={saveHistory}
            onBackMapping={() => setStage('mapping')}
            onReset={reset}
          />
        ) : null}

        {stage === 'mapping' && (!baseDraft || !targetDraft) ? (
          <div className="panel empty-panel">
            <p>请先返回上传两份成绩单。</p>
            <button type="button" className="btn" onClick={() => setStage('upload')}>
              返回上传
            </button>
          </div>
        ) : null}

        {stage === 'result' && !result ? (
          <div className="panel empty-panel">
            <p>{error || '分析结果为空，请返回检查字段。'}</p>
            <button type="button" className="btn" onClick={() => setStage('mapping')}>
              返回字段确认
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

