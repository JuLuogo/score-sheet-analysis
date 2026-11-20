import { useMemo, useState } from 'react'
import type { ExportSelection, SeriesAnalysis, SeriesStudent } from '../types'
import { DataTable } from './DataTable'
import type { Column } from './DataTable'
import { Chart } from './Chart'
import { CHART_COLORS, CHART_FONT } from '../lib/echarts'
import { deltaTone, deltaWord, fmtDelta, fmtRankDelta, fmtScore } from '../lib/format'

type TabKey = 'overview' | 'summary' | 'subject' | 'notes'
type TableRow = SeriesStudent & { index: number }

const EXPORT_ITEMS: { key: keyof ExportSelection; label: string }[] = [
  { key: 'summary', label: '汇总总览' },
  { key: 'total', label: '总分明细' },
  { key: 'subjects', label: '各科分表' },
  { key: 'stats', label: '科目统计' },
  { key: 'notes', label: '说明页' },
]

interface ResultStageProps {
  result: SeriesAnalysis
  className: string
  selection: ExportSelection
  exporting: boolean
  saved: boolean
  onClassName: (value: string) => void
  onSelection: (selection: ExportSelection) => void
  onExportXlsx: () => void
  onExportCsv: () => void
  onSaveHistory: () => void
  onBackSelect: () => void
  onReset: () => void
}

export function ResultStage(props: ResultStageProps) {
  const { result } = props
  const [tab, setTab] = useState<TabKey>(() => {
    const value = new URLSearchParams(window.location.search).get('tab')
    return value === 'summary' || value === 'subject' || value === 'notes' ? value : 'overview'
  })
  const [subject, setSubject] = useState(result.subjects[0] ?? '')

  const first = result.labels[0]
  const last = result.labels[result.labels.length - 1]

  const avgOption = useMemo(
    () => ({
      color: ['#1f3864', '#2f5597', '#70ad47', '#c55a11', '#8ea9db', '#a5a5a5', '#c0504d'],
      textStyle: CHART_FONT,
      tooltip: { trigger: 'axis' },
      legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
      grid: { left: 42, right: 16, top: 44, bottom: 30 },
      xAxis: {
        type: 'category',
        data: result.labels,
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#d9dee7' } },
        axisLabel: { color: '#595959' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#eef1f6' } },
        axisLabel: { color: '#8c8c8c' },
      },
      series: result.subjects.map((item) => ({
        name: item,
        type: 'line',
        smooth: true,
        symbolSize: 6,
        data: result.examStats.map((stat) => stat.subjectAvg[item]),
        label: { show: false },
      })),
    }),
    [result],
  )

  const rankOption = useMemo(() => {
    const labels = [...result.subjects, '总分']
    const stats = [...result.stats, result.totalStat]
    return {
      color: [CHART_COLORS.up, CHART_COLORS.flat, CHART_COLORS.down],
      textStyle: CHART_FONT,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
      grid: { left: 42, right: 16, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#d9dee7' } },
        axisLabel: { color: '#595959' },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#eef1f6' } },
        axisLabel: { color: '#8c8c8c' },
      },
      series: [
        {
          name: '名次上升',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 32,
          data: stats.map((item) => item.up),
          label: { show: true, fontSize: 10, color: '#fff' },
        },
        {
          name: '持平',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 32,
          data: stats.map((item) => item.flat),
          label: { show: true, fontSize: 10, color: '#595959' },
        },
        {
          name: '名次下降',
          type: 'bar',
          stack: 'total',
          barMaxWidth: 32,
          data: stats.map((item) => item.down),
          label: { show: true, fontSize: 10, color: '#fff' },
        },
      ],
    }
  }, [result])

  const bucketOption = useMemo(
    () => ({
      color: [CHART_COLORS.base, CHART_COLORS.target],
      textStyle: CHART_FONT,
      tooltip: { trigger: 'axis' },
      legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
      grid: { left: 42, right: 16, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: result.buckets.map((bucket) => bucket.label),
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#d9dee7' } },
        axisLabel: { color: '#595959', fontSize: 10 },
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#eef1f6' } },
        axisLabel: { color: '#8c8c8c' },
      },
      series: [
        {
          name: first,
          type: 'bar',
          barMaxWidth: 24,
          data: result.buckets.map((bucket) => bucket.first),
          label: { show: true, position: 'top', fontSize: 10, color: '#6b7280' },
        },
        {
          name: last,
          type: 'bar',
          barMaxWidth: 24,
          data: result.buckets.map((bucket) => bucket.last),
          label: { show: true, position: 'top', fontSize: 10, color: '#1f3864' },
        },
      ],
    }),
    [result, first, last],
  )

  const upTop = useMemo(
    () =>
      [...result.students]
        .filter((student) => student.totalRankDelta != null)
        .sort((a, b) => (b.totalRankDelta ?? 0) - (a.totalRankDelta ?? 0))
        .slice(0, 5),
    [result],
  )
  const downTop = useMemo(
    () =>
      [...result.students]
        .filter((student) => student.totalRankDelta != null)
        .sort((a, b) => (a.totalRankDelta ?? 0) - (b.totalRankDelta ?? 0))
        .slice(0, 5),
    [result],
  )

  const currentStat = result.stats.find((item) => item.subject === subject) ?? result.stats[0]

  return (
    <div className="stage result-stage">
      <div className="result-head no-print">
        <div>
          <p className="eyebrow">第 4 步 / 共 4 步</p>
          <div className="result-title-row">
            <input
              className="class-name-input"
              value={props.className}
              onChange={(event) => props.onClassName(event.target.value)}
              aria-label="班级名称"
            />
            <span className="result-sub">
              {result.labels.join(' → ')} · 全程参考 {result.counts.comparableAll} 人
            </span>
          </div>
        </div>
        <div className="result-actions">
          <button type="button" className="btn ghost" onClick={props.onBackSelect}>
            返回场次
          </button>
          <details className="export-menu">
            <summary className="btn ghost">导出内容（{Object.values(props.selection).filter(Boolean).length}/5）</summary>
            <div className="export-menu-panel">
              {EXPORT_ITEMS.map((item) => (
                <label key={item.key}>
                  <input
                    type="checkbox"
                    checked={props.selection[item.key]}
                    onChange={(event) =>
                      props.onSelection({ ...props.selection, [item.key]: event.target.checked })
                    }
                  />
                  {item.label}
                </label>
              ))}
            </div>
          </details>
          <button type="button" className="btn ghost" onClick={props.onExportCsv} disabled={props.exporting}>
            CSV
          </button>
          <button type="button" className="btn" onClick={props.onSaveHistory} disabled={props.saved}>
            {props.saved ? '已存本机' : '存本机'}
          </button>
          <button type="button" className="btn primary" onClick={props.onExportXlsx} disabled={props.exporting}>
            {props.exporting ? '生成中…' : '导出 Excel'}
          </button>
          <button type="button" className="btn ghost" onClick={() => window.print()}>
            打印
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi label="考试场次" value={`${result.labels.length} 场`} sub={result.labels.join(' / ')} />
        <Kpi
          label="总分均分"
          value={fmtScore(result.totalStat.lastAvg)}
          sub={`${first} ${fmtScore(result.totalStat.firstAvg)} · ${fmtDelta(result.totalStat.avgDelta)}`}
          tone={deltaTone(result.totalStat.avgDelta)}
        />
        <Kpi
          label="最高分"
          value={fmtScore(result.totalStat.lastMax)}
          sub={`${first} ${fmtScore(result.totalStat.firstMax)}`}
        />
        <Kpi
          label="总分名次"
          value={`↑${result.counts.totalUp} / ↓${result.counts.totalDown}`}
          sub={`持平 ${result.counts.totalFlat} 人（${first}→${last}）`}
        />
        <Kpi
          label="单科名次变化"
          value={`↑${result.counts.subjectUp} / ↓${result.counts.subjectDown}`}
          sub={`${result.students.length} 人 × ${result.subjects.length} 科`}
        />
        <Kpi
          label="全程参考"
          value={`${result.counts.comparableAll} 人`}
          sub={`仅首场 ${result.counts.firstOnly} · 仅末场 ${result.counts.lastOnly}`}
        />
      </div>

      <div className="tabs no-print">
        {(
          [
            ['overview', '总览'],
            ['summary', '汇总矩阵'],
            ['subject', '单科矩阵'],
            ['notes', '数据说明'],
          ] as [TabKey, string][]
        ).map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {label}
            {key === 'notes' && result.warnings.length ? <span className="tab-dot">{result.warnings.length}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'overview' ? (
        <div className="tab-panel">
          <div className="insight-row">
            <Insight
              title="增分最多"
              text={
                maxBy(result.stats, (item) => item.avgDelta ?? -999)?.subject
                  ? `${maxBy(result.stats, (item) => item.avgDelta ?? -999)?.subject} ${fmtDelta(
                      maxBy(result.stats, (item) => item.avgDelta ?? -999)?.avgDelta ?? null,
                    )}`
                  : '—'
              }
            />
            <Insight
              title="下滑最多"
              text={
                minBy(result.stats, (item) => item.avgDelta ?? 999)?.subject
                  ? `${minBy(result.stats, (item) => item.avgDelta ?? 999)?.subject} ${fmtDelta(
                      minBy(result.stats, (item) => item.avgDelta ?? 999)?.avgDelta ?? null,
                    )}`
                  : '—'
              }
            />
            <Insight
              title="进步最大"
              text={upTop[0] ? `${upTop[0].name} ${fmtRankDelta(upTop[0].totalRankDelta)}` : '—'}
            />
            <Insight
              title="与基准差距"
              text={`${first} → ${last}：总分均分 ${fmtDelta(result.totalStat.avgDelta)}`}
            />
          </div>

          <div className="chart-grid">
            <div className="panel chart-panel">
              <div className="panel-head compact">
                <h2>各科均分趋势</h2>
                <span className="muted">按场次顺序</span>
              </div>
              <Chart option={avgOption} height={300} />
            </div>
            <div className="panel chart-panel">
              <div className="panel-head compact">
                <h2>名次升降人数（{first} → {last}）</h2>
                <span className="muted">按“人×科”统计</span>
              </div>
              <Chart option={rankOption} height={300} />
            </div>
            <div className="panel chart-panel wide">
              <div className="panel-head compact">
                <h2>总分分数段：首场 vs 末场</h2>
                <span className="muted">每 {result.options.bucketSize} 分一段</span>
              </div>
              <Chart option={bucketOption} height={280} />
            </div>
          </div>

          <div className="mover-grid">
            <MoverList title={`总分名次上升 TOP5（${first} → ${last}）`} students={upTop} />
            <MoverList title={`总分名次下降 TOP5（${first} → ${last}）`} students={downTop} tone="down" />
          </div>

          <StatsTable stats={result.stats} total={result.totalStat} first={first} last={last} />
        </div>
      ) : null}

      {tab === 'summary' ? (
        <div className="tab-panel">
          <SummaryTable result={result} />
        </div>
      ) : null}

      {tab === 'subject' ? (
        <div className="tab-panel">
          <div className="subject-tabs no-print">
            {result.subjects.map((item) => (
              <button key={item} type="button" className={item === subject ? 'active' : ''} onClick={() => setSubject(item)}>
                {item}
              </button>
            ))}
          </div>
          {currentStat ? (
            <div className="subject-kpis">
              <span>
                均分 <strong>{fmtScore(currentStat.firstAvg)}</strong> → <strong>{fmtScore(currentStat.lastAvg)}</strong>{' '}
                <em className={`tone-${deltaTone(currentStat.avgDelta)}`}>{fmtDelta(currentStat.avgDelta)}</em>
              </span>
              <span>
                名次上升 <strong className="tone-up">{currentStat.up}</strong> / 下降{' '}
                <strong className="tone-down">{currentStat.down}</strong> / 持平 {currentStat.flat}
              </span>
              {currentStat.passMark != null ? (
                <span>
                  及格线 {currentStat.passMark}：{currentStat.firstPassCount ?? '—'} → {currentStat.lastPassCount ?? '—'} 人
                </span>
              ) : null}
            </div>
          ) : null}
          <SubjectTable result={result} subject={subject} />
        </div>
      ) : null}

      {tab === 'notes' ? (
        <div className="tab-panel">
          <div className="notes-grid">
            <div className="panel">
              <div className="panel-head compact">
                <h2>数据提醒</h2>
              </div>
              {result.warnings.length ? (
                <ul className="warning-list">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">没有发现明显的数据问题。</p>
              )}
            </div>
            <div className="panel">
              <div className="panel-head compact">
                <h2>口径说明</h2>
              </div>
              <ul className="note-list">
                <li>场次顺序：{result.labels.join(' → ')}；第一场为基准。</li>
                <li>排名变化 = 首场名次 − 末场名次，正数表示名次前进；分数变化 = 末场分数 − 首场分数。</li>
                <li>中间场次展示分数与排名，不单独计算变化；“趋势”以首末两场为准。</li>
                <li>
                  排名方式：
                  {result.options.rankMode === 'competition' ? '并列名次（同分同名次、后续跳号）' : '顺序名次（同分按顺序编号）'}。
                </li>
                <li>姓名按“姓名列”匹配；缺场的学生在对应场次为空，并标注“仅 N 场有成绩”。</li>
                <li>所有数据仅在本机浏览器处理，不上传服务器。</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="result-footer no-print">
        <span>数据来源：{result.fileName}</span>
        <button type="button" className="link-btn" onClick={props.onReset}>
          重新开始
        </button>
      </footer>
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <strong className={`kpi-value ${tone ? `tone-${tone}` : ''}`}>{value}</strong>
      <span className="kpi-sub">{sub}</span>
    </div>
  )
}

function Insight({ title, text }: { title: string; text: string }) {
  return (
    <div className="insight">
      <span>{title}</span>
      <strong>{text}</strong>
    </div>
  )
}

function MoverList({ title, students, tone }: { title: string; students: SeriesStudent[]; tone?: string }) {
  return (
    <div className="panel mover-panel">
      <div className="panel-head compact">
        <h2>{title}</h2>
      </div>
      <div className="mover-list">
        {students.length === 0 ? <p className="muted">—</p> : null}
        {students.map((student, index) => (
          <div className="mover-item" key={student.key}>
            <span className="mover-index">{index + 1}</span>
            <span className="mover-name">{student.name}</span>
            <span className="mover-score">
              {fmtScore(student.totals[0])} → {fmtScore(student.totals[student.totals.length - 1])}
            </span>
            <span className={`mover-delta tone-${tone ?? deltaTone(student.totalRankDelta)}`}>
              {fmtRankDelta(student.totalRankDelta)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function toneClass(value: number | null | undefined) {
  return `tone-${deltaTone(value)}`
}

function SummaryTable({ result }: { result: SeriesAnalysis }) {
  const columns: Column<TableRow>[] = [
    { key: 'index', label: '序号', value: (row) => row.index, width: 54 },
    { key: 'name', label: '姓名', value: (row) => row.name, align: 'left', width: 100 },
    ...result.labels.flatMap<Column<TableRow>>((label, examIndex) => [
      {
        key: `total-${examIndex}`,
        label: `${label}总分`,
        value: (row) => row.totals[examIndex],
        width: 92,
      },
      {
        key: `rank-${examIndex}`,
        label: '排名',
        value: (row) => row.totalRanks[examIndex],
        width: 64,
      },
    ]),
    {
      key: 'totalDelta',
      label: `总分变化（首→末）`,
      value: (row) => row.totalDelta,
      width: 112,
      render: (row) => <span className={toneClass(row.totalDelta)}>{fmtDelta(row.totalDelta)}</span>,
    },
    {
      key: 'rankDelta',
      label: '排名变化',
      value: (row) => row.totalRankDelta,
      width: 88,
      render: (row) => <span className={toneClass(row.totalRankDelta)}>{fmtRankDelta(row.totalRankDelta)}</span>,
    },
    ...result.subjects.map<Column<TableRow>>((subject) => ({
      key: `subject-${subject}`,
      label: `${subject}名次`,
      value: (row) => row.rankDeltas[subject],
      width: 84,
      render: (row) => (
        <span className={toneClass(row.rankDeltas[subject])}>{fmtRankDelta(row.rankDeltas[subject])}</span>
      ),
    })),
    { key: 'up', label: '上升科目', value: (row) => row.upCount, width: 76 },
    { key: 'down', label: '下降科目', value: (row) => row.downCount, width: 76 },
    {
      key: 'note',
      label: '备注',
      value: (row) => row.note,
      align: 'left',
      width: 140,
      render: (row) => <span className="note-text">{row.note}</span>,
    },
  ]
  const rows: TableRow[] = result.students.map((student, index) => ({ ...student, index: index + 1 }))

  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.key}
      initialSort={{ key: 'rankDelta', desc: true }}
      searchText={(row) => row.name}
      maxHeight={620}
    />
  )
}

function SubjectTable({ result, subject }: { result: SeriesAnalysis; subject: string }) {
  const columns: Column<TableRow>[] = [
    { key: 'index', label: '序号', value: (row) => row.index, width: 54 },
    { key: 'name', label: '姓名', value: (row) => row.name, align: 'left', width: 100 },
    ...result.labels.flatMap<Column<TableRow>>((label, examIndex) => [
      {
        key: `score-${examIndex}`,
        label: `${label}分数`,
        value: (row) => row.scores[subject][examIndex],
        width: 92,
      },
      {
        key: `rank-${examIndex}`,
        label: '排名',
        value: (row) => row.ranks[subject][examIndex],
        width: 64,
      },
    ]),
    {
      key: 'scoreDelta',
      label: '分数变化（首→末）',
      value: (row) => row.scoreDeltas[subject],
      width: 112,
      render: (row) => <span className={toneClass(row.scoreDeltas[subject])}>{fmtDelta(row.scoreDeltas[subject])}</span>,
    },
    {
      key: 'rankDelta',
      label: '排名变化',
      value: (row) => row.rankDeltas[subject],
      width: 88,
      render: (row) => <span className={toneClass(row.rankDeltas[subject])}>{fmtRankDelta(row.rankDeltas[subject])}</span>,
    },
    {
      key: 'word',
      label: '变动说明',
      value: (row) => deltaWord(row.rankDeltas[subject]),
      align: 'left',
      width: 132,
      render: (row) => <span className={toneClass(row.rankDeltas[subject])}>{deltaWord(row.rankDeltas[subject])}</span>,
    },
    {
      key: 'note',
      label: '备注',
      value: (row) => row.note,
      align: 'left',
      width: 130,
      render: (row) => <span className="note-text">{row.note}</span>,
    },
  ]
  const rows: TableRow[] = result.students.map((student, index) => ({ ...student, index: index + 1 }))
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(row) => row.key}
      initialSort={{ key: 'rankDelta', desc: true }}
      searchText={(row) => row.name}
      maxHeight={600}
    />
  )
}

function StatsTable({
  stats,
  total,
  first,
  last,
}: {
  stats: SeriesAnalysis['stats']
  total: SeriesAnalysis['totalStat']
  first: string
  last: string
}) {
  const all = [...stats, total]
  return (
    <div className="panel stats-panel">
      <div className="panel-head compact">
        <h2>科目统计（{first} → {last}）</h2>
      </div>
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              <th>科目</th>
              <th>均分（首 → 末）</th>
              <th>变化</th>
              <th>最高（首 → 末）</th>
              <th>最低（首 → 末）</th>
              <th>名次↑</th>
              <th>名次↓</th>
              <th>持平</th>
              <th>及格人数</th>
            </tr>
          </thead>
          <tbody>
            {all.map((stat) => (
              <tr key={stat.subject}>
                <td className="left">{stat.subject}</td>
                <td>
                  {fmtScore(stat.firstAvg)} → {fmtScore(stat.lastAvg)}
                </td>
                <td className={toneClass(stat.avgDelta)}>{fmtDelta(stat.avgDelta)}</td>
                <td>
                  {fmtScore(stat.firstMax)} → {fmtScore(stat.lastMax)}
                </td>
                <td>
                  {fmtScore(stat.firstMin)} → {fmtScore(stat.lastMin)}
                </td>
                <td className="tone-up">{stat.up}</td>
                <td className="tone-down">{stat.down}</td>
                <td>{stat.flat}</td>
                <td>{stat.passMark == null ? '—' : `${stat.firstPassCount ?? '—'} → ${stat.lastPassCount ?? '—'}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function maxBy<T>(list: T[], key: (item: T) => number): T | null {
  if (!list.length) return null
  return list.reduce((best, item) => (key(item) > key(best) ? item : best), list[0])
}

function minBy<T>(list: T[], key: (item: T) => number): T | null {
  if (!list.length) return null
  return list.reduce((best, item) => (key(item) < key(best) ? item : best), list[0])
}



