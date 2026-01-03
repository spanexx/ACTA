/**
 * Code Map: Permission UI Label Utilities
 * - Provides label and icon functions for permission request UI display
 * 
 * CID Index:
 * CID:labels-001 -> leadIcon function
 * CID:labels-002 -> cloudLabel function
 * CID:labels-003 -> riskLabel function
 * CID:labels-004 -> trustModeLabel function
 * CID:labels-005 -> primaryEffect function
 * CID:labels-006 -> secondaryEffect function
 * CID:labels-007 -> folderScope function
 * CID:labels-008 -> permissionDecisionLabel function
 * 
 * Quick lookup: grep -n "CID:labels-" /home/spanexx/Shared/Projects/ACTA/apps/ui/src/app/state/permission-state/labels.ts
 */

import type { PermissionDecision, PermissionRequestEvent } from '../../models/ui.models'

/**
 * CID:labels-001 - leadIcon Function
 * Purpose: Returns appropriate icon for permission request based on tool/cloud
 * Uses: PermissionRequestEvent properties
 * Used by: Permission UI components for visual indicators
 */
export function leadIcon(request: PermissionRequestEvent): string {
  if (request.cloud) return '☁️'
  if (request.tool.includes('convert')) return '📄'
  return '🛡️'
}

/**
 * CID:labels-002 - cloudLabel Function
 * Purpose: Generates label for cloud provider and model information
 * Uses: PermissionRequestEvent.cloud property
 * Used by: Permission UI for displaying cloud context
 */
export function cloudLabel(request: PermissionRequestEvent): string {
  if (!request.cloud) return 'local'
  if (!request.cloud.model) return request.cloud.provider
  return `${request.cloud.provider} (${request.cloud.model})`
}

/**
 * CID:labels-003 - riskLabel Function
 * Purpose: Combines risk and risks into a single display string
 * Uses: PermissionRequestEvent.risk and .risks properties
 * Used by: Permission UI for risk information display
 */
export function riskLabel(request: PermissionRequestEvent): string {
  const lines: string[] = []
  if (request.risk) lines.push(request.risk)
  if (request.risks?.length) lines.push(...request.risks)
  return lines.join(' • ')
}

/**
 * CID:labels-004 - trustModeLabel Function
 * Purpose: Converts numeric trust level to human-readable label
 * Uses: Simple numeric level mapping
 * Used by: Permission UI for trust level display
 */
export function trustModeLabel(level: number): string {
  if (level <= 0) return 'Deny (0)'
  if (level === 1) return 'Ask every time (1)'
  if (level === 2) return 'Ask once (2)'
  if (level === 3) return 'Allow (3)'
  return `Trust level ${level}`
}

/**
 * CID:labels-005 - primaryEffect Function
 * Purpose: Generates human-readable description of primary tool effect
 * Uses: PermissionRequestEvent.tool property
 * Used by: Permission UI for effect description
 */
export function primaryEffect(request: PermissionRequestEvent): string {
  if (request.tool.includes('file.read')) return 'Read the specified file'
  if (request.tool.includes('file.convert')) return 'Read the input file and write a converted output'
  if (request.tool.includes('file.write')) return 'Write a file to your system'
  return 'Execute the requested tool'
}

/**
 * CID:labels-006 - secondaryEffect Function
 * Purpose: Generates description of secondary effects (cloud vs local)
 * Uses: PermissionRequestEvent.cloud property, cloudLabel helper
 * Used by: Permission UI for secondary effect display
 */
export function secondaryEffect(request: PermissionRequestEvent): string {
  if (request.cloud) {
    return `May send content to ${cloudLabel(request)}`
  }
  return 'Process it locally'
}

/**
 * CID:labels-007 - folderScope Function
 * Purpose: Extracts folder scope from file path for permission display
 * Uses: PermissionRequestEvent.scope and .input properties
 * Used by: Permission UI for folder scope display
 */
export function folderScope(request: PermissionRequestEvent): string | null {
  const basis = request.scope ?? request.input
  if (!basis) return null

  const normalized = basis.replace(/\\/g, '/')
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return null

  return `${normalized.slice(0, idx)}/*`
}

/**
 * CID:labels-008 - permissionDecisionLabel Function
 * Purpose: Converts PermissionDecision enum to display labels
 * Uses: PermissionDecision type from ui.models
 * Used by: Permission UI for decision button labels
 */
export function permissionDecisionLabel(decision: PermissionDecision): string {
  if (decision === 'deny') return 'Deny'
  if (decision === 'allow_always') return 'Always allow'
  return 'Allow once'
}
