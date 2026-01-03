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
    apiKey: '',
    headers: '',
    cloudWarnBeforeSending: true,
    trustLevel: 1,
  }

  ollamaModels: string[] = ['llama3:8b']
  cloudModels: string[] = []
  testStatus = ''

  private storageProfileId = 'default'

  constructor(
    private chat: ChatStateService,
    private session: SessionService,
    private runtimeIpc: RuntimeIpcService,
  ) {
    this.storageProfileId = this.session.profileId
    this.restoreDraft()

    this.session.profileId$.subscribe(profileId => {
      if (!profileId || profileId === this.storageProfileId) return
      this.persistDraft()
      this.storageProfileId = profileId
      this.restoreDraft()
    })
  }

  private storageKey(): string {
    return `acta:ui:setupDraft:${this.storageProfileId}`
  }

  persistDraft(): void {
    try {
      globalThis.localStorage?.setItem(
        this.storageKey(),
        JSON.stringify({
          step: this.step,
          config: this.config,
        }),
      )
    } catch {
    }
  }

  private restoreDraft(): void {
    try {
      const raw = globalThis.localStorage?.getItem(this.storageKey())
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return

      if (typeof (parsed as any).step === 'number') this.step = (parsed as any).step
      const cfg = (parsed as any).config
      if (cfg && typeof cfg === 'object') {
        this.config = {
          ...this.config,
          ...cfg,
          setupComplete: this.config.setupComplete,
        }
      }
    } catch {
    }
  }

  // CID:setup-state.service-002 - Wizard Open/Close
  // Purpose: Toggles the setup wizard modal.
  // Uses: this.open
  // Used by: Setup wizard modal component
  openWizard(): void {
    this.open = true
    this.persistDraft()
  }

  closeWizard(): void {
    this.open = false
    this.persistDraft()
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
        endpoint: p.llm.endpoint ?? p.llm.baseUrl,
        apiKey: '',
        headers: p.llm && (p.llm as any).headers ? JSON.stringify((p.llm as any).headers, null, 2) : '',
        cloudWarnBeforeSending: p.llm.cloudWarnBeforeSending ?? true,
        trustLevel: (p.trust.defaultTrustLevel as any) ?? 1,
      }

      if (this.config.modelProvider === 'ollama') {
        const candidate = (this.config.model ?? '').trim()
        this.ollamaModels = candidate.length ? [candidate] : ['llama3:8b']
      }

      this.cloudModels = []

      if (!this.config.setupComplete) {
        this.open = true
      }

      this.restoreDraft()
    } catch {
      // ignore (UI scaffold only)
    }
  }

  // CID:setup-state.service-004 - Test Ollama Endpoint
  // Purpose: Validates Ollama endpoint via preload API and populates available models.
  // Uses: window.ActaAPI.testOllama()
  // Used by: Setup wizard modal component
  async testConnection(): Promise<void> {
    if (this.busy) return

    const provider = this.config.modelProvider
    if (!provider) return

    if (provider !== 'ollama') {
      this.ollamaModels = this.ollamaModels
    }

    const endpoint = (this.config.endpoint ?? '').trim()
    const apiKey = (this.config.apiKey ?? '').trim()
    const headersText = (this.config.headers ?? '').trim()

    const isLocal = provider === 'ollama' || provider === 'lmstudio' || provider === 'custom'
    const isCloud = provider === 'openai' || provider === 'anthropic' || provider === 'gemini'

    if (isLocal) {
      if (!endpoint.length) return
    }

    if (isCloud) {
      if (!apiKey.length) return
    }

    this.busy = true
    this.testStatus = 'Testing…'

    console.log(`[UI Setup State] Testing LLM connection:`, {
      provider,
      mode: isCloud ? 'cloud' : 'local',
      endpoint: isLocal ? endpoint : undefined,
      hasApiKey: isCloud ? !!apiKey : undefined,
      model: this.config.model
    })

    try {
      let headers: Record<string, string> | undefined
      if (provider === 'custom' && headersText.length) {
        try {
          const parsed = JSON.parse(headersText)
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            this.testStatus = 'Failed: headers must be a JSON object'
            return
          }
          const out: Record<string, string> = {}
          for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof k !== 'string' || !k.trim()) {
              this.testStatus = 'Failed: headers contains an invalid header name'
              return
            }
            if (typeof v !== 'string') {
              this.testStatus = `Failed: header ${k} must be a string`
              return
            }
            out[k] = v
          }
          headers = out
        } catch {
          this.testStatus = 'Failed: invalid headers JSON'
          return
        }
      }

      const res = await this.runtimeIpc.llmHealthCheck({
        profileId: this.session.profileId,
        config: {
          mode: isCloud ? 'cloud' : 'local',
          adapterId: provider,
          model: (this.config.model ?? '').trim() || undefined,
          baseUrl: isLocal && endpoint.length ? endpoint : undefined,
          endpoint: isLocal && endpoint.length ? endpoint : undefined,
          apiKey: apiKey.length ? apiKey : undefined,
          headers,
        },
      })

      if (!res.ok) {
        console.log(`[UI Setup State] LLM connection test failed:`, {
          provider,
          error: res.error?.message
        })
        this.testStatus = `Failed: ${res.error?.message ?? 'unknown error'}`
        return
      }

      const models = (res.models ?? []).filter((m: string) => typeof m === 'string' && m.trim().length)
      if (provider === 'openai' || provider === 'anthropic' || provider === 'gemini') {
        this.cloudModels = models
        console.log('[UI Setup State] Cloud models loaded', {
          provider,
          count: models.length,
          first: models[0],
        })
      } else {
        this.cloudModels = []
      }
      if (models.length) {
        if (provider === 'ollama') {
          this.ollamaModels = models
          if (!this.config.model || !models.includes(this.config.model)) {
            this.config.model = models[0]
          }
        } else if (provider === 'gemini') {
          const desired = (this.config.model ?? '').trim()
          const normalized = desired.length && !desired.startsWith('models/') ? `models/${desired}` : desired
          if (!normalized.length || !models.includes(normalized)) {
            const pick = models.find(m => typeof m === 'string' && m.startsWith('models/gemini')) ?? models[0]
            if (typeof pick === 'string' && pick.trim().length) {
              this.config.model = pick
            }
          }
        }
      }

      console.log(`[UI Setup State] LLM connection test succeeded:`, {
        provider,
        modelsFound: models.length,
        firstModel: models[0] || undefined
      })

      this.testStatus = models.length ? `OK: ${models.length} model(s) found` : 'OK: no models found'
    } catch (err: any) {
      const message = typeof err?.message === 'string' && err.message.trim().length ? err.message : 'request error'
      console.log(`[UI Setup State] LLM connection test error:`, {
        provider,
        error: message
      })
      this.testStatus = `Failed: ${message}`
    } finally {
      this.busy = false
      this.persistDraft()
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

    if (provider === 'lmstudio') {
      return !!(this.config.endpoint ?? '').trim() && !!(this.config.model ?? '').trim()
    }

    if (provider === 'custom') {
      return !!(this.config.endpoint ?? '').trim()
    }

    if (provider === 'openai' || provider === 'anthropic' || provider === 'gemini') {
      return !!(this.config.apiKey ?? '').trim() && !!(this.config.model ?? '').trim()
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

    if (provider === 'lmstudio') {
      const endpoint = (this.config.endpoint ?? '').trim() || 'unset'
      const model = (this.config.model ?? '').trim() || 'unset'
      return `Provider: LM Studio • Base URL: ${endpoint} • Model: ${model} • Trust: ${trust}`
    }

    if (provider === 'custom') {
      const endpoint = (this.config.endpoint ?? '').trim() || 'unset'
      const model = (this.config.model ?? '').trim() || '(optional)'
      return `Provider: Custom AI • Base URL: ${endpoint} • Model: ${model} • Trust: ${trust}`
    }

    const warn = this.config.cloudWarnBeforeSending ? 'warn before sending' : 'no warning'
    const model = (this.config.model ?? '').trim() || 'unset'
    const key = (this.config.apiKey ?? '').trim().length ? 'api key set' : 'api key unset'
    return `Provider: ${provider} • Model: ${model} • ${key} • ${warn} • Trust: ${trust}`
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
      const endpoint = (this.config.endpoint ?? '').trim()
      const isCloud = provider === 'openai' || provider === 'anthropic' || provider === 'gemini'
      const baseUrl = !isCloud && endpoint.length ? endpoint : undefined
      const endpointOut = !isCloud && endpoint.length ? endpoint : undefined

      let headers: Record<string, string> | undefined
      if (provider === 'custom') {
        const headersText = (this.config.headers ?? '').trim()
        if (headersText.length) {
          const parsed = JSON.parse(headersText)
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const out: Record<string, string> = {}
            for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
              if (typeof k === 'string' && k.trim() && typeof v === 'string') {
                out[k] = v
              }
            }
            headers = out
          }
        }
      }

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
            baseUrl,
            endpoint: endpointOut,
            apiKey: (this.config.apiKey ?? '').trim() || undefined,
            headers,
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
      this.persistDraft()
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.busy = false
    }
  }
}
