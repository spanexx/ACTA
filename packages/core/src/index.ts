/*
 * Code Map: Core Package Entry
 * - CORE_VERSION constant and ok helper
 * - Re-exports for config loader and tool types
 *
 * CID Index:
 * CID:core-index-001 -> CORE_VERSION constant & ok()
 * CID:core-index-002 -> config exports
 * CID:core-index-003 -> tool type re-exports
 *
 * Quick lookup: rg -n "CID:core-index-" /home/spanexx/Shared/Projects/ACTA/packages/core/src/index.ts
 */

// CID:core-index-001 - CORE_VERSION & ok helper
// Purpose: Surface core package version and simple health check
export const CORE_VERSION = "0.1.0"
export function ok(): boolean { return true }

// CID:core-index-002 - config exports
// Purpose: Re-export loadConfig and ActaConfig for consumers
export { loadConfig, type ActaConfig } from './config'

// CID:core-index-003 - tool type exports
// Purpose: Re-export shared tool type definitions
export * from './types/tool'
