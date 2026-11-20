import { chromium } from 'playwright-core'
import ExcelJS from 'exceljs'
import fs from 'node:fs'

const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const browser = await chromium.launch({ executablePath: edge, headless: true })
const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (error) => errors.push(String(error)))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})

await page.goto('http://localhost:4173/?demo=1', { waitUntil: 'networkidle' })
await page.waitForSelector('text=导出 Excel', { timeout: 15000 })

const downloadPromise = page.waitForEvent('download', { timeout: 30000 })
await page.getByRole('button', { name: '导出 Excel' }).click()
const download = await downloadPromise
const path = 'D:/github/grade-compare/.shots/export-smoke.xlsx'
await download.saveAs(path)
await page.waitForTimeout(500)

const workbook = new ExcelJS.Workbook()
await workbook.xlsx.load(fs.readFileSync(path))
const sheets = workbook.worksheets.map((sheet) => sheet.name)
console.log(JSON.stringify({ sheets, errors, downloadName: download.suggestedFilename() }, null, 2))

await page.screenshot({ path: 'D:/github/grade-compare/.shots/smoke.png' })
await browser.close()
