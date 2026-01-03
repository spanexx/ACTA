// Numeric trust levels aligned with Vision-Skeleton schema (0-4)
export type TrustLevel = 0 | 1 | 2 | 3 | 4

// Basic risk levels used to drive stub evaluation
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export type PermissionDecisionSource =
  | 'hard-block'
  | 'rule'
  | 'tool-default'
  | 'domain-default'
  | 'profile-default'

export interface TrustProfile {
  profileId: string
  defaultTrustLevel: TrustLevel
  modes?: {
    instruction?: TrustLevel
    suggestive?: TrustLevel
    autonomous?: TrustLevel
  }
  domains?: Record<string, TrustLevel>
  tools?: Record<string, TrustLevel>
}

export interface TrustRule {
  id: string
  createdAt?: number
  tool: string
  scopePrefix?: string
  decision: PermissionDecisionType
  remember?: 'session' | 'persistent'
}

export interface HardBlockConfig {
  blockedTools?: string[]
  blockedDomains?: string[]
  blockedScopePrefixes?: string[]
}

export interface TrustEvaluationOptions {
  hardBlock?: HardBlockConfig
  rules?: TrustRule[]
}

export interface PermissionRequest {
  id: string
  tool: string
  domain?: string
  action: string
  reason: string
  scope?: string
  risk: RiskLevel
  reversible: boolean
  timestamp: number
  profileId: string
  userId?: string
  context?: unknown
}

export type PermissionDecisionType = 'deny' | 'ask' | 'allow'

export interface PermissionDecision {
  requestId: string
  decision: PermissionDecisionType
  trustLevel: TrustLevel
  reason?: string
  source?: PermissionDecisionSource
}
