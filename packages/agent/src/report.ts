import type { AgentPlan, ToolResult } from '@acta/ipc'

export function collectArtifacts(results: ToolResult[]): string[] {
  const out: string[] = []
  for (const r of results) {
    if (!r || !Array.isArray(r.artifacts)) continue
    for (const a of r.artifacts) {
      if (typeof a === 'string' && a.trim().length) out.push(a)
    }
  }
  return out
}

export function buildDeterministicTaskReport(opts: {
  goal?: string
  plan: AgentPlan
  results: ToolResult[]
}): string {
  const goal = typeof opts.goal === 'string' && opts.goal.trim().length ? opts.goal.trim() : opts.plan.goal
  const results = Array.isArray(opts.results) ? opts.results : []

  const artifacts = collectArtifacts(results)

  const lines: string[] = []
  lines.push(`Report`)
  lines.push(`Goal: ${goal}`)
  lines.push('')

  lines.push('Steps:')
  for (let i = 0; i < opts.plan.steps.length; i++) {
    const step = opts.plan.steps[i]
    const res = results[i]

    const status = res ? (res.success ? 'completed' : 'failed') : 'skipped'
    const tool = typeof step?.tool === 'string' ? step.tool : 'tool'
    const intent = typeof step?.intent === 'string' ? step.intent : ''

    lines.push(`${i + 1}. [${status}] ${tool}${intent ? ` — ${intent}` : ''}`)

    if (res && !res.success && typeof res.error === 'string' && res.error.trim().length) {
      lines.push(`   Error: ${res.error}`)
    }

    if (res && Array.isArray(res.artifacts) && res.artifacts.length) {
      lines.push(`   Artifacts:`)
      for (const a of res.artifacts) {
        if (typeof a === 'string' && a.trim().length) lines.push(`   - ${a}`)
      }
    }
  }

  lines.push('')
  lines.push(`Outcome: ${results.every(r => r.success) ? 'success' : 'partial/failure'}`)

  if (artifacts.length) {
    lines.push('')
    lines.push('All artifacts:')
    for (const a of artifacts) lines.push(`- ${a}`)
  }

  return lines.join('\n')
}
