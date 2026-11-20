import { useEffect, useRef } from 'react'
import { loadECharts } from '../lib/echarts'

interface ChartProps {
  option: Record<string, unknown>
  height?: number
}

export function Chart({ option, height = 320 }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let chart: import('echarts/core').ECharts | null = null
    let disposed = false

    loadECharts().then((echarts) => {
      if (!containerRef.current || disposed) return
      chart = echarts.init(containerRef.current, undefined, { renderer: 'canvas' })
      chart.setOption(option)
    })

    const onResize = () => chart?.resize()
    window.addEventListener('resize', onResize)

    return () => {
      disposed = true
      window.removeEventListener('resize', onResize)
      chart?.dispose()
      chart = null
    }
  }, [option])

  return <div ref={containerRef} className="chart-canvas" style={{ height }} />
}
