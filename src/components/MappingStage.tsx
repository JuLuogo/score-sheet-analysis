import { useMemo, useState } from 'react'
import type { AnalysisOptions, ExamConfig, ExamDraft, Template } from '../types'
import { detectHeaderRow, guessConfig } from '../lib/parse'

type Status = { ok: true; count: number; subjects: number } | { ok: false; message: string }

interface MappingStageProps {
  drafts: ExamDraft[]
  activeId: string | null
  options: AnalysisOptions
  templates: Template[]
  error: string
  status: (draft: ExamDraft) => Status
  onSelectDraft: (id: string) => void
  onUpdate: (id: string, patch: Partial<ExamDraft>) => void
  onRemove: (id: string) => void
  onBack: () => void
  onNext: () => void
  onOptions: (options: AnalysisOptions) => void
  onSaveTemplate: (name: string) => void
  onApplyTemplate: (template: Template) => void
  onDeleteTemplate: (id: string) => void
}

export function MappingStage(props: MappingStageProps) {
  const active = props.drafts.find((draft) => draft.id === props.activeId) ?? props.drafts[0]
  const [templateName, setTemplateName] = useState('')

  const subjects = useMemo(() => {
    const list: string[] = []
    for (const draft of props.drafts) {
      for (const item of draft.config.subjectCols) {
        if (item.name && !list.includes(item.name)) list.push(item.name)
      }
    }
    return list
  }, [props.drafts])

  const allOk = props.drafts.every((draft) => props.status(draft).ok)

  return (
    <div className="stage mapping-stage">
      <div className="stage-head">
        <div>
          <p className="eyebrow">第 2 步 / 共 4 步</p>
          <h1>确认每份成绩单的字段</h1>
          <p className="stage-sub">自动识别有误时手动改；左侧切换考试，改完一起进入下一步。</p>
        </div>
        <div className="stage-actions">
          <button type="button" className="btn ghost" onClick={props.onBack}>
            返回上传
          </button>
          <button type="button" className="btn primary" disabled={!allOk} onClick={props.onNext}>
            下一步：选择场次
          </button>
        </div>
      </div>

      {props.error ? <div className="alert error">{props.error}</div> : null}

      <div className="mapping-layout">
        <aside className="exam-aside">
          {props.drafts.map((draft, index) => {
            const status = props.status(draft)
            return (
              <button
                key={draft.id}
                type="button"
                className={`exam-aside-item ${draft.id === active?.id ? 'active' : ''}`}
                onClick={() => props.onSelectDraft(draft.id)}
              >
                <span className="exam-aside-index">{index + 1}</span>
                <span className="exam-aside-main">
                  <strong>{draft.label}</strong>
                  <small>
                    {status.ok ? `${status.count} 人 · ${status.subjects} 科` : 'message' in status ? status.message : '数据有误'}
                  </small>
                </span>
                <span className={`status-dot ${status.ok ? 'ok' : 'bad'}`} />
              </button>
            )
          })}
        </aside>

        {active ? (
          <section className="panel mapping-panel">
            <div className="panel-head compact">
              <h2>{active.label}</h2>
              <div className="row-gap">
                <span className="file-pill">{active.workbook.fileName}</span>
                <button
                  type="button"
                  className="btn tiny ghost"
                  onClick={() => props.onRemove(active.id)}
                  disabled={props.drafts.length <= 2}
                >
                  移除
                </button>
              </div>
            </div>

            <ExamFields draft={active} onUpdate={props.onUpdate} />

            <div className="preview-stat-line">
              {(() => {
                const status = props.status(active)
                return status.ok ? (
                  <span className="preview-stat ok">
                    识别到 {status.count} 名学生、{status.subjects} 个科目
                  </span>
                ) : (
                  <span className="preview-stat error">{"message" in status ? status.message : "数据有误"}</span>
                )
              })()}
            </div>
          </section>
        ) : null}
      </div>

      <section className="panel options-panel">
        <div className="panel-head compact">
          <h2>分析口径</h2>
          <span className="muted">影响名次与及格统计</span>
        </div>
        <div className="options-grid">
          <div className="field">
            <label>排名方式</label>
            <div className="segmented">
              <button
                type="button"
                className={props.options.rankMode === 'competition' ? 'active' : ''}
                onClick={() => props.onOptions({ ...props.options, rankMode: 'competition' })}
              >
                并列名次
              </button>
              <button
                type="button"
                className={props.options.rankMode === 'sequential' ? 'active' : ''}
                onClick={() => props.onOptions({ ...props.options, rankMode: 'sequential' })}
              >
                顺序名次
              </button>
            </div>
            <span className="field-hint">
              {props.options.rankMode === 'competition'
                ? '同分同名次，后续名次跳号（1、2、2、4）'
                : '同分按出现顺序编号，与原表排名更接近'}
            </span>
          </div>
          <div className="field">
            <label>分数段宽度</label>
            <select
              value={props.options.bucketSize}
              onChange={(event) =>
                props.onOptions({ ...props.options, bucketSize: Number(event.target.value) })
              }
            >
              {[20, 30, 40, 50, 60, 100].map((size) => (
                <option key={size} value={size}>
                  {size} 分一段
                </option>
              ))}
            </select>
            <span className="field-hint">用于首末场分数段对比</span>
          </div>
        </div>

        <div className="marks-editor">
          <div className="marks-head">
            <span>科目</span>
            <span>满分（可选）</span>
            <span>及格线（可选）</span>
          </div>
          {subjects.map((subject) => (
            <div className="marks-row" key={subject}>
              <span>{subject}</span>
              <input
                type="number"
                min={0}
                value={props.options.fullMarks[subject] ?? ''}
                placeholder="如 120"
                onChange={(event) => {
                  const next = { ...props.options.fullMarks }
                  if (event.target.value === '') delete next[subject]
                  else next[subject] = Number(event.target.value)
                  props.onOptions({ ...props.options, fullMarks: next })
                }}
              />
              <input
                type="number"
                min={0}
                value={props.options.passMarks[subject] ?? ''}
                placeholder="如 72"
                onChange={(event) => {
                  const next = { ...props.options.passMarks }
                  if (event.target.value === '') delete next[subject]
                  else next[subject] = Number(event.target.value)
                  props.onOptions({ ...props.options, passMarks: next })
                }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="panel template-panel">
        <div className="panel-head compact">
          <h2>字段模板</h2>
          <span className="muted">下次同类成绩单自动按表头匹配</span>
        </div>
        <div className="template-save">
          <input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="模板名称，如：24汽修月考模板"
          />
          <button
            type="button"
            className="btn"
            disabled={!templateName.trim()}
            onClick={() => {
              props.onSaveTemplate(templateName.trim())
              setTemplateName('')
            }}
          >
            保存当前字段
          </button>
          {props.templates.length > 0 ? (
            <select
              defaultValue=""
              onChange={(event) => {
                const template = props.templates.find((item) => item.id === event.target.value)
                if (template) props.onApplyTemplate(template)
                event.target.value = ''
              }}
            >
              <option value="">应用模板…</option>
              {props.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          ) : null}
          {props.templates.map((template) => (
            <button
              key={template.id}
              type="button"
              className="btn tiny ghost"
              onClick={() => props.onDeleteTemplate(template.id)}
            >
              删除「{template.name}」
            </button>
          ))}
        </div>
      </section>

      <div className="floating-actions">
        <span>
          共 {props.drafts.length} 份 ·{' '}
          {allOk ? '字段检查通过' : '还有未通过的字段，请检查左侧红色标记'}
        </span>
        <button type="button" className="btn primary" disabled={!allOk} onClick={props.onNext}>
          下一步：选择场次
        </button>
      </div>
    </div>
  )
}

function ExamFields({
  draft,
  onUpdate,
}: {
  draft: ExamDraft
  onUpdate: (id: string, patch: Partial<ExamDraft>) => void
}) {
  const header = draft.rows[draft.headerRow] ?? []
  const width = Math.max(...draft.rows.slice(0, 12).map((row) => row.length), header.length, 1)
  const headerOptions = Array.from({ length: width }, (_, index) => ({
    index,
    text:
      header[index] == null || String(header[index]).trim() === ''
        ? `第 ${index + 1} 列`
        : String(header[index]),
  }))
  const numericCols = new Set<number>()
  for (let col = 0; col < width; col += 1) {
    const hit = draft.rows.slice(draft.headerRow + 1, draft.headerRow + 9).some((row) => {
      const value = row[col]
      if (typeof value === 'number') return Number.isFinite(value)
      if (typeof value !== 'string' || value.trim() === '') return false
      return !Number.isNaN(Number(value))
    })
    if (hit) numericCols.add(col)
  }
  const subjectOptions = headerOptions.filter(
    (item) =>
      numericCols.has(item.index) &&
      item.index !== draft.config.nameCol &&
      item.index !== draft.config.totalCol &&
      item.index !== draft.config.rankCol,
  )
  const selected = new Set(draft.config.subjectCols.map((item) => item.col))

  const patchConfig = (config: ExamConfig) => onUpdate(draft.id, { config })

  const toggleSubject = (col: number) => {
    const exists = draft.config.subjectCols.find((item) => item.col === col)
    const subjectCols = exists
      ? draft.config.subjectCols.filter((item) => item.col !== col)
      : [...draft.config.subjectCols, { name: headerOptions[col].text, col }].sort(
          (a, b) => a.col - b.col,
        )
    patchConfig({ ...draft.config, subjectCols })
  }

  const changeSheet = (index: number) => {
    const rows = draft.workbook.sheets[index]?.rows ?? []
    const headerRow = detectHeaderRow(rows)
    onUpdate(draft.id, { sheetIndex: index, rows, headerRow, config: guessConfig(rows, headerRow) })
  }

  const changeHeader = (row: number) => {
    onUpdate(draft.id, { headerRow: row, config: guessConfig(draft.rows, row) })
  }

  const previewRows = draft.rows.slice(draft.headerRow, draft.headerRow + 4)
  const previewCols = Math.min(width, 10)

  return (
    <>
      <div className="mapping-fields">
        <div className="field">
          <label>考试名称</label>
          <input value={draft.label} onChange={(event) => onUpdate(draft.id, { label: event.target.value })} />
        </div>
        <div className="field">
          <label>工作表</label>
          <select value={draft.sheetIndex} onChange={(event) => changeSheet(Number(event.target.value))}>
            {draft.workbook.sheets.map((sheet, index) => (
              <option key={`${sheet.name}-${index}`} value={index}>
                {sheet.name}（{sheet.rows.length} 行）
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>表头所在行</label>
          <select value={draft.headerRow} onChange={(event) => changeHeader(Number(event.target.value))}>
            {draft.rows.slice(0, 12).map((row, index) => {
              const label = row
                .slice(0, 6)
                .map((cell) => (cell == null ? '' : String(cell).trim()))
                .filter(Boolean)
                .join('、')
                .slice(0, 24)
              return (
                <option key={index} value={index}>
                  第 {index + 1} 行：{label || '空行'}
                </option>
              )
            })}
          </select>
        </div>
        <div className="field">
          <label>姓名列</label>
          <select
            value={draft.config.nameCol}
            onChange={(event) => patchConfig({ ...draft.config, nameCol: Number(event.target.value) })}
          >
            {headerOptions.map((item) => (
              <option key={item.index} value={item.index}>
                {item.text}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>总分列</label>
          <select
            value={draft.config.totalCol ?? ''}
            onChange={(event) =>
              patchConfig({
                ...draft.config,
                totalCol: event.target.value === '' ? null : Number(event.target.value),
              })
            }
          >
            <option value="">按科目求和</option>
            {headerOptions.map((item) => (
              <option key={item.index} value={item.index}>
                {item.text}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>原表排名列（可选）</label>
          <select
            value={draft.config.rankCol ?? ''}
            onChange={(event) =>
              patchConfig({
                ...draft.config,
                rankCol: event.target.value === '' ? null : Number(event.target.value),
              })
            }
          >
            <option value="">不使用</option>
            {headerOptions.map((item) => (
              <option key={item.index} value={item.index}>
                {item.text}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="subject-picker">
        <label>科目列（勾选参与统计的列）</label>
        <div className="chip-list">
          {subjectOptions.map((item) => {
            const active = selected.has(item.index)
            return (
              <button
                type="button"
                key={item.index}
                className={`chip ${active ? 'active' : ''}`}
                onClick={() => toggleSubject(item.index)}
              >
                {active ? '✓ ' : ''}
                {item.text}
              </button>
            )
          })}
        </div>
      </div>

      <div className="preview-block">
        <table>
          <tbody>
            {previewRows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex === 0 ? 'preview-head' : ''}>
                {Array.from({ length: previewCols }, (_, colIndex) => (
                  <td
                    key={colIndex}
                    className={
                      colIndex === draft.config.nameCol
                        ? 'col-name'
                        : selected.has(colIndex)
                          ? 'col-subject'
                          : ''
                    }
                  >
                    {row[colIndex] == null ? '' : String(row[colIndex])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}


