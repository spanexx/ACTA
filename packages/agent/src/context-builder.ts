import type { RuntimeTask } from '@acta/ipc'

export type ContextToolInfo = {
  id: string
  description?: string
}

export type ContextMemoryEntry = {
  key: string
  value: any
  timestamp: number
}

export type BuildTaskContextV1Options = {
  task: RuntimeTask
  tools: ContextToolInfo[]
  memoryEntries?: ContextMemoryEntry[]
  trust?: {
    trustLevel?: number
    profileId?: string
  }
  llm?: {
    providerId?: string
    model?: string
  }
  limits?: {
    maxChars?: number
    maxMemoryEntries?: number
    maxToolEntries?: number
    maxAttachmentEntries?: number
    maxMemoryValueChars?: number
    maxToolDescriptionChars?: number
  }
}

function safeStringify(value: any): string {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function clampString(s: string, maxChars: number): string {
  if (maxChars <= 0) return ''
  if (s.length <= maxChars) return s
  return s.slice(0, maxChars)
}

export function buildTaskContextV1(opts: BuildTaskContextV1Options): string {
  const maxChars = opts.limits?.maxChars ?? 6000
  const maxMemoryEntries = opts.limits?.maxMemoryEntries ?? 10
  const maxToolEntries = opts.limits?.maxToolEntries ?? 50
  const maxAttachmentEntries = opts.limits?.maxAttachmentEntries ?? 20
  const maxMemoryValueChars = opts.limits?.maxMemoryValueChars ?? 400
  const maxToolDescriptionChars = opts.limits?.maxToolDescriptionChars ?? 120

  const attachments = opts.task.attachments ?? []
  const tools = (opts.tools ?? []).slice(0, maxToolEntries)

  const metaLines: string[] = []
  if (typeof opts.trust?.trustLevel === 'number') metaLines.push(`trustLevel: ${opts.trust.trustLevel}`)
  if (typeof opts.trust?.profileId === 'string' && opts.trust.profileId.trim().length)
    metaLines.push(`profileId: ${opts.trust.profileId}`)
  if (typeof opts.llm?.providerId === 'string' && opts.llm.providerId.trim().length)
    metaLines.push(`llmProvider: ${opts.llm.providerId}`)
  if (typeof opts.llm?.model === 'string' && opts.llm.model.trim().length) metaLines.push(`llmModel: ${opts.llm.model}`)

  const renderAttachments = (count: number): string => {
    if (!attachments.length || count <= 0) return 'Attachments: (none)'
    return `Attachments (paths only):\n- ${attachments.slice(0, count).join('\n- ')}`
  }

  const renderTools = (count: number): string => {
    if (!tools.length || count <= 0) return 'Available tools: (none)'
    return `Available tools:\n${tools
      .slice(0, count)
      .map(t => {
        const desc = typeof t.description === 'string' ? clampString(t.description, maxToolDescriptionChars) : ''
        return desc.length ? `- ${t.id}: ${desc}` : `- ${t.id}`
      })
      .join('\n')}`
  }

  const memory = opts.memoryEntries ?? []
  const memorySorted = memory.slice().sort((a, b) => a.timestamp - b.timestamp)
  const recentMemory = memorySorted.slice(Math.max(0, memorySorted.length - maxMemoryEntries))

  const renderMemory = (count: number, valueChars: number): string => {
    if (!recentMemory.length || count <= 0) return 'Recent memory: (none)'
    const slice = recentMemory.slice(Math.max(0, recentMemory.length - count))
    return `Recent memory (most recent last):\n${slice
      .map(e => {
        const raw = safeStringify(e.value)
        const clipped = clampString(raw, valueChars)
        return `- ${e.key}: ${clipped}`
      })
      .join('\n')}`
  }

  const metaBlock = metaLines.length ? `Metadata:\n${metaLines.map(l => `- ${l}`).join('\n')}` : 'Metadata: (none)'

  const userInputBlock = `User input:\n${opts.task.input}`
  const desiredAttachmentCount = Math.min(attachments.length, maxAttachmentEntries)
  const desiredToolCount = tools.length
  const desiredMemoryCount = recentMemory.length

  let out = [
    userInputBlock,
    renderAttachments(desiredAttachmentCount),
    metaBlock,
    renderTools(desiredToolCount),
    renderMemory(desiredMemoryCount, maxMemoryValueChars),
  ].join('\n\n')
  if (out.length <= maxChars) return out

  // Trim strategy when over budget:
  // - keep memory as long as possible
  // - trim tools first, then attachments
  // - if still too large, shrink memory value snippets before dropping memory entries
  for (let memCount = desiredMemoryCount; memCount >= 0; memCount--) {
    for (let attachCount = desiredAttachmentCount; attachCount >= 0; attachCount--) {
      for (let toolCount = desiredToolCount; toolCount >= 0; toolCount--) {
        for (let memValueChars = maxMemoryValueChars; memValueChars >= 0; memValueChars = memValueChars > 100 ? memValueChars - 100 : memValueChars - 20) {
          if (memValueChars < 0) break
          out = [
            userInputBlock,
            renderAttachments(attachCount),
            metaBlock,
            renderTools(toolCount),
            renderMemory(memCount, memValueChars),
          ].join('\n\n')
          if (out.length <= maxChars) return out

          if (memValueChars === 0) break
        }
      }
    }
  }

  return clampString(out, maxChars)
}
