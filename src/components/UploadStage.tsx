import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { ExamDraft, ExamRole, HistoryItem, Template } from '../types'

interface UploadStageProps {
  base: ExamDraft | null
  target: ExamDraft | null
  templates: Template[]
  history: HistoryItem[]
  busyRole: ExamRole | null
  error: string
  onFile: (role: ExamRole, file: File) => void
  onDemo: () => void
  onNext: () => void
  onRestoreHistory: (item: HistoryItem) => void
  onRemoveHistory: (id: string) => void
  onApplyTemplate: (template: Template) => void
  onDeleteTemplate: (id: string) => void
}

export function UploadStage(props: UploadStageProps) {
  const { base, target, templates, history, busyRole, error } = props
  return (
    <div className="stage upload-stage">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">成绩对比分析系统</p>
          <h1>
            把两次考试，
            <br />
            变成一张看得懂的对比表
          </h1>
          <p className="hero-sub">
            上传基准考试（如月考）和对比考试（如期中）的成绩单，自动计算每个学生、每个科目的
            <strong>名次升降</strong>与<strong>分数变化</strong>，并导出可直接发给家长/老师的 Excel。
          </p>
          <div className="hero-actions">
            <button type="button" className="btn primary" onClick={props.onDemo}>
              先看示例数据
            </button>
            <button type="button" className="btn ghost" disabled={!base || !target} onClick={props.onNext}>
              下一步：确认字段
            </button>
          </div>
          <ul className="hero-points">
            <li>所有计算在本机浏览器完成，成绩不上传服务器</li>
            <li>支持 .xlsx / .xlsm / .csv，任意科目数量</li>
            <li>可保存为模板，下次换班级、换考试直接复用</li>
          </ul>
        </div>
        <div className="hero-panel">
          <div className="hero-panel-title">一次配置，反复使用</div>
          <ol className="hero-steps">
            <li>
              <span>1</span> 上传两份成绩单
            </li>
            <li>
              <span>2</span> 确认姓名 / 科目 / 总分列
            </li>
            <li>
              <span>3</span> 查看分析、导出 Excel
            </li>
          </ol>
          {templates.length > 0 ? (
            <div className="template-quick">
              <div className="template-quick-title">已保存的模板</div>
              {templates.slice(0, 3).map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="link-btn"
                  onClick={() => props.onApplyTemplate(template)}
                >
                  {template.name}
                  <span>{template.subjects.length} 科</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {error ? <div className="alert error">{error}</div> : null}

      <div className="upload-grid">
        <ExamCard
          role="base"
          title="基准考试"
          hint="例如：上次月考"
          draft={base}
          busy={busyRole === 'base'}
          onFile={props.onFile}
        />
        <ExamCard
          role="target"
          title="对比考试"
          hint="例如：本次期中"
          draft={target}
          busy={busyRole === 'target'}
          onFile={props.onFile}
        />
      </div>

      <section className="feature-grid">
        <div className="feature">
          <span className="feature-icon">识</span>
          <h3>自动识别表格</h3>
          <p>自动找表头、姓名列、科目列与总分列；识别不准可手动改，支持任意科目数量。</p>
        </div>
        <div className="feature">
          <span className="feature-icon">排</span>
          <h3>名次与分数双口径</h3>
          <p>每个学生、每个科目都给出基准排名、对比排名、名次变化与分数变化，缺考单独标注。</p>
        </div>
        <div className="feature">
          <span className="feature-icon">表</span>
          <h3>导出即可用</h3>
          <p>一键生成多工作表 Excel：总览、总分、各科分表、科目统计与说明页，带颜色标记。</p>
        </div>
        <div className="feature">
          <span className="feature-icon">复</span>
          <h3>模板与历史</h3>
          <p>保存字段模板，下次换班级、换考试直接套用；最近分析存本机，随时恢复。</p>
        </div>
      </section>

      {history.length > 0 ? (
        <section className="panel history-panel">
          <div className="panel-head">
            <h2>最近分析</h2>
            <p>保存在本机浏览器，可一键恢复（最多 6 条）</p>
          </div>
          <div className="history-list">
            {history.map((item) => (
              <div className="history-item" key={item.id}>
                <div className="history-main">
                  <strong>{item.title}</strong>
                  <span>
                    {new Date(item.createdAt).toLocaleString('zh-CN')} · 可比 {item.counts.comparable} 人
                  </span>
                </div>
                <div className="history-actions">
                  <button type="button" className="btn tiny" onClick={() => props.onRestoreHistory(item)}>
                    恢复
                  </button>
                  <button
                    type="button"
                    className="btn tiny ghost"
                    onClick={() => props.onRemoveHistory(item.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {templates.length > 0 ? (
        <section className="panel">
          <div className="panel-head">
            <h2>字段模板</h2>
            <p>换班级 / 换考试时，自动按表头名称匹配列</p>
          </div>
          <div className="template-list">
            {templates.map((template) => (
              <div className="template-item" key={template.id}>
                <div>
                  <strong>{template.name}</strong>
                  <span>
                    科目：{template.subjects.join('、') || '—'}
                  </span>
                </div>
                <div className="template-actions">
                  <button type="button" className="btn tiny" onClick={() => props.onApplyTemplate(template)}>
                    应用
                  </button>
                  <button
                    type="button"
                    className="btn tiny ghost"
                    onClick={() => props.onDeleteTemplate(template.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

interface ExamCardProps {
  role: ExamRole
  title: string
  hint: string
  draft: ExamDraft | null
  busy: boolean
  onFile: (role: ExamRole, file: File) => void
}

function ExamCard({ role, title, hint, draft, busy, onFile }: ExamCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) onFile(role, file)
  }

  return (
    <div className={`exam-card ${draft ? 'has-file' : ''}`}>
      <div className="exam-card-head">
        <div>
          <h2>{title}</h2>
          <p>{hint}</p>
        </div>
        {draft ? <span className="badge ok">已读取</span> : <span className="badge">待上传</span>}
      </div>

      <div
        className={`dropzone ${dragging ? 'dragging' : ''}`}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click()
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.csv"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onFile(role, file)
            event.target.value = ''
          }}
        />
        {busy ? (
          <span className="dropzone-text">正在解析…</span>
        ) : draft ? (
          <>
            <span className="file-name">{draft.workbook.fileName}</span>
            <span className="dropzone-text">
              {draft.workbook.sheets.length} 个工作表 · {draft.rows.length} 行 · 点击重新选择
            </span>
          </>
        ) : (
          <>
            <span className="dropzone-icon">＋</span>
            <span className="dropzone-text">拖拽文件到这里，或点击选择</span>
            <span className="dropzone-sub">支持 .xlsx / .xlsm / .csv</span>
          </>
        )}
      </div>

      {draft ? <PreviewTable draft={draft} /> : null}
    </div>
  )
}

function PreviewTable({ draft }: { draft: ExamDraft }) {
  const rows = draft.rows.slice(draft.headerRow, draft.headerRow + 5)
  const width = Math.max(...rows.map((row) => row.length), 1)
  const columns = Math.min(width, 9)
  return (
    <div className="mini-preview">
      <table>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className={rowIndex === 0 ? 'preview-head' : ''}>
              {Array.from({ length: columns }, (_, colIndex) => (
                <td key={colIndex}>{row[colIndex] == null ? '' : String(row[colIndex])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mini-preview-note">
        已自动识别表头在第 {draft.headerRow + 1} 行、姓名列、{draft.config.subjectCols.length} 个科目列
      </p>
    </div>
  )
}
