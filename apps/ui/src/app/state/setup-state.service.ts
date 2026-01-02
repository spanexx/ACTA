import { Injectable } from '@angular/core'
import type { ProfileSetupConfig, TrustLevel } from '../models/ui.models'
import { ChatStateService } from './chat-state.service'
import { SessionService } from './session.service'

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
  ) {}

  openWizard(): void {
    this.open = true
  }

  closeWizard(): void {
    this.open = false
  }

  async loadConfigAndMaybeOpenWizard(): Promise<void> {
    try {
      if (!window.ActaAPI) return
      const res = await window.ActaAPI.getSetupConfig()
      this.config = { ...res.config }

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

  canComplete(): boolean {
    const provider = this.config.modelProvider
    if (!provider) return false
    if ((this.config.trustLevel ?? null) === null) return false

    if (provider === 'ollama') {
      return !!(this.config.endpoint ?? '').trim() && !!(this.config.model ?? '').trim()
    }

    return true
  }

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

  async complete(): Promise<void> {
    if (!this.canComplete()) return
    if (this.busy) return

    this.busy = true
    try {
      if (!window.ActaAPI) return
      const res = await window.ActaAPI.completeSetup({ config: this.config })
      this.config = { ...res.config }

      if (typeof this.config.trustLevel === 'number') {
        const tl = this.config.trustLevel as TrustLevel
        this.session.setTrustLevel(tl)
      }

      this.open = false
      this.chat.addSystemMessage(`Setup saved for profile ${res.profileId}.`, Date.now())
    } catch {
      // ignore (UI scaffold only)
    } finally {
      this.busy = false
    }
  }
}
