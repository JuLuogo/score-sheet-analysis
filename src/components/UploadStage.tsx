import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import type { ExamDraft, HistoryItem } from '../types'

interface UploadStageProps {
  drafts: ExamDraft[]
  busy: boolean
  history: HistoryItem[]
  error: string
  onFiles: (files: File[]) => void
  onDemo: () => void
  onRemove: (id: string) => void
  onRemoveHistory: (id: string) => void
  onRestoreHistory: (item: HistoryItem) => void
  onNext: () => void
}

export function UploadStage(props: UploadStageProps) {
  const { drafts } = props
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    const files = Array.from(event.dataTransfer.files).filter((file) =>
      /\.(xlsx|xlsm|csv)$/i.test(file.name),
    )
    if (files.length) props.onFiles(files)
  }

  return (
    <div className="stage upload-stage">
      <div className="upload-head">
        <div>
          <h1>上传成绩单</h1>
          <p>至少 2 份，可一次多选。支持 .xlsx / .xlsm / .csv，上传后再选择对比场次。</p>
        </div>
        <button type="button" className="link-btn" onClick={props.onDemo}>
          没有文件？看示例
        </button>
      </div>

      {props.error ? <div className="alert error">{props.error}</div> : null}

      <div
        className={`dropzone big ${dragging ? 'dragging' : ''}`}
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
          multiple
          accept=".xlsx,.xlsm,.csv"
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            if (files.length) props.onFiles(files)
            event.target.value = ''
          }}
        />
        <span className="dropzone-icon">＋</span>
        <span className="dropzone-text">
          {props.busy ? '正在解析…' : '拖拽成绩单到这里，或点击选择（可多选）'}
        </span>
        <span className="dropzone-sub">第一次月考、第二次月考、期中考试…都能一起传</span>
      </div>

      {drafts.length > 0 ? (
        <div className="upload-list">
          {drafts.map((draft, index) => (
            <div className="upload-item" key={draft.id}>
              <span className="upload-index">{index + 1}</span>
              <div className="upload-main">
                <strong>{draft.label}</strong>
                <span>
                  {draft.workbook.fileName} · {draft.rows.length} 行 ·{' '}
                  {draft.config.subjectCols.length} 个科目
                </span>
              </div>
              <button type="button" className="btn tiny ghost" onClick={() => props.onRemove(draft.id)}>
                移除
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="upload-actions">
        <span className="muted">
          {drafts.length ? `已添加 ${drafts.length} 份，至少需要 2 份` : '尚未添加文件'}
        </span>
        <button type="button" className="btn primary" disabled={drafts.length < 2} onClick={props.onNext}>
          下一步：确认字段
        </button>
      </div>

      {props.history.length > 0 ? (
        <section className="panel history-panel">
          <div className="panel-head compact">
            <h2>最近分析</h2>
            <span className="muted">保存在本机，可恢复</span>
          </div>
          <div className="history-list">
            {props.history.map((item) => (
              <div className="history-item" key={item.id}>
                <div className="history-main">
                  <strong>{item.title}</strong>
                  <span>
                    {item.labels.join(' → ')} · {new Date(item.createdAt).toLocaleString('zh-CN')}
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
    </div>
  )
}
