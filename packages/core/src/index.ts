// Core package entry (Phase-1 scaffold)
export const CORE_VERSION = "0.1.0"
export function ok(): boolean { return true }

// Configuration provider
export { loadConfig, type ActaConfig } from './config'

// Tool types
export * from './types/tool'
