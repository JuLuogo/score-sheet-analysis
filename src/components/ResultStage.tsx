import { useMemo, useState } from 'react'
import type { AnalysisResult, StudentAnalysis, SubjectStat } from '../types'
import { DataTable } from './DataTable'
import type { Column } from './DataTable'
import { Chart } from './Chart'
import { CHART_COLORS, CHART_FONT } from '../lib/echarts'
import { deltaTone, deltaWord, fmtDelta, fmtRankDelta, fmtScore } from '../lib/format'

type TabKey = 'overview' | 'summary' | 'subject' | 'notes'

interface ResultStageProps {
  result: AnalysisResult
  className: string
  onClassName: (value: string) => void
  exporting: boolean
  saved: boolean
  onExportXlsx: () => void
  onExportCsv: () => void
  onSaveHistory: () => void
  onBackMapping: () => void
  onReset: () => void
}

export function ResultStage(props: ResultStageProps) {
  const { result } = props
  const [tab, setTab] = useState<TabKey>(() => {
    const value = new URLSearchParams(window.location.search).get('tab')
    return value === 'summary' || value === 'subject' || value === 'notes' ? value : 'overview'
  })
  const [subject, setSubject] = useState(result.subjects[0] ?? '')

  const avgOption = useMemo(() => {
    const categories = result.subjects
    return {
      color: [CHART_COLORS.base, CHART_COLORS.target],
      textStyle: CHART_FONT,
      tooltip: { trigger: 'axis' },
      legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
      grid: { left: 40, right: 16, top: 40, bottom: 30 },
      xAxis: {
        type: 'category',
        data: categories,
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
          name: result.baseLabel,
          type: 'bar',
          barMaxWidth: 26,
          data: result.stats.map((stat) => stat.baseAvg),
          label: { show: true, position: 'top', fontSize: 10, color: '#6b7280' },
        },
        {
          name: result.targetLabel,
          type: 'bar',
          barMaxWidth: 26,
          data: result.stats.map((stat) => stat.targetAvg),
          label: { show: true, position: 'top', fontSize: 10, color: '#1f3864' },
        },
      ],
    }
  }, [result])

  const rankOption = useMemo(() => {
    const labels = [...result.subjects, '总分']
    const stats = [...result.stats, result.totalStat]
    return {
      color: [CHART_COLORS.up, CHART_COLORS.flat, CHART_COLORS.down],
      textStyle: CHART_FONT,
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
      grid: { left: 40, right: 16, top: 40, bottom: 30 },
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
        { name: '名次上升', type: 'bar', stack: 'total', barMaxWidth: 34, data: stats.map((s) => s.up), label: { show: true, fontSize: 10, color: '#fff' } },
        { name: '持平', type: 'bar', stack: 'total', barMaxWidth: 34, data: stats.map((s) => s.flat), label: { show: true, fontSize: 10, color: '#595959' } },
        { name: '名次下降', type: 'bar', stack: 'total', barMaxWidth: 34, data: stats.map((s) => s.down), label: { show: true, fontSize: 10, color: '#fff' } },
      ],
    }
  }, [result])

  const bucketOption = useMemo(() => {
    return {
      color: [CHART_COLORS.base, CHART_COLORS.target],
      textStyle: CHART_FONT,
      tooltip: { trigger: 'axis' },
      legend: { top: 0, icon: 'roundRect', itemWidth: 12, itemHeight: 8 },
      grid: { left: 40, right: 16, top: 40, bottom: 30 },
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
        { name: result.baseLabel, type: 'bar', barMaxWidth: 26, data: result.buckets.map((b) => b.base), label: { show: true, position: 'top', fontSize: 10, color: '#6b7280' } },
        { name: result.targetLabel, type: 'bar', barMaxWidth: 26, data: result.buckets.map((b) => b.target), label: { show: true, position: 'top', fontSize: 10, color: '#1f3864' } },
      ],
    }
  }, [result])

  const upTop = useMemo(
    () =>
      result.students
        .filter((student) => student.inTarget && student.totalRankDelta != null)
        .sort((a, b) => (b.totalRankDelta ?? 0) - (a.totalRankDelta ?? 0))
        .slice(0, 5),
    [result],
  )
  const downTop = useMemo(
    () =>
      result.students
        .filter((student) => student.inTarget && student.totalRankDelta != null)
        .sort((a, b) => (a.totalRankDelta ?? 0) - (b.totalRankDelta ?? 0))
        .slice(0, 5),
    [result],
  )

  const currentStat = result.stats.find((item) => item.subject === subject) ?? result.stats[0]

  return (
    <div className="stage result-stage">
      <div className="result-head no-print">
        <div>
          <p className="eyebrow">第 3 步 / 共 3 步</p>
          <div className="result-title-row">
            <input
              className="class-name-input"
              value={props.className}
              onChange={(event) => props.onClassName(event.target.value)}
              aria-label="班级名称"
            />
            <span className="result-sub">
              {result.baseLabel} → {result.targetLabel} · 可比 {result.counts.comparable} 人
            </span>
          </div>
        </div>
        <div className="result-actions">
          <button type="button" className="btn ghost" onClick={props.onBackMapping}>
            返回字段
          </button>
          <button type="button" className="btn ghost" onClick={props.onExportCsv} disabled={props.exporting}>
            导出 CSV
          </button>
          <button type="button" className="btn" onClick={props.onSaveHistory} disabled={props.saved}>
            {props.saved ? '已存到本机' : '存到本机'}
          </button>
          <button type="button" className="btn primary" onClick={props.onExportXlsx} disabled={props.exporting}>
            {props.exporting ? '正在生成…' : '导出 Excel'}
          </button>
          <button type="button" className="btn ghost" onClick={() => window.print()}>
            打印
          </button>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi label="参考人数" value={`${result.counts.targetCount}`} sub={`基准 ${result.counts.baseCount} 人`} />
        <Kpi
          label="总分均分"
          value={fmtScore(result.totalStat.targetAvg)}
          sub={`${result.baseLabel} ${fmtScore(result.totalStat.baseAvg)} · ${fmtDelta(result.totalStat.avgDelta)}`}
          tone={deltaTone(result.totalStat.avgDelta)}
        />
        <Kpi label="最高分" value={fmtScore(result.totalStat.targetMax)} sub={`基准 ${fmtScore(result.totalStat.baseMax)}`} />
        <Kpi
          label="总分名次"
          value={`↑${result.counts.totalUp} / ↓${result.counts.totalDown}`}
          sub={`持平 ${result.counts.totalFlat} 人`}
        />
        <Kpi
          label="单科名次变化"
          value={`↑${result.counts.subjectUp} / ↓${result.counts.subjectDown}`}
          sub={`共 ${result.counts.comparable * result.subjects.length} 个“人×科”`}
        />
        <Kpi
          label="仅一场有成绩"
          value={`${result.counts.baseOnly + result.counts.targetOnly}`}
          sub={`缺考/转入转出 ${result.counts.targetOnly + result.counts.baseOnly} 人`}
        />
      </div>

      <div className="tabs no-print">
        {(
          [
            ['overview', '总览'],
            ['summary', '汇总表'],
            ['subject', '单科表'],
            ['notes', '数据说明'],
          ] as [TabKey, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? 'active' : ''}
            onClick={() => setTab(key)}
          >
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
                result.stats.length
                  ? `${maxBy(result.stats, (s) => s.avgDelta ?? -999)?.subject ?? '—'} 均分 ${fmtDelta(
                      maxBy(result.stats, (s) => s.avgDelta ?? -999)?.avgDelta ?? null,
                    )}`
                  : '—'
              }
            />
            <Insight
              title="下滑最多"
              text={
                result.stats.length
                  ? `${minBy(result.stats, (s) => s.avgDelta ?? 999)?.subject ?? '—'} 均分 ${fmtDelta(
                      minBy(result.stats, (s) => s.avgDelta ?? 999)?.avgDelta ?? null,
                    )}`
                  : '—'
              }
            />
            <Insight
              title="进步最大"
              text={
                upTop[0] && upTop[0].totalRankDelta != null
                  ? `${upTop[0].name} 总分名次 ${fmtRankDelta(upTop[0].totalRankDelta)}`
                  : '—'
              }
            />
            <Insight
              title="需关注"
              text={
                downTop[0] && downTop[0].totalRankDelta != null
                  ? `${downTop[0].name} 总分名次 ${fmtRankDelta(downTop[0].totalRankDelta)}`
                  : '—'
              }
            />
          </div>

          <div className="chart-grid">
            <div className="panel chart-panel">
              <div className="panel-head compact">
                <h2>各科平均分</h2>
                <span className="muted">满分可留空</span>
              </div>
              <Chart option={avgOption} height={300} />
            </div>
            <div className="panel chart-panel">
              <div className="panel-head compact">
                <h2>名次升降人数</h2>
                <span className="muted">按“人×科”统计</span>
              </div>
              <Chart option={rankOption} height={300} />
            </div>
            <div className="panel chart-panel wide">
              <div className="panel-head compact">
                <h2>总分分数段分布</h2>
                <span className="muted">每 {result.options.bucketSize} 分一段</span>
              </div>
              <Chart option={bucketOption} height={280} />
            </div>
          </div>

          <div className="mover-grid">
            <MoverList title="总分名次上升 TOP5" students={upTop} />
            <MoverList title="总分名次下降 TOP5" students={downTop} tone="down" />
          </div>

          <StatsTable stats={result.stats} total={result.totalStat} />
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
              <button
                key={item}
                type="button"
                className={item === subject ? 'active' : ''}
                onClick={() => setSubject(item)}
              >
                {item}
              </button>
            ))}
          </div>
          {currentStat ? (
            <div className="subject-kpis">
              <span>
                均分 <strong>{fmtScore(currentStat.baseAvg)}</strong> → <strong>{fmtScore(currentStat.targetAvg)}</strong>{' '}
                <em className={`tone-${deltaTone(currentStat.avgDelta)}`}>{fmtDelta(currentStat.avgDelta)}</em>
              </span>
              <span>
                名次上升 <strong className="tone-up">{currentStat.up}</strong> / 下降{' '}
                <strong className="tone-down">{currentStat.down}</strong> / 持平 {currentStat.flat}
              </span>
              {currentStat.passMark != null ? (
                <span>
                  及格线 {currentStat.passMark} 分：{currentStat.basePassCount ?? '—'} → {currentStat.targetPassCount ?? '—'} 人
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
                <li>排名变化 = 基准名次 − 对比名次，正数表示名次前进。</li>
                <li>分数变化 = 对比分数 − 基准分数；分数受试卷难度影响，建议结合名次判断。</li>
                <li>
                  排名方式：
                  {result.options.rankMode === 'competition'
                    ? '并列名次（同分同名次，后续跳号）'
                    : '顺序名次（同分按顺序编号）'}
                  。
                </li>
                <li>姓名按“姓名列”匹配；只有一场有成绩的学生会标注“仅…有成绩”，不参与名次对比。</li>
                <li>所有数据仅在本机浏览器处理，刷新或关闭页面后需重新上传（可存到本机历史）。</li>
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <footer className="result-footer no-print">
        <span>数据来源：{result.baseFileName} / {result.targetFileName}</span>
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

function MoverList({ title, students, tone }: { title: string; students: StudentAnalysis[]; tone?: string }) {
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
              {fmtScore(student.baseTotal)} → {fmtScore(student.targetTotal)}
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

type TableRow = StudentAnalysis & { index: number }

function SummaryTable({ result }: { result: AnalysisResult }) {
  const columns: Column<TableRow>[] = [
    { key: 'index', label: '序号', value: (row) => row.index, width: 56 },
    { key: 'name', label: '姓名', value: (row) => row.name, align: 'left', width: 110 },
    { key: 'baseTotal', label: `${result.baseLabel}总分`, value: (row) => row.baseTotal, width: 104 },
    { key: 'targetTotal', label: `${result.targetLabel}总分`, value: (row) => row.targetTotal, width: 104 },
    {
      key: 'totalDelta',
      label: '总分变化',
      value: (row) => row.totalDelta,
      width: 96,
      render: (row) => <span className={toneClass(row.totalDelta)}>{fmtDelta(row.totalDelta)}</span>,
    },
    { key: 'baseRank', label: `${result.baseLabel}排名`, value: (row) => row.baseTotalRank, width: 96 },
    { key: 'targetRank', label: `${result.targetLabel}排名`, value: (row) => row.targetTotalRank, width: 96 },
    {
      key: 'rankDelta',
      label: '排名变化',
      value: (row) => row.totalRankDelta,
      width: 90,
      render: (row) => <span className={toneClass(row.totalRankDelta)}>{fmtRankDelta(row.totalRankDelta)}</span>,
    },
    ...result.subjects.map<Column<TableRow>>((subject) => ({
      key: `subject-${subject}`,
      label: `${subject}名次`,
      value: (row) => row.rankDeltas[subject],
      width: 88,
      render: (row) => (
        <span className={toneClass(row.rankDeltas[subject])}>{fmtRankDelta(row.rankDeltas[subject])}</span>
      ),
    })),
    { key: 'up', label: '上升科目', value: (row) => row.upCount, width: 80 },
    { key: 'down', label: '下降科目', value: (row) => row.downCount, width: 80 },
    {
      key: 'note',
      label: '备注',
      value: (row) => row.note,
      align: 'left',
      width: 150,
      render: (row) => <span className="note-text">{row.note || ''}</span>,
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

function SubjectTable({ result, subject }: { result: AnalysisResult; subject: string }) {
  const columns: Column<TableRow>[] = [
    { key: 'index', label: '序号', value: (row) => row.index, width: 56 },
    { key: 'name', label: '姓名', value: (row) => row.name, align: 'left', width: 110 },
    { key: 'baseScore', label: `${result.baseLabel}分数`, value: (row) => row.baseScores[subject], width: 104 },
    { key: 'baseRank', label: `${result.baseLabel}排名`, value: (row) => row.baseRanks[subject], width: 96 },
    { key: 'targetScore', label: `${result.targetLabel}分数`, value: (row) => row.targetScores[subject], width: 104 },
    { key: 'targetRank', label: `${result.targetLabel}排名`, value: (row) => row.targetRanks[subject], width: 96 },
    {
      key: 'scoreDelta',
      label: '分数变化',
      value: (row) => row.scoreDeltas[subject],
      width: 96,
      render: (row) => <span className={toneClass(row.scoreDeltas[subject])}>{fmtDelta(row.scoreDeltas[subject])}</span>,
    },
    {
      key: 'rankDelta',
      label: '排名变化',
      value: (row) => row.rankDeltas[subject],
      width: 96,
      render: (row) => <span className={toneClass(row.rankDeltas[subject])}>{fmtRankDelta(row.rankDeltas[subject])}</span>,
    },
    {
      key: 'word',
      label: '变动说明',
      value: (row) => deltaWord(row.rankDeltas[subject]),
      align: 'left',
      width: 150,
      render: (row) => (
        <span className={toneClass(row.rankDeltas[subject])}>{deltaWord(row.rankDeltas[subject])}</span>
      ),
    },
    {
      key: 'note',
      label: '备注',
      value: (row) => row.note,
      align: 'left',
      width: 150,
      render: (row) => <span className="note-text">{row.note || ''}</span>,
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

function StatsTable({ stats, total }: { stats: SubjectStat[]; total: SubjectStat }) {
  const all = [...stats, total]
  return (
    <div className="panel stats-panel">
      <div className="panel-head compact">
        <h2>科目统计</h2>
      </div>
      <div className="table-scroll">
        <table className="stats-table">
          <thead>
            <tr>
              <th>科目</th>
              <th>均分</th>
              <th>变化</th>
              <th>最高</th>
              <th>最低</th>
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
                  {fmtScore(stat.baseAvg)} → {fmtScore(stat.targetAvg)}
                </td>
                <td className={toneClass(stat.avgDelta)}>{fmtDelta(stat.avgDelta)}</td>
                <td>
                  {fmtScore(stat.baseMax)} → {fmtScore(stat.targetMax)}
                </td>
                <td>
                  {fmtScore(stat.baseMin)} → {fmtScore(stat.targetMin)}
                </td>
                <td className="tone-up">{stat.up}</td>
                <td className="tone-down">{stat.down}</td>
                <td>{stat.flat}</td>
                <td>{stat.passMark == null ? '—' : `${stat.basePassCount ?? '—'} → ${stat.targetPassCount ?? '—'}`}</td>
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


