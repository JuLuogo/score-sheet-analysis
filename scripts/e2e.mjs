import { chromium } from 'playwright-core'
import ExcelJS from 'exceljs'
import fs from 'node:fs'
import path from 'node:path'

const BASE = 'http://localhost:4173'
const ART = 'D:/github/grade-compare/.test-artifacts'
const TMP = path.join(process.env.TEMP ?? '.', 'score-e2e')
fs.mkdirSync(ART, { recursive: true })
fs.mkdirSync(TMP, { recursive: true })

const results = []
const check = async (name, fn) => {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`PASS ${name}`)
  } catch (error) {
    results.push({ name, ok: false, error: String(error).slice(0, 300) })
    console.log(`FAIL ${name}: ${String(error).slice(0, 200)}`)
  }
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

async function writeExam(file, students, withRank = true, withTotal = true) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Sheet1')
  const header = ['姓名', '语文', '数学', '英语']
  if (withRank) header.unshift('排名')
  if (withTotal) header.push('总分')
  ws.addRow(header)
  const totals = students.map((row) => row[1] + row[2] + row[3])
  const ranks = totals.map((total) => 1 + totals.filter((value) => value > total).length)
  students.forEach((row, index) => {
    const values = [row[0], row[1], row[2], row[3]]
    if (withRank) values.unshift(ranks[index])
    if (withTotal) values.push(totals[index])
    ws.addRow(values)
  })
  const full = path.join(TMP, file)
  await wb.xlsx.writeFile(full)
  return full
}

const A1 = await writeExam('a1.xlsx', [
  ['张三', 90, 88, 86],
  ['李四', 85, 84, 82],
  ['王五', 80, 80, 78],
  ['赵六', 75, 76, 74],
  ['钱七', 70, 72, 70],
  ['孙八', 65, 68, 66],
])
const A2 = await writeExam('a2.xlsx', [
  ['张三', 92, 90, 88],
  ['李四', 84, 86, 80],
  ['王五', 82, 78, 80],
  ['赵六', 76, 78, 72],
  ['钱七', 72, 70, 74],
  ['孙八', 60, 62, 64],
])
const A3 = await writeExam('a3.xlsx', [
  ['张三', 95, 92, 90],
  ['李四', 80, 88, 78],
  ['王五', 85, 76, 82],
  ['赵六', 70, 80, 70],
  ['钱七', 75, 72, 76],
])

const B1 = await writeExam(
  'b1.xlsx',
  [
    ['张三', 90, 80, 70],
    ['李四', 85, 75, 60],
    ['王五', 70, 65, 55],
  ],
  false,
  false,
)
const B2 = await writeExam(
  'b2.xlsx',
  [
    ['张三', 95, 85, 75],
    ['李四', 80, 88, 65],
    ['王五', 75, 60, 60],
  ],
  false,
  false,
)

const badFile = path.join(TMP, 'bad.txt')
fs.writeFileSync(badFile, 'not a spreadsheet')

const browser = await chromium.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true })
const consoleErrors = []
page.on('pageerror', (error) => consoleErrors.push(String(error)))
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})

const shot = (name) => page.screenshot({ path: `${ART}/${name}.png`, fullPage: false })
const nextButton = () => page.getByRole('button', { name: '下一步', exact: true })

try {
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.landing')

  await check('首页只有全屏上传，无侧边栏', async () => {
    assert((await page.locator('.sidebar').count()) === 0, '不应出现侧边栏')
    assert((await page.locator('.landing-upload').count()) === 1, '缺少上传区')
    const box = await page.locator('.landing-upload .el-upload-dragger').boundingBox()
    assert(box && box.width > 900, `上传区宽度过小：${box?.width}`)
  })

  await check('非法文件给出错误提示且不进入工作台', async () => {
    await page.setInputFiles('input[type=file]', badFile)
    await page.waitForSelector('.el-alert', { timeout: 5000 })
    const text = await page.locator('.el-alert').innerText()
    assert(text.includes('仅支持'), `错误提示不正确：${text}`)
    assert((await page.locator('.sidebar').count()) === 0, '不应进入工作台')
  })

  await check('错误提示会自动消失', async () => {
    await page.waitForTimeout(3600)
    assert((await page.locator('.el-message').count()) === 0, '错误提示未自动关闭')
  })

  await check('只上传 1 份时“下一步”禁用', async () => {
    await page.setInputFiles('input[type=file]', A1)
    await page.waitForSelector('text=已选择 1 份成绩单')
    assert(await nextButton().isDisabled(), '下一步应禁用')
  })

  await check('移除文件后回到空状态', async () => {
    await page.locator('.landing-file').first().getByRole('button', { name: '移除' }).click()
    await page.waitForTimeout(200)
    assert((await page.locator('.landing-file').count()) === 0, '文件未被移除')
    assert((await nextButton().count()) === 0, '下一步仍显示')
  })

  await check('3 份成绩单上传后可点下一步', async () => {
    await page.setInputFiles('input[type=file]', [A1, A2, A3])
    await page.waitForSelector('text=已选择 3 份成绩单')
    assert(await nextButton().isEnabled(), '下一步应可用')
    await shot('01-landing-ready')
    await nextButton().click()
    await page.waitForSelector('text=成绩单字段确认')
  })

  await check('下一步后出现侧边栏与字段确认', async () => {
    assert((await page.locator('.sidebar').count()) === 1, '缺少侧边栏')
    assert((await page.locator('.exam-aside-item').count()) === 3, '场次数量不对')
    await page.locator('.exam-aside-item').filter({ hasText: 'a1' }).click()
    await page.waitForTimeout(200)
    const status = await page.locator('.el-alert__content').last().innerText()
    assert(status.includes('6 名学生') && status.includes('3 个科目'), `识别结果异常：${status}`)
    await shot('02-mapping')
  })

  await check('切换场次后字段与预览更新', async () => {
    await page.locator('.exam-aside-item').filter({ hasText: 'a3' }).click()
    await page.waitForTimeout(200)
    const status = await page.locator('.el-alert__content').last().innerText()
    assert(status.includes('5 名学生'), `第三场应为 5 人：${status}`)
  })

  await check('进入场次选择，默认三场且第一场为基准', async () => {
    await page.getByRole('button', { name: '下一步：选择场次' }).first().click()
    await page.waitForSelector('text=选择对比场次与导出内容')
    assert((await page.locator('.compare-item').count()) >= 3, '场次列表不完整')
    const first = await page.locator('.compare-item').first().innerText()
    assert(first.includes('基准'), '第一场不是基准')
    await shot('03-select')
  })

  await check('场次顺序可调整并恢复基准', async () => {
    const firstName = async () =>
      (await page.locator('.compare-item .compare-main strong').first().innerText()).trim()
    const original = await firstName()
    await page.locator('.compare-item').first().locator('button').nth(1).click()
    await page.waitForTimeout(200)
    const moved = await firstName()
    assert(moved !== original, '下移后顺序未变化')
    assert((await page.locator('.compare-item').first().innerText()).includes('基准'), '新场次未成为基准')
    await page.locator('.compare-item').nth(1).locator('button').nth(0).click()
    await page.waitForTimeout(200)
    assert((await firstName()) === original, '上移后未恢复原顺序')
  })

  await check('开始分析进入排名浮动视图', async () => {
    await page.getByRole('button', { name: '开始分析' }).first().click()
    await page.waitForSelector('text=总分排名迁移')
    await page.waitForSelector('.chart-canvas canvas', { timeout: 8000 })
    assert((await page.locator('.chart-canvas canvas').count()) >= 1, '排名图未渲染')
    await page.waitForTimeout(800)
    await shot('04-rank')
  })

  await check('班级名称默认为“分析答案”', async () => {
    const value = await page.locator('.class-name-input input').inputValue()
    assert(value === '分析答案', `默认班级名称错误：${value}`)
  })

  const views = [
    ['各科趋势', '各科平均分趋势'],
    ['分数段分布', '总分分数段'],
    ['科目统计', '科目统计'],
    ['汇总矩阵', '汇总矩阵'],
    ['单科矩阵', '单科矩阵'],
    ['数据说明', '口径说明'],
  ]
  for (const [menu, heading] of views) {
    await check(`菜单「${menu}」可打开并渲染内容`, async () => {
      await page.getByRole('button', { name: menu, exact: true }).click()
      await page.waitForSelector(`text=${heading}`)
      await page.waitForTimeout(300)
      if (menu === '各科趋势' || menu === '分数段分布') {
        const canvas = await page.locator('.chart-canvas canvas').first().boundingBox()
        assert(canvas && canvas.width > 100 && canvas.height > 100, '图表尺寸异常')
      }
      if (['科目统计', '汇总矩阵', '单科矩阵'].includes(menu)) {
        const rows = await page.locator('.el-table__body tr').count()
        assert(rows >= 3, `${menu} 表格行数不足：${rows}`)
      }
      if (menu === '数据说明') {
        const text = await page.locator('.result-view').innerText()
        assert(text.includes('排名变化'), '说明内容缺失')
      }
    })
  }

  await check('统计页可调整及格线/优秀线并立即重算', async () => {
    await page.getByRole('button', { name: '科目统计', exact: true }).click()
    await page.waitForSelector('text=统计口径')
    const firstRow = page.locator('.el-table__body tr').first()
    const before = await firstRow.innerText()
    assert(before.includes('%'), '统计表未显示比率')
    const inputs = page.locator('.ratio-bar .el-input-number input')
    await inputs.nth(0).click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('70')
    await page.keyboard.press('Tab')
    await inputs.nth(1).click()
    await page.keyboard.press('Control+A')
    await page.keyboard.type('90')
    await page.keyboard.press('Tab')
    await page.waitForTimeout(500)
    const after = await firstRow.innerText()
    assert(after !== before, '调整比例后统计未重算')
    assert(after.includes('84'), `及格线未按 70% 计算：${after}`)
  })

  await check('汇总矩阵可按姓名搜索', async () => {
    await page.getByRole('button', { name: '汇总矩阵', exact: true }).click()
    const input = page.locator('.card .el-input input').first()
    await input.fill('张三')
    await page.waitForTimeout(300)
    const rows = await page.locator('.el-table__body tr').count()
    assert(rows === 1, `搜索结果应为 1 行，实际 ${rows}`)
    await input.fill('')
  })

  await check('单科矩阵可切换科目', async () => {
    await page.getByRole('button', { name: '单科矩阵', exact: true }).click()
    await page.locator('.el-radio-button').filter({ hasText: '数学' }).click()
    await page.waitForTimeout(300)
    const header = await page.locator('.el-table__header').innerText()
    assert(header.includes('数学'), '表头未切换到数学')
  })

  await check('打印按钮已接线', async () => {
    await page.evaluate(() => {
      window.__printed = 0
      window.print = () => {
        window.__printed += 1
      }
    })
    await page.getByRole('button', { name: '打印' }).click()
    const printed = await page.evaluate(() => window.__printed)
    assert(printed === 1, `print 未被调用：${printed}`)
  })

  await check('导出 CSV 可下载且包含表头', async () => {
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await page.getByRole('button', { name: 'CSV', exact: true }).click()
    const download = await downloadPromise
    const file = `${ART}/export.csv`
    await download.saveAs(file)
    const text = fs.readFileSync(file, 'utf8')
    assert(text.length > 50, 'CSV 内容过短')
    assert(text.includes('姓名'), 'CSV 缺少姓名表头')
  })

  await check('班级名留空时导出名使用“分析”', async () => {
    const input = page.locator('.class-name-input input')
    await input.fill('')
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await page.getByRole('button', { name: '导出 Excel' }).click()
    const download = await downloadPromise
    const name = download.suggestedFilename()
    assert(name.includes('分析'), `导出文件名未使用“分析”：${name}`)
    assert(!name.includes('24汽修'), '导出文件名仍含旧班级名')
    await input.fill('测试班')
  })

  await check('导出内容可取消“各科分表”并生成对应工作表', async () => {
    await page.getByRole('button', { name: /导出内容/ }).click()
    const dialog = page.locator('.el-dialog')
    await dialog.waitFor()
    const subjectCheckbox = dialog.locator('.el-checkbox').filter({ hasText: '各科分表' })
    await subjectCheckbox.click()
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await dialog.getByRole('button', { name: '导出 Excel' }).click()
    const download = await downloadPromise
    const file = `${ART}/export-a.xlsx`
    await download.saveAs(file)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(fs.readFileSync(file))
    const sheets = wb.worksheets.map((sheet) => sheet.name)
    assert(!sheets.includes('语文'), `不应包含语文表：${sheets}`)
    assert(sheets.includes('汇总总览') && sheets.includes('总分'), `缺少基础表：${sheets}`)
    const summary = wb.getWorksheet('汇总总览')
    assert(summary.getCell(4, 2).value === '张三', '首行应为张三')
    const headers = summary.getRow(3).values
    const a1Col = headers.findIndex((value) => value === 'a1总分')
    assert(a1Col > 0, `未找到 a1 总分列：${headers}`)
    assert(summary.getCell(4, a1Col).value === 264, `张三 a1 总分错误：${summary.getCell(4, a1Col).value}`)
    assert(summary.getCell(4, a1Col + 1).value === 1, '张三 a1 排名应为 1')
    const statsSheet = wb.getWorksheet('科目统计')
    const statsHeaders = statsSheet.getRow(3).values
    assert(statsHeaders.includes('首场及格率'), `统计表缺少及格率：${statsHeaders}`)
    assert(statsHeaders.includes('末场优秀率'), `统计表缺少优秀率：${statsHeaders}`)
    const subjectRow = statsSheet.getRow(4).values
    assert(subjectRow[1] === '语文', `统计表首行应为语文：${subjectRow[1]}`)
  })

  await check('存到本机写入历史记录', async () => {
    await page.getByRole('button', { name: '存本机' }).click()
    await page.waitForTimeout(300)
    const text = await page.locator('.view-actions').innerText()
    assert(text.includes('已存本机'), '按钮未变为已存本机')
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('grade-compare.history.v1') || '[]'))
    assert(Array.isArray(stored) && stored.length >= 1, '历史记录未写入')
  })

  await check('重新开始回到全屏上传', async () => {
    await page.locator('.reset-link').click()
    await page.waitForSelector('.landing')
    assert((await page.locator('.sidebar').count()) === 0, '侧边栏未隐藏')
  })

  await check('可从全屏上传页恢复最近分析', async () => {
    await page.getByRole('button', { name: /最近分析/ }).click()
    const dialog = page.locator('.el-dialog')
    await dialog.waitFor()
    await dialog.getByRole('button', { name: '恢复' }).click()
    await page.waitForSelector('text=总分排名迁移')
    assert((await page.locator('.sidebar').count()) === 1, '恢复后未进入工作台')
    await page.locator('.reset-link').click()
    await page.waitForSelector('.landing')
  })

  await check('无排名、无总分成绩单可上传并分析', async () => {
    await page.setInputFiles('input[type=file]', [B1, B2])
    await page.waitForSelector('text=已选择 2 份成绩单')
    await nextButton().click()
    await page.waitForSelector('text=成绩单字段确认')
    const selectText = await page.locator('.mapping-panel .el-select').nth(3).innerText()
    assert(selectText.includes('按科目求和'), `总分列未默认为求和：${selectText}`)
    await page.getByRole('button', { name: '下一步：选择场次' }).first().click()
    await page.waitForSelector('text=选择对比场次与导出内容')
    await page.getByRole('button', { name: '开始分析' }).first().click()
    await page.waitForSelector('text=总分排名迁移')
    await page.waitForTimeout(600)
    await shot('05-norank')
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
    await page.getByRole('button', { name: '导出 Excel' }).click()
    const download = await downloadPromise
    const file = `${ART}/export-b.xlsx`
    await download.saveAs(file)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(fs.readFileSync(file))
    const summary = wb.getWorksheet('汇总总览')
    const headers = summary.getRow(3).values
    const b1Col = headers.findIndex((value) => value === 'b1总分')
    assert(b1Col > 0, `未找到 b1 总分列：${headers}`)
    assert(summary.getCell(4, b1Col).value === 240, `无排名场景总分错误：${summary.getCell(4, b1Col).value}`)
    assert(summary.getCell(4, b1Col + 1).value === 1, '无排名场景排名未自动计算')
  })

  await check('手机宽度下仍可操作且无横向溢出', async () => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 1, `手机宽度横向溢出 ${overflow}px`)
    assert(await page.locator('.sidebar').isVisible(), '手机宽度侧边栏不可见')
  })

  await check('窄屏无横向溢出且侧边栏可用', async () => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.waitForTimeout(300)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    )
    assert(overflow <= 1, `横向溢出 ${overflow}px`)
    assert(await page.locator('.sidebar').isVisible(), '侧边栏不可见')
  })

  await check('手机宽度下全屏上传页无溢出', async () => {
    await page.locator('.reset-link').click()
    await page.waitForSelector('.landing')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(200)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    assert(overflow <= 1, `上传页横向溢出 ${overflow}px`)
    assert(await page.locator('.landing-upload').isVisible(), '上传区不可见')
  })

  await check('示例直达链接可用', async () => {
    const demoPage = await browser.newPage({ viewport: { width: 1280, height: 800 } })
    await demoPage.goto(`${BASE}/?demo=select`, { waitUntil: 'networkidle' })
    await demoPage.waitForSelector('text=选择对比场次与导出内容')
    assert((await demoPage.locator('.compare-item').count()) >= 3, 'demo=select 场次不足')
    await demoPage.goto(`${BASE}/?demo=mapping`, { waitUntil: 'networkidle' })
    await demoPage.waitForSelector('text=成绩单字段确认')
    assert((await demoPage.locator('.exam-aside-item').count()) >= 3, 'demo=mapping 场次不足')
    await demoPage.close()
  })

  await check('全流程无控制台错误', async () => {
    assert(consoleErrors.length === 0, consoleErrors.join(' | '))
  })
} finally {
  await browser.close()
  fs.rmSync(TMP, { recursive: true, force: true })
}

const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
if (failed.length) {
  console.log(JSON.stringify(failed, null, 2))
}
process.exit(failed.length ? 1 : 0)














