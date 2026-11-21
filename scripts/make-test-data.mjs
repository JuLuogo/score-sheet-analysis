import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'

const desktop = process.env.USERPROFILE
  ? path.join(process.env.USERPROFILE, 'Desktop')
  : process.env.HOME
const root = process.argv[2] ?? path.join(desktop, '成绩单测试数据')
fs.mkdirSync(root, { recursive: true })

const SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳'.split('')
const GIVEN = '子涵 欣怡 梓轩 雨桐 浩然 思远 嘉懿 雨欣 明轩 佳怡 宇航 梦琪 俊杰 诗涵 博文 静怡 天佑 可欣 志强 雅静 文博 晓彤 泽宇 雨萱 皓轩 语嫣 一鸣 书瑶 承宇 若曦 子墨 思琪 俊熙 婉清 睿泽 清妍 昊天 亦菲 泽楷 沐瑶 锦程 语晨 立诚 芷若 云帆 念慈 星辰 月华'.split(/\s+/)
const NAMES = []
for (let i = 0; i < 80; i += 1) {
  NAMES.push(`${SURNAMES[i % SURNAMES.length]}${GIVEN[(i * 7 + Math.floor(i / SURNAMES.length)) % GIVEN.length]}`)
}

function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const round = (value) => Math.round(value)

function ranksOf(totals) {
  return totals.map((total) => 1 + totals.filter((other) => other > total).length)
}

function styleSheet(ws, { headerRow, columns, titleRow = null }) {
  const lastCol = columns.length
  if (titleRow) {
    ws.mergeCells(titleRow, 1, titleRow, lastCol)
    const cell = ws.getCell(titleRow, 1)
    cell.font = { bold: true, size: 15 }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  }
  const header = ws.getRow(headerRow)
  header.height = 22
  header.eachCell((cell, col) => {
    cell.font = { bold: true, color: { argb: 'FF222222' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
    }
    if (columns[col - 1]) ws.getColumn(col).width = columns[col - 1].width
  })
  ws.views = [{ state: 'frozen', ySplit: headerRow }]
}

function addRows(ws, startRow, rows, numericCols) {
  rows.forEach((values, rowIndex) => {
    const row = ws.getRow(startRow + rowIndex)
    values.forEach((value, colIndex) => {
      const cell = row.getCell(colIndex + 1)
      cell.value = value
      cell.alignment = { horizontal: colIndex === 0 ? 'center' : 'left', vertical: 'middle' }
      if (numericCols.has(colIndex + 1) && typeof value === 'number') cell.numFmt = '0'
      cell.border = {
        bottom: { style: 'hair', color: { argb: 'FFEDEDED' } },
      }
    })
  })
}

function writeWorkbook(folder, fileName, build) {
  const wb = new ExcelJS.Workbook()
  wb.creator = '成绩单数据分析测试数据'
  wb.created = new Date('2026-11-01T08:00:00+08:00')
  build(wb)
  const file = path.join(folder, fileName)
  return wb.xlsx.writeFile(file).then(() => file)
}

const norm = (rng) => {
  const value = rng() + rng() + rng() + rng() - 2
  return value / 2
}

/* ---------------- 套 1：标准三场，带排名与总分 ---------------- */
async function set1() {
  const folder = path.join(root, '01_标准三场_带排名总分')
  fs.mkdirSync(folder, { recursive: true })
  const rng = mulberry32(20260101)
  const subjects = [
    { name: '语文', cap: 120 },
    { name: '数学', cap: 120 },
    { name: '英语', cap: 120 },
    { name: '专业课', cap: 200 },
    { name: '发动机', cap: 100 },
  ]
  const total = 42
  const abilities = Array.from({ length: total }, () => clamp(0.62 + norm(rng) * 0.22, 0.32, 0.96))
  const factors = subjects.map((subject) => 0.9 + subject.name.length * 0.01 + rng() * 0.06)
  const exams = [
    { file: '第一次月考.xlsx', label: '第一次月考', drift: 0.98, missing: [], extra: [] },
    { file: '第二次月考.xlsx', label: '第二次月考', drift: 1.01, missing: [], extra: [] },
    { file: '期中考试.xlsx', label: '期中考试', drift: 1.04, missing: [41], extra: ['插班生'] },
  ]
  const manifest = []

  for (const exam of exams) {
    const students = []
    for (let i = 0; i < total; i += 1) {
      if (exam.missing.includes(i)) continue
      const scores = subjects.map((subject, s) => {
        const noise = 0.94 + rng() * 0.12
        return round(clamp(abilities[i] * factors[s] * exam.drift * noise, 0.28, 0.995) * subject.cap)
      })
      students.push({
        id: `2024${String(i + 1).padStart(4, '0')}`,
        name: NAMES[i],
        scores,
      })
    }
    if (exam.extra.length) {
      students.push({
        id: '20249999',
        name: exam.extra[0],
        scores: subjects.map((subject, s) => round(clamp(0.72 * factors[s] * exam.drift, 0.3, 0.95) * subject.cap)),
      })
    }
    // 并列名次：第一次月考让总分最高的两名学生同分
    if (exam.label === '第一次月考' && students.length > 1) {
      const ranked = students
        .map((student, index) => ({
          index,
          total: student.scores.reduce((sum, score) => sum + score, 0),
        }))
        .sort((a, b) => b.total - a.total)
      const top = ranked[0]
      const second = ranked[1]
      students[second.index].scores = [...students[top.index].scores]
    }
    const totals = students.map((student) => student.scores.reduce((a, b) => a + b, 0))
    const ranks = ranksOf(totals)
    const rows = students.map((student, index) => [
      ranks[index],
      student.id,
      student.name,
      ...student.scores,
      totals[index],
    ])
    const columns = [
      { title: '排名', width: 8 },
      { title: '学号', width: 12 },
      { title: '姓名', width: 12 },
      ...subjects.map((subject) => ({ title: subject.name, width: 9 })),
      { title: '总分', width: 9 },
    ]
    await writeWorkbook(folder, exam.file, (wb) => {
      const ws = wb.addWorksheet('成绩')
      ws.addRow(columns.map((column) => column.title))
      addRows(ws, 2, rows, new Set(columns.map((_, index) => index + 1)))
      styleSheet(ws, { headerRow: 1, columns })
      ws.views = [{ state: 'frozen', ySplit: 1, xSplit: 3 }]
    })
    manifest.push({ exam: exam.label, count: students.length, tie: exam.label === '第一次月考' })
  }

  const notes = [
    '套 1：标准三场（带排名、总分）',
    '',
    '场次与人数：',
    '  第一次月考.xlsx：42 人（前两名总分相同，用于并列名次测试）',
    '  第二次月考.xlsx：42 人',
    '  期中考试.xlsx：42 人（原 42 人中第 42 号“转出”缺考；新增 1 名“插班生”）',
    '',
    '字段：排名、学号、姓名、语文、数学、英语、专业课、发动机、总分',
    '用途：验证排名列识别、并列名次、缺场/转入、总分校验、三场横向对比。',
    '预期：全程参考 41 人；插班生只有期中成绩；第一名两名学生并列。',
  ]
  fs.writeFileSync(path.join(folder, '说明.txt'), notes.join('\n'), 'utf8')
}

/* ---------------- 套 2：两场，无排名、无总分 ---------------- */
async function set2() {
  const folder = path.join(root, '02_两场_无排名无总分')
  fs.mkdirSync(folder, { recursive: true })
  const rng = mulberry32(20260202)
  const subjects = ['语文', '数学', '英语']
  const total = 36
  const abilities = Array.from({ length: total }, () => clamp(0.64 + norm(rng) * 0.2, 0.34, 0.95))
  const exams = ['第一次月考', '第二次月考']

  for (const [examIndex, label] of exams.entries()) {
    const rows = []
    for (let i = 0; i < total; i += 1) {
      if (examIndex === 1 && [7, 23].includes(i)) continue
      const scores = subjects.map((_, s) =>
        round(clamp(abilities[i] * (0.96 + rng() * 0.08) * (1 + examIndex * 0.02), 0.35, 0.98) * 100),
      )
      rows.push([NAMES[i + 40], ...scores])
    }
    // 并列总分
    if (examIndex === 0 && rows.length > 2) {
      rows[1] = [rows[1][0], ...rows[0].slice(1)]
    }
    await writeWorkbook(folder, `${label}.xlsx`, (wb) => {
      const ws = wb.addWorksheet('成绩')
      ws.addRow(['姓名', ...subjects])
      addRows(ws, 2, rows, new Set([2, 3, 4]))
      styleSheet(ws, { headerRow: 1, columns: [{ width: 14 }, { width: 10 }, { width: 10 }, { width: 10 }] })
    })
  }

  const notes = [
    '套 2：两场，无排名、无总分',
    '',
    '场次与人数：',
    '  第一次月考.xlsx：36 人',
    '  第二次月考.xlsx：34 人（缺 2 人，用于缺场测试）',
    '',
    '字段：姓名、语文、数学、英语',
    '特点：没有排名列，也没有总分列；第一次月考有两人总分相同。',
    '用途：验证自动识别科目、自动求总分、自动计算名次。',
    '预期：总分=三科之和；名次由系统自动计算；第二名与第一名并列。',
  ]
  fs.writeFileSync(path.join(folder, '说明.txt'), notes.join('\n'), 'utf8')
}

/* ---------------- 套 3：非标准表头 + 统计行 ---------------- */
async function set3() {
  const folder = path.join(root, '03_非标准表头_含统计行')
  fs.mkdirSync(folder, { recursive: true })
  const rng = mulberry32(20260303)
  const subjects = [
    { name: '语文', cap: 120 },
    { name: '数学', cap: 120 },
    { name: '英语', cap: 120 },
    { name: '物理', cap: 100 },
    { name: '化学', cap: 100 },
  ]
  const total = 30
  const abilities = Array.from({ length: total }, () => clamp(0.6 + norm(rng) * 0.2, 0.34, 0.94))
  const exams = ['第一次月考', '第二次月考', '期中考试']

  for (const [examIndex, label] of exams.entries()) {
    const students = []
    for (let i = 0; i < total; i += 1) {
      if (examIndex === 2 && i === 18) continue
      const scores = subjects.map((subject, s) =>
        round(clamp(abilities[i] * (0.95 + rng() * 0.1) * (1 + examIndex * 0.015), 0.3, 0.98) * subject.cap),
      )
      students.push({
        no: i + 1,
        klass: '高二(3)班',
        name: NAMES[i],
        gender: i % 2 === 0 ? '男' : '女',
        scores,
      })
    }
    const totals = students.map((student) => student.scores.reduce((a, b) => a + b, 0))
    const ranks = ranksOf(totals)
    const rows = students.map((student, index) => [
      student.no,
      student.klass,
      student.name,
      student.gender,
      ...student.scores.map((score, s) => (examIndex === 1 && index % 7 === 3 ? String(score) : score)),
      totals[index],
      ranks[index],
    ])
    const averages = subjects.map((_, s) =>
      Math.round((students.reduce((sum, student) => sum + student.scores[s], 0) / students.length) * 10) / 10,
    )
    const maxes = subjects.map((_, s) => Math.max(...students.map((student) => student.scores[s])))
    const passRates = subjects.map((_, s) => {
      const pass = Math.round(subjects[s].cap * 0.6)
      const count = students.filter((student) => student.scores[s] >= pass).length
      return `${Math.round((count / students.length) * 100)}%`
    })
    const summaryRows = [
      ['', '', '平均分', '', ...averages, Math.round(totals.reduce((a, b) => a + b, 0) / totals.length), ''],
      ['', '', '最高分', '', ...maxes, Math.max(...totals), ''],
      ['', '', '及格率', '', ...passRates, '', ''],
    ]

    await writeWorkbook(folder, `${label}.xlsx`, (wb) => {
      const ws = wb.addWorksheet('成绩')
      ws.addRow(['2026 学年第一学期 高二(3)班成绩统计表'])
      ws.addRow([])
      ws.addRow(['序号', '班级', '姓名', '性别', ...subjects.map((subject) => subject.name), '总分', '班级排名'])
      addRows(ws, 4, rows, new Set([1, 5, 6, 7, 8, 9, 10, 11]))
      const summaryStart = 4 + rows.length + 1
      summaryRows.forEach((values, index) => {
        const row = ws.getRow(summaryStart + index)
        values.forEach((value, col) => {
          const cell = row.getCell(col + 1)
          cell.value = value
          cell.font = { italic: true, color: { argb: 'FF666666' } }
          cell.alignment = { horizontal: 'center' }
        })
      })
      styleSheet(ws, {
        headerRow: 3,
        columns: [
          { width: 7 },
          { width: 11 },
          { width: 11 },
          { width: 7 },
          ...subjects.map(() => ({ width: 9 })),
          { width: 9 },
          { width: 10 },
        ],
      })
      const title = ws.getCell('A1')
      title.font = { bold: true, size: 15 }
      title.alignment = { horizontal: 'left' }
    })
  }

  const notes = [
    '套 3：非标准表头 + 统计行',
    '',
    '场次与人数：',
    '  第一次月考.xlsx：30 人（第 1 行标题、第 2 行空行、第 3 行表头）',
    '  第二次月考.xlsx：30 人（部分分数写成文本格式）',
    '  期中考试.xlsx：29 人（缺 1 人）',
    '',
    '字段：序号、班级、姓名、性别、语文、数学、英语、物理、化学、总分、班级排名',
    '特点：表头不在第一行；底部有“平均分 / 最高分 / 及格率”统计行；含空行；有文本格式分数。',
    '用途：验证表头自动定位、统计行过滤、文本数字识别、班级排名列识别。',
    '预期：只识别学生行，统计行被跳过；总分与班级排名按表内值。',
  ]
  fs.writeFileSync(path.join(folder, '说明.txt'), notes.join('\n'), 'utf8')
}

/* ---------------- 套 4：多科目大班，含缺考 ---------------- */
async function set4() {
  const folder = path.join(root, '04_多科目大班_含缺考')
  fs.mkdirSync(folder, { recursive: true })
  const rng = mulberry32(20260404)
  const subjects = ['语文', '数学', '英语', '物理', '化学', '生物']
  const total = 52
  const abilities = Array.from({ length: total }, () => clamp(0.6 + norm(rng) * 0.22, 0.3, 0.96))
  const exams = [
    { label: '第一次月考', missing: [], extra: [] },
    { label: '第二次月考', missing: [3, 11, 27, 44], extra: [] },
    { label: '期中考试', missing: [8], extra: ['新同学'] },
  ]

  for (const exam of exams) {
    const students = []
    for (let i = 0; i < total; i += 1) {
      if (exam.missing.includes(i)) continue
      const scores = subjects.map((_, s) =>
        round(clamp(abilities[i] * (0.95 + rng() * 0.1) * (0.98 + rng() * 0.04), 0.28, 0.98) * 100),
      )
      students.push({ id: `2025${String(i + 1).padStart(4, '0')}`, name: NAMES[i + 20], scores })
    }
    if (exam.extra.length) {
      students.push({
        id: '20259999',
        name: exam.extra[0],
        scores: subjects.map(() => round(clamp(0.7 + rng() * 0.1, 0.5, 0.9) * 100)),
      })
    }
    // 两人总分并列
    if (students.length > 2) {
      const target = students[0].scores.reduce((a, b) => a + b, 0)
      let current = students[1].scores.reduce((a, b) => a + b, 0)
      let guard = 0
      while (current !== target && guard < 100) {
        const delta = target - current
        const idx = guard % subjects.length
        if (delta > 0) {
          students[1].scores[idx] += Math.min(delta, 4)
          current += Math.min(delta, 4)
        } else {
          students[1].scores[idx] -= Math.min(-delta, 4)
          current -= Math.min(-delta, 4)
        }
        guard += 1
      }
    }
    const totals = students.map((student) => student.scores.reduce((a, b) => a + b, 0))
    const ranks = ranksOf(totals)
    const rows = students.map((student, index) => [
      student.id,
      student.name,
      ...student.scores,
      totals[index],
      ranks[index],
    ])
    await writeWorkbook(folder, `${exam.label}.xlsx`, (wb) => {
      const ws = wb.addWorksheet('成绩')
      ws.addRow(['学号', '姓名', ...subjects, '总分', '排名'])
      addRows(ws, 2, rows, new Set([3, 4, 5, 6, 7, 8, 9, 10]))
      styleSheet(ws, {
        headerRow: 1,
        columns: [
          { width: 12 },
          { width: 12 },
          ...subjects.map(() => ({ width: 8 })),
          { width: 9 },
          { width: 8 },
        ],
      })
      const notes = wb.addWorksheet('说明')
      notes.getCell('A1').value = '本表为测试数据，姓名与分数均为虚构。'
      notes.getCell('A2').value = `场次：${exam.label}；学生数：${students.length}`
      notes.getCell('A3').value = '用于测试多科目、大班额、缺考与并列名次。'
      notes.getColumn(1).width = 60
    })
  }

  const notes = [
    '套 4：多科目大班，含缺考',
    '',
    '场次与人数：',
    '  第一次月考.xlsx：52 人',
    '  第二次月考.xlsx：48 人（缺考 4 人：4、12、28、45 号）',
    '  期中考试.xlsx：52 人（缺 1 人、转入 1 人“新同学”）',
    '',
    '字段：学号、姓名、语文、数学、英语、物理、化学、生物、总分、排名',
    '特点：6 科、大班额、两次缺考、一次转入；每个文件含“成绩”和“说明”两个工作表。',
    '用途：验证多科目图表、缺考、转入、跨场次匹配、工作表选择。',
    '预期：默认读取“成绩”表；“新同学”只有期中成绩；缺考学生在对应场次为空。',
  ]
  fs.writeFileSync(path.join(folder, '说明.txt'), notes.join('\n'), 'utf8')
}

await set1()
await set2()
await set3()
await set4()

const readme = [
  '# 成绩单数据分析 · 测试数据',
  '',
  '本目录包含 4 套虚构的测试成绩单，可直接拖入 http://localhost:4173/ 使用。',
  '',
  '| 套 | 文件夹 | 场次 | 特点 |',
  '| --- | --- | --- | --- |',
  '| 1 | 01_标准三场_带排名总分 | 3 | 排名/总分齐全，并列名次，转出/转入 |',
  '| 2 | 02_两场_无排名无总分 | 2 | 只有姓名+三科，验证自动排名/求和 |',
  '| 3 | 03_非标准表头_含统计行 | 3 | 表头在第 3 行，底部统计行，文本分数 |',
  '| 4 | 04_多科目大班_含缺考 | 3 | 6 科、52 人、缺考与转入、多工作表 |',
  '',
  '使用建议：',
  '1. 每次测试一套，先拖入该套的全部 xlsx；',
  '2. 点“下一步”，检查姓名列、科目列、总分列、排名列是否识别正确；',
  '3. 选择场次并分析，重点看“排名浮动”“各科趋势”“汇总矩阵”；',
  '4. 每套文件夹内的“说明.txt”写了预期人数与特殊学生。',
  '',
  '所有姓名与分数均为程序生成，不对应任何真实学生。',
].join('\n')
fs.writeFileSync(path.join(root, 'README.md'), readme, 'utf8')

console.log(root)
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const files = fs.readdirSync(path.join(root, entry.name))
  console.log(`${entry.name}: ${files.filter((file) => file.endsWith('.xlsx')).length} 个 xlsx`)
}



