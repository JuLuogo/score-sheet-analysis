import type { ExamDraft, ExportSelection } from '../types'

interface SelectStageProps {
  drafts: ExamDraft[]
  selectedIds: string[]
  selection: ExportSelection
  error: string
  onToggle: (id: string) => void
  onMove: (id: string, delta: number) => void
  onSelection: (selection: ExportSelection) => void
  onBack: () => void
  onRun: () => void
}

const EXPORT_ITEMS: { key: keyof ExportSelection; label: string; desc: string }[] = [
  { key: 'summary', label: '汇总总览', desc: '一人一行，含各场总分、排名与名次变化' },
  { key: 'total', label: '总分明细', desc: '总分矩阵 + 分数变化 + 排名变化' },
  { key: 'subjects', label: '各科分表', desc: '每个科目一张表，横向列出各场分数' },
  { key: 'stats', label: '科目统计', desc: '首末场均分、最高最低、名次升降人数' },
  { key: 'notes', label: '说明页', desc: '口径、场次、数据提醒' },
]

export function SelectStage(props: SelectStageProps) {
  const selected = props.selectedIds
    .map((id) => props.drafts.find((draft) => draft.id === id))
    .filter((draft): draft is ExamDraft => Boolean(draft))
  const rest = props.drafts.filter((draft) => !props.selectedIds.includes(draft.id))

  return (
    <div className="stage select-stage">
      <div className="stage-head">
        <div>
          <p className="eyebrow">第 3 步 / 共 4 步</p>
          <h1>选择对比场次与导出内容</h1>
          <p className="stage-sub">
            勾选的场次会横向排开；第一场自动作为基准，名次与分数变化按“第一场 → 最后一场”计算。
          </p>
        </div>
        <div className="stage-actions">
          <button type="button" className="btn ghost" onClick={props.onBack}>
            返回字段
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={selected.length < 2 || !Object.values(props.selection).some(Boolean)}
            onClick={props.onRun}
          >
            开始分析
          </button>
        </div>
      </div>

      {props.error ? <div className="alert error">{props.error}</div> : null}

      <div className="select-layout">
        <section className="panel">
          <div className="panel-head compact">
            <h2>参与对比的考试（{selected.length}）</h2>
            <span className="muted">顺序即展示顺序，第一场为基准</span>
          </div>
          <div className="compare-list">
            {selected.map((draft, index) => (
              <div className="compare-item" key={draft.id}>
                <input type="checkbox" checked readOnly onClick={() => props.onToggle(draft.id)} />
                <span className={`compare-order ${index === 0 ? 'baseline' : ''}`}>
                  {index === 0 ? '基准' : index + 1}
                </span>
                <div className="compare-main">
                  <strong>{draft.label}</strong>
                  <span>{draft.workbook.fileName}</span>
                </div>
                <div className="compare-actions">
                  <button
                    type="button"
                    className="btn tiny ghost"
                    disabled={index === 0}
                    onClick={() => props.onMove(draft.id, -1)}
                    aria-label="上移"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn tiny ghost"
                    disabled={index === selected.length - 1}
                    onClick={() => props.onMove(draft.id, 1)}
                    aria-label="下移"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
            {selected.length < 2 ? <p className="muted">至少勾选 2 场</p> : null}
          </div>

          {rest.length > 0 ? (
            <>
              <div className="panel-head compact sub-head">
                <h2>未参与</h2>
              </div>
              <div className="compare-list">
                {rest.map((draft) => (
                  <div className="compare-item muted-item" key={draft.id}>
                    <input type="checkbox" checked={false} onChange={() => props.onToggle(draft.id)} />
                    <span className="compare-order">—</span>
                    <div className="compare-main">
                      <strong>{draft.label}</strong>
                      <span>{draft.workbook.fileName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className="panel">
          <div className="panel-head compact">
            <h2>导出哪些表</h2>
            <span className="muted">只导出勾选的工作表</span>
          </div>
          <div className="export-list">
            {EXPORT_ITEMS.map((item) => (
              <label className="export-item" key={item.key}>
                <input
                  type="checkbox"
                  checked={props.selection[item.key]}
                  onChange={(event) =>
                    props.onSelection({ ...props.selection, [item.key]: event.target.checked })
                  }
                />
                <span className="export-main">
                  <strong>{item.label}</strong>
                  <small>{item.desc}</small>
                </span>
              </label>
            ))}
          </div>
          <p className="muted small">
            结果页仍可随时修改导出项；CSV 固定导出“汇总总览”。
          </p>
        </section>
      </div>

      <div className="floating-actions">
        <span>
          {selected.length} 场：
          {selected.map((draft, index) => (index === 0 ? `${draft.label}（基准）` : draft.label)).join(' → ')}
        </span>
        <button
          type="button"
          className="btn primary"
          disabled={selected.length < 2 || !Object.values(props.selection).some(Boolean)}
          onClick={props.onRun}
        >
          开始分析
        </button>
      </div>
    </div>
  )
}
