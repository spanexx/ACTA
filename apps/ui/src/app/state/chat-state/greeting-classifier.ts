/**
 * Code Map: Greeting Classifier
 * - normalizeGreetingText: normalizes draft text for deterministic greeting detection
 * - isObviousGreeting: strict allowlist check for obvious greetings/smalltalk
 * - shouldAutoChat: conservative routing rule used by ChatStateService.send()
 *
 * CID Index:
 * CID:greeting-classifier-001 -> normalizeGreetingText
 * CID:greeting-classifier-002 -> isObviousGreeting
 * CID:greeting-classifier-003 -> shouldAutoChat
 *
 * Quick lookup: rg -n "CID:greeting-classifier-" apps/ui/src/app/state/chat-state/greeting-classifier.ts
 */

import type { ChatMessageLane } from '../../models/ui.models'

// CID:greeting-classifier-001 - normalizeGreetingText
// Purpose: Deterministically normalize a draft string for matching.
// Uses: string trim/lowercase + simple regex cleanup.
// Used by: isObviousGreeting().
function normalizeGreetingText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\t\n\r]+/g, ' ')
    .replace(/[.!?,;:]+/g, '')
    .replace(/\s+/g, ' ')
}

// CID:greeting-classifier-002 - isObviousGreeting
// Purpose: Strict allowlist check for obvious greetings/smalltalk (no guessing).
// Uses: normalizeGreetingText().
// Used by: shouldAutoChat().
export function isObviousGreeting(text: string): boolean {
  const t = normalizeGreetingText(text)
  if (!t.length) return false

  if (t === 'hi') return true
  if (t === 'hello') return true
  if (t === 'hey') return true
  if (t === 'how are you') return true

  return false
}

// CID:greeting-classifier-003 - shouldAutoChat
// Purpose: Conservative auto-routing rule: only auto-Chat when clearly a greeting.
// Uses: isObviousGreeting().
// Used by: ChatStateService.send().
export function shouldAutoChat(opts: {
  mode: ChatMessageLane
  draft: string
  pendingAttachmentsCount: number
}): boolean {
  if (opts.mode !== 'task') return false
  if (opts.pendingAttachmentsCount > 0) return false
  return isObviousGreeting(opts.draft)
}
