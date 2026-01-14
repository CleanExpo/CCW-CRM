"use client"

import { useEffect, useState } from "react"
import { AlertCircle, CheckCircle2, Info, Lightbulb, TrendingUp } from "lucide-react"

interface Insight {
  insight_id: string
  insight_type: string
  agent_id: string
  priority: "high" | "medium" | "low"
  title: string
  description: string
  recommended_action: string
  expected_improvement: number
  supporting_patterns: string[]
  created_at: string
}

interface LearningInsightsProps {
  refreshInterval?: number
}

export function LearningInsights({ refreshInterval = 30000 }: LearningInsightsProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInsights = async () => {
      try {
        const res = await fetch("/api/agents/insights")
        const data = await res.json()
        setInsights(data.insights || [])
      } catch (error) {
        console.error("Failed to fetch insights:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchInsights()
    const interval = setInterval(fetchInsights, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  if (loading) {
    return <LearningInsightsSkeleton />
  }

  if (insights.length === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow text-center">
        <Lightbulb className="mx-auto h-12 w-12 text-gray-400 mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Insights Yet</h3>
        <p className="text-gray-600">
          Insights will appear as the system learns from agent execution patterns.
        </p>
      </div>
    )
  }

  // Group by priority
  const highPriority = insights.filter((i) => i.priority === "high")
  const mediumPriority = insights.filter((i) => i.priority === "medium")
  const lowPriority = insights.filter((i) => i.priority === "low")

  return (
    <div className="space-y-4">
      {/* High Priority Insights */}
      {highPriority.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-red-700 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            High Priority ({highPriority.length})
          </h3>
          <div className="space-y-3">
            {highPriority.map((insight) => (
              <InsightCard key={insight.insight_id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Medium Priority Insights */}
      {mediumPriority.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-orange-700 mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Medium Priority ({mediumPriority.length})
          </h3>
          <div className="space-y-3">
            {mediumPriority.map((insight) => (
              <InsightCard key={insight.insight_id} insight={insight} />
            ))}
          </div>
        </div>
      )}

      {/* Low Priority Insights */}
      {lowPriority.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-blue-700 mb-3 flex items-center gap-2">
            <Info className="h-5 w-5" />
            Low Priority ({lowPriority.length})
          </h3>
          <div className="space-y-3">
            {lowPriority.map((insight) => (
              <InsightCard key={insight.insight_id} insight={insight} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function InsightCard({ insight }: { insight: Insight }) {
  const priorityColors = {
    high: "border-l-red-500 bg-red-50",
    medium: "border-l-orange-500 bg-orange-50",
    low: "border-l-blue-500 bg-blue-50",
  }

  const typeIcons = {
    error_prevention: AlertCircle,
    process_optimization: TrendingUp,
    prompt_improvement: Lightbulb,
  }

  const Icon = typeIcons[insight.insight_type as keyof typeof typeIcons] || Info

  return (
    <div
      className={`bg-white p-4 rounded-lg shadow border-l-4 ${priorityColors[insight.priority]} hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-1 text-gray-700 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h4 className="font-semibold text-gray-900">{insight.title}</h4>
            <span className="text-xs font-medium text-gray-600 whitespace-nowrap">
              {insight.agent_id.replace("_", " ")}
            </span>
          </div>
          <p className="text-sm text-gray-700 mb-3">{insight.description}</p>
          <div className="bg-white p-3 rounded border border-gray-200 mb-2">
            <p className="text-xs font-medium text-gray-600 mb-1">Recommended Action:</p>
            <p className="text-sm text-gray-800">{insight.recommended_action}</p>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-600">
            <div className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Expected improvement: {insight.expected_improvement}%
            </div>
            <span>{new Date(insight.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LearningInsightsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bg-white p-4 rounded-lg shadow animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-4 bg-gray-200 rounded w-full mb-2" />
          <div className="h-4 bg-gray-200 rounded w-5/6" />
        </div>
      ))}
    </div>
  )
}
