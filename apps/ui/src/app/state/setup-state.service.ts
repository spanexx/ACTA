/*
 * Code Map: Setup Wizard State
 * - SetupStateService: Owns setup wizard UI state (open/busy/step/config) and persists setup via runtime.
 * - loadConfigAndMaybeOpenWizard(): Loads profile config and opens wizard if incomplete.
 * - testOllamaEndpoint(): Calls preload API to validate endpoint + fetch models.
 * - complete(): Persists setup patch via runtime IPC and updates session trustLevel.
 *
 * CID Index:
 * CID:setup-state.service-001 -> SetupStateService (state container)
 * CID:setup-state.service-002 -> openWizard/closeWizard
 * CID:setup-state.service-003 -> loadConfigAndMaybeOpenWizard
 * CID:setup-state.service-004 -> testOllamaEndpoint
 * CID:setup-state.service-005 -> canComplete
 * CID:setup-state.service-006 -> summary
 * CID:setup-state.service-007 -> complete
 *
 * Lookup: rg -n "CID:setup-state.service-" apps/ui/src/app/state/setup-state.service.ts
 */

import { Injectable } from '@angular/core'
import type { ProfileSetupConfig, TrustLevel } from '../models/ui.models'
import { RuntimeIpcService } from '../runtime-ipc.service'
import { ChatStateService } from './chat-state.service'
import { SessionService } from './session.service'

// CID:setup-state.service-001 - Setup Wizard State Container
// Purpose: Stores setup wizard state and coordinates loading/testing/saving setup configuration.
// Uses: RuntimeIpcService (profileGet/profileUpdate), SessionService, ChatStateService, window.ActaAPI.testOllama
// Used by: Setup wizard modal component; AppShellService init; Profiles delete/switch flows
@Injectable({ providedIn: 'root' })
export class SetupStateService {
  open = false
  busy = false
  step = 1
  config: ProfileSetupConfig = {
    setupComplete: false,
    modelProvider: 'ollama',
    model: 'llama3:8b',
    endpoint: 'http://localhost:11434',
    cloudWarnBeforeSending: true,
    trustLevel: 1,
  }

  ollamaModels: string[] = ['llama3:8b']
  testStatus = ''

  constructor(
    private chat: ChatStateService,
    private session: SessionService,
    private runtimeIpc: RuntimeIpcService,
  ) {}

  // CID:setup-state.service-002 - Wizard Open/Close
  // Purpose: Toggles the setup wizard modal.
  // Uses: this.open
  // Used by: Setup wizard modal component
  openWizard(): void {
    this.open = true
  }

  closeWizard(): void {
    this.open = false
  }

  // CID:setup-state.service-003 - Load Config + Maybe Open Wizard
  // Purpose: Loads current profile config from runtime and opens wizard if setup is incomplete.
  // Uses: RuntimeIpcService.profileGet()
  // Used by: AppShellService init; profile delete/switch flows
  async loadConfigAndMaybeOpenWizard(): Promise<void> {
    try {
      const res = await this.runtimeIpc.profileGet({})
      const p = res.profile
      this.config = {
        setupComplete: Boolean(p.setupComplete),
        modelProvider: p.llm.adapterId as any,
        model: p.llm.model,
        endpoint: p.llm.endpoint,
        cloudWarnBeforeSending: p.llm.cloudWarnBeforeSending,
        trustLevel: (p.trust.defaultTrustLevel as any) ?? 1,
      }

      if (this.config.modelProvider === 'ollama') {
        const candidate = (this.config.model ?? '').trim()
        this.ollamaModels = candidate.length ? [candidate] : ['llama3:8b']
      }

      if (!this.config.setupComplete) {
        this.open = true
      }
    } catch {
      // ignore (UI scaffold only)
    }
  }

  // CID:setup-state.service-004 - Test Ollama Endpoint
  // Purpose: Validates Ollama endpoint via preload API and populates available models.
  // Uses: window.ActaAPI.testOllama()
  // Used by: Setup wizard modal component
  async testOllamaEndpoint(): Promise<void> {
    if (this.busy) return
    const endpoint = (this.config.endpoint ?? '').trim()
    if (!endpoint.length) return

    this.busy = true
    this.testStatus = 'Testing…'

    try {
      if (!window.ActaAPI) {
        this.testStatus = 'ActaAPI not available'
        return
      }

      const res = await window.ActaAPI.testOllama({ endpoint })
      if (!res.ok) {
        this.testStatus = `Failed: ${res.error ?? 'unknown error'}`
        return
      }

      const models = (res.models ?? []).filter(m => typeof m === 'string' && m.trim().length)
      if (models.length) {
        this.ollamaModels = models
        if (!this.config.model || !models.includes(this.config.model)) {
          this.config.model = models[0]
        }
      }

      this.testStatus = models.length ? `OK: ${models.length} model(s) found` : 'OK: no models found'
    } catch {
      this.testStatus = 'Failed: request error'
    } finally {
      this.busy = false
    }
  }

  // CID:setup-state.service-005 - Completion Eligibility
  // Purpose: Checks if setup config is complete enough to be saved.
  // Uses: this.config fields
  // Used by: Setup wizard UI (disable/enable save)
  canComplete(): boolean {
    const provider = this.config.modelProvider
    if (!provider) return false
    if ((this.config.trustLevel ?? null) === null) return false

    if (provider === 'ollama') {
      return !!(this.config.endpoint ?? '').trim() && !!(this.config.model ?? '').trim()
    }

    return true
  }

  // CID:setup-state.service-006 - Config Summary
  // Purpose: Returns a human-readable summary string for the current config.
  // Uses: this.config fields
  // Used by: Setup wizard UI
  summary(trustModeLabel: (level: number) => string): string {
    const provider = this.config.modelProvider ?? 'unknown'
    const trust = this.config.trustLevel === undefined ? 'unset' : trustModeLabel(this.config.trustLevel)

    if (provider === 'ollama') {
      const endpoint = (this.config.endpoint ?? '').trim() || 'unset'
      const model = (this.config.model ?? '').trim() || 'unset'
      return `Provider: Ollama • Endpoint: ${endpoint} • Model: ${model} • Trust: ${trust}`
    }

    const warn = this.config.cloudWarnBeforeSending ? 'warn before sending' : 'no warning'
    return `Provider: ${provider} • ${warn} • Trust: ${trust}`
  }

  // CID:setup-state.service-007 - Persist Setup
  // Purpose: Persists setup configuration via runtime IPC and updates local session trustLevel.
  // Uses: RuntimeIpcService.profileUpdate(), SessionService.setTrustLevel(), ChatStateService.addSystemMessage()
  // Used by: Setup wizard modal component
  async complete(): Promise<void> {
    if (!this.canComplete()) return
    if (this.busy) return

    this.busy = true
    try {
      const provider = this.config.modelProvider ?? 'ollama'
      const mode = provider === 'openai' || provider === 'anthropic' || provider === 'gemini' ? 'cloud' : 'local'

      const res = await this.runtimeIpc.profileUpdate({
        profileId: this.session.profileId,
        patch: {
          setupComplete: true,
          trust: {
            defaultTrustLevel: (this.config.trustLevel as any) ?? 1,
          },
          llm: {
            mode,
            adapterId: provider as any,
            model: this.config.model ?? 'llama3:8b',
            endpoint: this.config.endpoint,
            cloudWarnBeforeSending: this.config.cloudWarnBeforeSending,
          },
        },
      })

      this.config = {
        ...this.config,
        setupComplete: Boolean(res.profile.setupComplete),
      }

      if (typeof this.config.trustLevel === 'number') {
        const tl = this.config.trustLevel as TrustLevel
        this.session.setTrustLevel(tl)
      }

      this.open = false
      this.chat.addSystemMessage(`Setup saved for profile ${this.session.profileId}.`, Date.now())
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.busy = false
    }
  }
}
