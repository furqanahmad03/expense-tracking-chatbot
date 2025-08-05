import React, { useState } from 'react'

interface PieChartData {
  label: string
  value: number
  color: string
  emoji: string
}

interface PieChartProps {
  data: PieChartData[]
  title?: string
}

interface TooltipData {
  label: string
  value: number
  percentage: number
  emoji: string
  color: string
  x: number
  y: number
}

export default function PieChart({ data, title = "Budget Allocation" }: PieChartProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null)
  // Calculate total for percentages
  const total = data.reduce((sum, item) => sum + item.value, 0)
  
  // Calculate angles for each slice
  let currentAngle = 0
  const slices = data.map(item => {
    const percentage = (item.value / total) * 100
    const angle = (item.value / total) * 360
    const slice = {
      ...item,
      percentage,
      startAngle: currentAngle,
      endAngle: currentAngle + angle
    }
    currentAngle += angle
    return slice
  })

  // SVG dimensions
  const size = 300
  const center = size / 2
  const radius = 120

  // Function to create SVG path for pie slice
  const createPath = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(center, center, radius, endAngle)
    const end = polarToCartesian(center, center, radius, startAngle)
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1"
    
    return [
      "M", center, center,
      "L", start.x, start.y,
      "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
      "Z"
    ].join(" ")
  }

  // Convert polar coordinates to cartesian
  function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    }
  }

  // Handle mouse events for tooltip
  const handleMouseEnter = (slice: typeof slices[0], event: React.MouseEvent<SVGPathElement>) => {
    const rect = (event.currentTarget as SVGPathElement).getBoundingClientRect()
    const containerRect = (event.currentTarget.closest('.pie-chart-container') as HTMLElement)?.getBoundingClientRect()
    
    if (containerRect) {
      setTooltip({
        label: slice.label,
        value: slice.value,
        percentage: slice.percentage,
        emoji: slice.emoji,
        color: slice.color,
        x: rect.left + rect.width / 2 - containerRect.left,
        y: rect.top - containerRect.top
      })
    }
  }

  const handleMouseLeave = () => {
    setTooltip(null)
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border pie-chart-container relative">
      <h3 className="text-lg font-semibold mb-4 text-center">{title}</h3>
      
      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Pie Chart SVG */}
        <div className="flex-shrink-0 relative">
          <svg width={size} height={size} className="drop-shadow-sm">
            {slices.map((slice, index) => (
              <g key={index}>
                <path
                  d={createPath(slice.startAngle, slice.endAngle)}
                  fill={slice.color}
                  stroke="white"
                  strokeWidth="2"
                  className="hover:opacity-80 hover:stroke-4 transition-all duration-200 cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnter(slice, e)}
                  onMouseLeave={handleMouseLeave}
                />
              </g>
            ))}
            
            {/* Center circle for donut effect */}
            <circle
              cx={center}
              cy={center}
              r={40}
              fill="white"
              stroke="#e5e7eb"
              strokeWidth="2"
              className="dark:fill-gray-800 dark:stroke-gray-600"
            />
            
            {/* Total amount in center */}
            <text
              x={center}
              y={center - 5}
              textAnchor="middle"
              className="text-sm font-semibold fill-gray-700 dark:fill-gray-300"
            >
              Total
            </text>
            <text
              x={center}
              y={center + 10}
              textAnchor="middle"
              className="text-xs font-medium fill-gray-600 dark:fill-gray-400"
            >
              ${total.toLocaleString()}
            </text>
          </svg>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2 max-h-64 overflow-y-auto">
          {slices.map((slice, index) => (
            <div 
              key={index} 
              className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect()
                const containerRect = (e.currentTarget.closest('.pie-chart-container') as HTMLElement)?.getBoundingClientRect()
                
                if (containerRect) {
                  setTooltip({
                    label: slice.label,
                    value: slice.value,
                    percentage: slice.percentage,
                    emoji: slice.emoji,
                    color: slice.color,
                    x: rect.left + rect.width / 2 - containerRect.left,
                    y: rect.top - containerRect.top
                  })
                }
              }}
              onMouseLeave={handleMouseLeave}
            >
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: slice.color }}
              />
              <span className="text-sm">{slice.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{slice.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  ${slice.value.toLocaleString()} ({slice.percentage.toFixed(1)}%)
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {data.length}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Categories</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ${(total / data.length).toFixed(0)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Avg/Category</div>
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute z-10 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg pointer-events-none transition-opacity duration-200"
          style={{
            left: tooltip.x,
            top: tooltip.y - 10,
            transform: 'translate(-50%, -100%)'
          }}
        >
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: tooltip.color }}
            />
            <span className="font-medium">{tooltip.emoji} {tooltip.label}</span>
          </div>
          <div className="text-xs text-gray-300">
            <div>${tooltip.value.toLocaleString()}</div>
            <div>{tooltip.percentage.toFixed(1)}% of total</div>
          </div>
          {/* Tooltip arrow */}
          <div 
            className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"
          />
        </div>
      )}
    </div>
  )
} 