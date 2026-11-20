import { useMemo, useState } from 'react'
import type { AnalysisOptions, ExamConfig, ExamDraft, ExamRole, Template } from '../types'
import { buildExam } from '../lib/parse'

interface MappingStageProps {
  base: ExamDraft
  target: ExamDraft
  options: AnalysisOptions
  templates: Template[]
  error: string
  onConfig: (role: ExamRole, config: ExamConfig) => void
  onLabel: (role: ExamRole, label: string) => void
  onSheet: (role: ExamRole, index: number) => void
  onHeader: (role: ExamRole, row: number) => void
  onOptions: (options: AnalysisOptions) => void
  onBack: () => void
  onRun: () => void
  onSaveTemplate: (name: string) => void
  onApplyTemplate: (template: Template) => void
}

export function MappingStage(props: MappingStageProps) {
  const { base, target, options } = props
  const [templateName, setTemplateName] = useState('')

  const subjects = useMemo(() => {
    const list: string[] = []
    for (const draft of [base, target]) {
      for (const item of draft.config.subjectCols) {
        const name = item.name.trim()
        if (name && !list.includes(name)) list.push(name)
      }
    }
    return list
  }, [base, target])

  const runPreview = (draft: ExamDraft) => {
    try {
      const exam = buildExam({
        role: draft.role,
        label: draft.label,
        fileName: draft.workbook.fileName,
        sheetName: draft.workbook.sheets[draft.sheetIndex]?.name ?? '',
        rows: draft.rows,
        config: draft.config,
      })
      return { ok: true as const, exam }
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : String(err) }
    }
  }

  const basePreview = runPreview(base)
  const targetPreview = runPreview(target)
  const canRun = basePreview.ok && targetPreview.ok && basePreview.exam.subjects.length > 0

  return (
    <div className="stage mapping-stage">
      <div className="stage-head">
        <div>
          <p className="eyebrow">第 2 步 / 共 3 步</p>
          <h1>确认两份成绩单的字段</h1>
          <p className="stage-sub">
            系统已自动识别，若有偏差请手动调整。姓名按“姓名列”匹配，缺考/转班学生会单独标注。
          </p>
        </div>
        <div className="stage-actions">
          <button type="button" className="btn ghost" onClick={props.onBack}>
            返回上传
          </button>
          <button type="button" className="btn primary" disabled={!canRun} onClick={props.onRun}>
            开始分析
          </button>
        </div>
      </div>

      {props.error ? <div className="alert error">{props.error}</div> : null}

      <div className="mapping-grid">
        <MappingPanel
          draft={base}
          preview={basePreview}
          onConfig={props.onConfig}
          onLabel={props.onLabel}
          onSheet={props.onSheet}
          onHeader={props.onHeader}
          role="base"
        />
        <MappingPanel
          draft={target}
          preview={targetPreview}
          onConfig={props.onConfig}
          onLabel={props.onLabel}
          onSheet={props.onSheet}
          onHeader={props.onHeader}
          role="target"
        />
      </div>

      <section className="panel options-panel">
        <div className="panel-head">
          <h2>分析口径</h2>
          <p>影响名次与及格统计，可按学校习惯调整</p>
        </div>
        <div className="options-grid">
          <div className="field">
            <label>排名方式</label>
            <div className="segmented">
              <button
                type="button"
                className={options.rankMode === 'competition' ? 'active' : ''}
                onClick={() => props.onOptions({ ...options, rankMode: 'competition' })}
              >
                并列名次
              </button>
              <button
                type="button"
                className={options.rankMode === 'sequential' ? 'active' : ''}
                onClick={() => props.onOptions({ ...options, rankMode: 'sequential' })}
              >
                顺序名次
              </button>
            </div>
            <span className="field-hint">
              {options.rankMode === 'competition'
                ? '同分同名次，后续名次跳号（如 1、2、2、4）'
                : '同分按出现顺序编号（1、2、3、4），与原表排名更接近'}
            </span>
          </div>
          <div className="field">
            <label>分数段宽度</label>
            <select
              value={options.bucketSize}
              onChange={(event) => props.onOptions({ ...options, bucketSize: Number(event.target.value) })}
            >
              {[20, 30, 40, 50, 60, 100].map((size) => (
                <option key={size} value={size}>
                  {size} 分一段
                </option>
              ))}
            </select>
            <span className="field-hint">用于“分数段分布”图表与统计</span>
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
                value={options.fullMarks[subject] ?? ''}
                placeholder="如 120"
                onChange={(event) => {
                  const next = { ...options.fullMarks }
                  const value = event.target.value
                  if (value === '') delete next[subject]
                  else next[subject] = Number(value)
                  props.onOptions({ ...options, fullMarks: next })
                }}
              />
              <input
                type="number"
                min={0}
                value={options.passMarks[subject] ?? ''}
                placeholder="如 72"
                onChange={(event) => {
                  const next = { ...options.passMarks }
                  const value = event.target.value
                  if (value === '') delete next[subject]
                  else next[subject] = Number(value)
                  props.onOptions({ ...options, passMarks: next })
                }}
              />
            </div>
          ))}
          {subjects.length === 0 ? <p className="muted">请先在上方勾选科目</p> : null}
          <p className="muted small">
            不填也能分析；填写后会在“科目统计”里给出及格人数，并用于图表刻度提示。
          </p>
        </div>
      </section>

      <section className="panel template-panel">
        <div className="panel-head">
          <h2>保存为模板</h2>
          <p>下次上传同类成绩单时，自动按表头名称匹配列</p>
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
            保存模板
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
              <option value="">应用已有模板…</option>
              {props.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </section>

      <div className="floating-actions">
        <span>
          {basePreview.ok
            ? `基准：${basePreview.exam.students.length} 人 / ${basePreview.exam.subjects.length} 科`
            : '基准数据有误'}
          {'  ·  '}
          {targetPreview.ok
            ? `对比：${targetPreview.exam.students.length} 人 / ${targetPreview.exam.subjects.length} 科`
            : '对比数据有误'}
        </span>
        <button type="button" className="btn primary" disabled={!canRun} onClick={props.onRun}>
          开始分析
        </button>
      </div>
    </div>
  )
}

interface MappingPanelProps {
  draft: ExamDraft
  role: ExamRole
  preview: { ok: true; exam: ReturnType<typeof buildExam> } | { ok: false; message: string }
  onConfig: (role: ExamRole, config: ExamConfig) => void
  onLabel: (role: ExamRole, label: string) => void
  onSheet: (role: ExamRole, index: number) => void
  onHeader: (role: ExamRole, row: number) => void
}

function MappingPanel({ draft, role, preview, onConfig, onLabel, onSheet, onHeader }: MappingPanelProps) {
  const sheet = draft.workbook.sheets[draft.sheetIndex]
  const header = draft.rows[draft.headerRow] ?? []
  const width = Math.max(...draft.rows.slice(0, 12).map((row) => row.length), header.length, 1)
  const headerOptions = Array.from({ length: width }, (_, index) => ({
    index,
    text: header[index] == null || String(header[index]).trim() === '' ? `第 ${index + 1} 列` : String(header[index]),
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
  const selectedCols = new Set(draft.config.subjectCols.map((item) => item.col))

  const toggleSubject = (col: number) => {
    const exists = draft.config.subjectCols.find((item) => item.col === col)
    const subjectCols = exists
      ? draft.config.subjectCols.filter((item) => item.col !== col)
      : [...draft.config.subjectCols, { name: headerOptions[col].text, col }].sort((a, b) => a.col - b.col)
    onConfig(role, { ...draft.config, subjectCols })
  }

  const previewRows = draft.rows.slice(draft.headerRow, draft.headerRow + 4)
  const previewCols = Math.min(width, 9)

  return (
    <section className={`panel mapping-panel ${role}`}>
      <div className="panel-head compact">
        <h2>{role === 'base' ? '基准考试' : '对比考试'}</h2>
        <span className="file-pill">{draft.workbook.fileName}</span>
      </div>

      <div className="mapping-fields">
        <div className="field">
          <label>考试名称</label>
          <input value={draft.label} onChange={(event) => onLabel(role, event.target.value)} />
        </div>
        <div className="field">
          <label>工作表</label>
          <select
            value={draft.sheetIndex}
            onChange={(event) => onSheet(role, Number(event.target.value))}
          >
            {draft.workbook.sheets.map((item, index) => (
              <option key={`${item.name}-${index}`} value={index}>
                {item.name}（{item.rows.length} 行）
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>表头所在行</label>
          <select value={draft.headerRow} onChange={(event) => onHeader(role, Number(event.target.value))}>
            {draft.rows.slice(0, 12).map((row, index) => {
              const label = row
                .slice(0, 6)
                .map((cell) => (cell == null ? '' : String(cell).trim()))
                .filter(Boolean)
                .join('、')
                .slice(0, 26)
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
            onChange={(event) => onConfig(role, { ...draft.config, nameCol: Number(event.target.value) })}
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
              onConfig(role, {
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
              onConfig(role, {
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
            const active = selectedCols.has(item.index)
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
                        : selectedCols.has(colIndex)
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
        <p className="mini-preview-note">工作表：{sheet?.name ?? '—'}</p>
      </div>

      {preview.ok ? (
        <div className="preview-stat ok">
          识别到 <strong>{preview.exam.students.length}</strong> 名学生、
          <strong>{preview.exam.subjects.length}</strong> 个科目
          {preview.exam.warnings.length ? `，${preview.exam.warnings.length} 条提醒` : ''}
        </div>
      ) : (
        <div className="preview-stat error">{"message" in preview ? preview.message : "数据有误"}</div>
      )}
    </section>
  )
}


