/*
 * Code Map: Planner
 * - PlannerOptions: Configuration for planner behavior
 * - PlannerToolInfo / PlannerAvailableTool: Tool metadata
 * - Planner class: Generates and validates plans via LLM
 *   - plan: Compose prompt, call LLM, parse/validate result
 *   - parsePlan: Extract JSON plan from LLM response
 *   - validatePlan: Ensure plan structure, safety, and allowed tools
 *
 * CID Index:
 * CID:planner-001 -> PlannerOptions
 * CID:planner-002 -> PlannerToolInfo
 * CID:planner-003 -> PlannerAvailableTool
 * CID:planner-004 -> Planner class
 * CID:planner-005 -> plan method
 * CID:planner-006 -> parsePlan helper
 * CID:planner-007 -> validatePlan helper
 *
 * Quick lookup: rg -n "CID:planner-" /home/spanexx/Shared/Projects/ACTA/packages/agent/src/planner.ts
 */

import type { LLMRouter, LLMRequest, LLMResponse } from '@acta/llm'
import type { AgentPlan } from '@acta/ipc'

// CID:planner-001 - PlannerOptions
// Purpose: Configure planner system prompt and blocked tools/scopes
// Used by: Planner constructor
export interface PlannerOptions {
  /** System prompt for the planner. */
  systemPrompt?: string
  /** Tool IDs or prefixes that must never appear in plans. */
  blockedTools?: string[]
  /** Tool name substrings/prefixes treated as unsafe scopes (e.g. 'shell', 'system'). */
  blockedScopes?: string[]
}

// CID:planner-002 - PlannerToolInfo
// Purpose: Describe tool metadata used when crafting prompts
export type PlannerToolInfo = {
  id: string
  description?: string
  allowedInputFields?: string[]
}

// CID:planner-003 - PlannerAvailableTool
// Purpose: Allow string tool ids or richer metadata structures
export type PlannerAvailableTool = string | PlannerToolInfo

/**
 * Planner generates an AgentPlan from user intent using an LLM.
 * Phase-1: stub prompt + basic JSON parsing/validation.
 */
// CID:planner-004 - Planner class
// Purpose: Generate structured plans while enforcing safety rules
// Uses: LLMRouter, blocked tool/scope sets
// Used by: ActaAgent during planning phase
export class Planner {
  private llm: LLMRouter
  private systemPrompt: string
  private blockedTools: Set<string>
  private blockedScopes: Set<string>

  private extractFirstJsonObject(text: string): string | null {
    const cleaned = text.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, (_m, inner) => String(inner ?? ''))

    const s = cleaned
    let start = -1
    let depth = 0
    let inString = false
    let escaped = false

    for (let i = 0; i < s.length; i++) {
      const ch = s[i]

      if (escaped) {
        escaped = false
        continue
      }

      if (inString) {
        if (ch === '\\') {
          escaped = true
          continue
        }
        if (ch === '"') {
          inString = false
        }
        continue
      }

      if (ch === '"') {
        inString = true
        continue
      }

      if (ch === '{') {
        if (depth === 0) start = i
        depth++
        continue
      }

      if (ch === '}') {
        if (depth > 0) depth--
        if (depth === 0 && start >= 0) {
          return s.slice(start, i + 1)
        }
      }
    }

    return null
  }

  private safeSnippet(text: string, max = 900): string {
    return text.replace(/\s+/g, ' ').trim().slice(0, max)
  }

  private normalizePlanInputs(plan: AgentPlan, userInput: string): AgentPlan {
    for (const step of plan.steps ?? []) {
      if (!step || typeof step !== 'object') continue
      if (!step.input || typeof step.input !== 'object' || Array.isArray(step.input)) {
        step.input = {}
      }

      if (step.tool === 'explain.content') {
        const text = (step.input as any).text
        if (typeof text !== 'string' || !text.trim().length) {
          ;(step.input as any).text = userInput
        }
      }
    }
    return plan
  }

  constructor(llm: LLMRouter, options?: PlannerOptions) {
    this.llm = llm
    this.blockedTools = new Set(options?.blockedTools ?? [])
    this.blockedScopes = new Set(options?.blockedScopes ?? ['shell', 'system'])
    this.systemPrompt =
      options?.systemPrompt ??
      `You are Acta, a helpful AI assistant. Given a user request, generate a structured plan.
Return JSON with this schema:
{
  "goal": "brief goal description",
  "steps": [
    { "id": "step-1", "tool": "tool_id", "intent": "what this step does", "input": {}, "requiresPermission": true/false }
  ]
}
Return ONLY valid JSON. Do not wrap in markdown or add any extra text.
Only use known tool IDs.
Never use shell/system tools or any tool that looks like it can run arbitrary commands.`
  }

  /**
   * Generate a plan for the given user input.
   * Returns a validated AgentPlan.
   */
  // CID:planner-005 - plan
  // Purpose: Build LLM prompt, call LLM, parse and validate resulting plan
  async plan(input: string, availableTools: PlannerAvailableTool[]): Promise<AgentPlan> {
    const toolInfos: PlannerToolInfo[] = availableTools.map(t =>
      typeof t === 'string'
        ? { id: t }
        : {
            id: t.id,
            description: t.description,
            allowedInputFields: t.allowedInputFields,
          },
    )

    const toolIds = toolInfos.map(t => t.id)
    const toolsBlock = toolInfos
      .map(t => {
        const desc = typeof t.description === 'string' && t.description.trim().length ? ` — ${t.description}` : ''
        const fields =
          Array.isArray(t.allowedInputFields) && t.allowedInputFields.length
            ? ` (allowed input fields: ${t.allowedInputFields.join(', ')})`
            : ''
        return `- ${t.id}${desc}${fields}`
      })
      .join('\n')

    const prohibitions = `Prohibited tools/scopes:\n- shell.*\n- system.*\nRules:\n- Each step.input MUST be a JSON object ({}).\n- Do not include extra keys in input that are not necessary.`

    const prompt = `User request:\n${input}\n\nAvailable tools (id + description):\n${toolsBlock}\n\n${prohibitions}\n\nGenerate a plan as JSON.`

    const llmRequest: LLMRequest = {
      prompt,
      system: this.systemPrompt,
      maxTokens: 1000,
    }

    const response: LLMResponse = await this.llm.generate(llmRequest)

    const plan = this.normalizePlanInputs(this.parsePlan(response.text), input)
    this.validatePlan(plan, toolIds)
    return plan
  }

  // CID:planner-006 - parsePlan
  // Purpose: Extract JSON plan block from LLM response text
  // Uses: Regex for ```json code fences
  private parsePlan(text: string): AgentPlan {
    const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i) || text.match(/```\s*([\s\S]*?)\s*```/i)
    const primary = (fenced?.[1] ?? text).trim()

    const candidates: string[] = []
    if (primary.length) candidates.push(primary)

    const extracted = this.extractFirstJsonObject(text)
    if (extracted) candidates.push(extracted)

    let lastErr: unknown
    for (const c of candidates) {
      const jsonStr = c.trim()
      if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
        continue
      }

      try {
        const parsed = JSON.parse(jsonStr)

        if (!parsed.goal || !Array.isArray(parsed.steps)) {
          lastErr = new Error('Invalid plan structure: missing goal or steps')
          continue
        }

        return parsed as AgentPlan
      } catch (err) {
        lastErr = err
      }
    }

    console.warn('[Planner] Failed to parse plan JSON', {
      snippet: this.safeSnippet(text),
    })

    throw (lastErr instanceof Error ? lastErr : new Error('Failed to extract JSON plan from LLM response'))
  }

  // CID:planner-007 - validatePlan
  // Purpose: Ensure plan goal/steps valid, enforce blocked tools/scopes and input rules
  private validatePlan(plan: AgentPlan, availableTools: string[]): void {
    if (!plan.goal || typeof plan.goal !== 'string') {
      throw new Error('Plan must have a non-empty goal')
    }

    if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
      throw new Error('Plan must have at least one step')
    }

    const stepIds = new Set<string>()
    for (const step of plan.steps) {
      if (!step.id || typeof step.id !== 'string') {
        throw new Error('Each step must have a non-empty id')
      }

      if (stepIds.has(step.id)) {
        throw new Error(`Duplicate step id: ${step.id}`)
      }
      stepIds.add(step.id)

      if (!step.tool || typeof step.tool !== 'string') {
        throw new Error(`Step ${step.id} must have a tool`)
      }

      if (this.blockedTools.has(step.tool)) {
        throw new Error(`Step ${step.id} uses blocked tool: ${step.tool}`)
      }

      for (const scope of this.blockedScopes) {
        if (step.tool.startsWith(scope + '.') || step.tool.includes(scope)) {
          throw new Error(`Step ${step.id} uses unsafe scope: ${scope}`)
        }
      }

      if (!availableTools.includes(step.tool)) {
        throw new Error(`Step ${step.id} uses unknown tool: ${step.tool}`)
      }

      if (!step.input || typeof step.input !== 'object' || Array.isArray(step.input)) {
        throw new Error(`Step ${step.id} must include an input object`)
      }

      if (step.tool === 'explain.content') {
        const text = (step.input as any)?.text
        if (typeof text !== 'string' || !text.trim().length) {
          throw new Error(`Step ${step.id} explain.content requires input.text`)
        }
      }

      if (typeof step.requiresPermission !== 'boolean') {
        throw new Error(`Step ${step.id} requiresPermission must be boolean`)
      }
    }
  }
}
