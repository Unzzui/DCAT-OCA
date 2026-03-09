'use client'

import { useRef, useEffect } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, LineChart, ScatterChart, PieChart, GaugeChart } from 'echarts/charts'
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart, LineChart, ScatterChart, PieChart, GaugeChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
  DataZoomComponent, ToolboxComponent, MarkLineComponent,
  CanvasRenderer,
])

interface EChartProps {
  option: echarts.EChartsCoreOption
  height?: string
  className?: string
  onEvents?: Record<string, (params: any) => void>
}

export function EChart({ option, height = '350px', className = '', onEvents }: EChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)
  const eventsRef = useRef(onEvents)
  eventsRef.current = onEvents

  // Init chart + ResizeObserver for container visibility changes (tab switches)
  useEffect(() => {
    if (!chartRef.current) return

    const el = chartRef.current
    const chart = echarts.init(el)
    instanceRef.current = chart
    chart.setOption(option)

    // ResizeObserver catches tab reveals (display:none → block) and window resizes
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        chart.resize()
      }
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.dispose()
      instanceRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (instanceRef.current) {
      instanceRef.current.setOption(option, { notMerge: true })
    }
  }, [option])

  // Rebind events whenever onEvents changes
  useEffect(() => {
    const chart = instanceRef.current
    if (!chart) return
    chart.off('click')
    chart.off('mouseover')
    chart.off('mouseout')
    if (onEvents) {
      Object.entries(onEvents).forEach(([event, handler]) => {
        chart.on(event, handler)
      })
    }
  }, [onEvents])

  return <div ref={chartRef} style={{ height }} className={className} />
}
