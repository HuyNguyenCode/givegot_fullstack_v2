'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { SkillDemandEntry } from '@/actions/analytics'

interface Props {
  data: SkillDemandEntry[]
  isLoading?: boolean
}

interface TooltipPayload {
  name: string
  value: number
  color: string
}

const CustomTooltip = ({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) => {
  if (active && payload && payload.length) {
    const demand = payload.find((p) => p.name === 'demand')?.value ?? 0
    const supply = payload.find((p) => p.name === 'supply')?.value ?? 0
    const gap = Math.max(0, demand - supply)
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 min-w-[140px]">
        <p className="text-xs font-semibold text-gray-700 mb-2 truncate">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2 text-xs mb-1">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500 capitalize">{p.name}:</span>
            <span className="font-bold text-gray-800">{p.value}</span>
          </div>
        ))}
        {gap > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <span className="text-xs text-orange-600 font-semibold">Gap: {gap} unmet</span>
          </div>
        )}
      </div>
    )
  }
  return null
}

export default function SkillDemandChart({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-400">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">No skill data available yet</p>
      </div>
    )
  }

  // Truncate long skill names for the axis
  const chartData = data.map((d) => ({
    ...d,
    skill: d.skill.length > 12 ? d.skill.slice(0, 11) + '…' : d.skill,
    fullSkill: d.skill,
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart
        data={chartData}
        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        barCategoryGap="30%"
        barGap={2}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="skill"
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
          formatter={(value) => (
            <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>{value}</span>
          )}
        />
        <Bar dataKey="demand" fill="#6d28d9" radius={[4, 4, 0, 0]} name="demand" />
        <Bar dataKey="supply" fill="#10b981" radius={[4, 4, 0, 0]} name="supply" />
      </BarChart>
    </ResponsiveContainer>
  )
}
