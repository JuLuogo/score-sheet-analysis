type EChartsModule = typeof import('echarts/core')

let loader: Promise<EChartsModule> | null = null

export function loadECharts(): Promise<EChartsModule> {
  if (!loader) {
    loader = (async () => {
      const [core, charts, components, renderers] = await Promise.all([
        import('echarts/core'),
        import('echarts/charts'),
        import('echarts/components'),
        import('echarts/renderers'),
      ])
      core.use([
        charts.BarChart,
        charts.LineChart,
        components.GridComponent,
        components.TooltipComponent,
        components.LegendComponent,
        components.TitleComponent,
        components.DatasetComponent,
        components.MarkLineComponent,
        renderers.CanvasRenderer,
      ])
      return core
    })()
  }
  return loader
}

export const CHART_COLORS = {
  base: '#b4c6e7',
  target: '#1f3864',
  up: '#70ad47',
  flat: '#d9d9d9',
  down: '#c0504d',
  accent: '#c55a11',
}

export const CHART_FONT = {
  fontFamily:
    '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", "Source Han Sans SC", system-ui, sans-serif',
}
