/*
  * Code Map: Demo Scenarios
  * - DemoStateService: Provides UI-only demo flows (permission request + task-like scenario).
  * - demoPermission(): Uses ActaAPI demo permission request and writes status + chat message.
  * - runScenario(): Simulates a full plan + tool outputs timeline (no runtime required).
  *
  * CID Index:
  * CID:demo-state.service-001 -> DemoStateService (demo orchestrator)
  * CID:demo-state.service-002 -> enabled
  * CID:demo-state.service-003 -> permissionDecisionLabel
  * CID:demo-state.service-004 -> demoPermission
  * CID:demo-state.service-005 -> runScenario
  * CID:demo-state.service-006 -> newId
  *
  * Lookup: rg -n "CID:demo-state.service-" apps/ui/src/app/state/demo-state.service.ts
  */

import { Injectable, NgZone } from '@angular/core'
import type { ChatMessage, PermissionDecision, ToolOutputEntry } from '../models/ui.models'
import { ChatStateService } from './chat-state.service'
import { PermissionStateService } from './permission-state.service'
import { SessionService } from './session.service'
import { ToolOutputsStateService } from './tool-outputs-state.service'

 // CID:demo-state.service-001 - Demo Orchestrator
 // Purpose: Owns demo-only flows used for showcasing UI interactions without relying on the runtime.
 // Uses: SessionService, ChatStateService, ToolOutputsStateService, PermissionStateService, window.ActaAPI
 // Used by: Shell components (e.g. app-shell / topbar) when demo mode is enabled
 @Injectable({ providedIn: 'root' })
 export class DemoStateService {
  permissionBusy = false
  permissionStatus = ''

  scenarioBusy = false
  scenarioStatus = ''

  constructor(
    private zone: NgZone,
    private session: SessionService,
    private chat: ChatStateService,
    private toolOutputs: ToolOutputsStateService,
    private permission: PermissionStateService,
  ) {}

  // CID:demo-state.service-002 - Demo Mode Gate
  // Purpose: Exposes whether demo features should be shown/enabled.
  // Uses: SessionService.demoEnabled
  // Used by: Shell UI to conditionally render demo actions
  get enabled(): boolean {
    return this.session.demoEnabled
  }

  // CID:demo-state.service-003 - Permission Decision Label
  // Purpose: Renders a human-friendly label for a permission decision.
  // Uses: PermissionDecision union type
  // Used by: demoPermission() and status display
  permissionDecisionLabel(decision: PermissionDecision): string {
    if (decision === 'deny') return 'Deny'
    if (decision === 'allow_always') return 'Always allow'
    return 'Allow once'
  }

  // CID:demo-state.service-004 - Demo Permission Flow
  // Purpose: Exercises permission UI by requesting a demo permission decision from the preload API.
  // Uses: window.ActaAPI.demoPermissionRequest(), ChatStateService.addSystemMessage()
  // Used by: Shell UI demo action
  async demoPermission(): Promise<void> {
    if (this.permissionBusy) return

    this.permissionBusy = true
    this.permissionStatus = 'Demo: waiting…'

    try {
      if (!window.ActaAPI) {
        this.permissionStatus = 'Demo: ActaAPI not available'
        return
      }

      const decision = await window.ActaAPI.demoPermissionRequest()
      this.permissionStatus = `Demo: ${this.permissionDecisionLabel(decision)}`
      this.chat.addSystemMessage(`Demo permission resolved: ${this.permissionDecisionLabel(decision)}.`, Date.now())
    } catch {
      this.permissionStatus = 'Demo: failed'
    } finally {
      this.permissionBusy = false
    }
  }

  // CID:demo-state.service-005 - Demo Scenario Runner
  // Purpose: Simulates a plan + tool output timeline (permission → convert → summarize) to demo UI.
  // Uses: window.ActaAPI.demoPermissionRequest(), ChatStateService, ToolOutputsStateService, PermissionStateService, NgZone
  // Used by: Shell UI demo action
  async runScenario(): Promise<void> {
    if (this.scenarioBusy) return

    this.scenarioBusy = true
    this.scenarioStatus = 'Demo: running…'

    this.permission.open = false
    this.permission.submitting = false
    this.permission.request = null

    const now = Date.now()

    const planMsgId = this.newId()
    const stepPermissionId = this.newId()
    const stepConvertId = this.newId()
    const stepSummarizeId = this.newId()

    const demoMessages: ChatMessage[] = [
      { id: this.newId(), type: 'system', timestamp: now, text: 'Demo scenario started.' },
      {
        id: this.newId(),
        type: 'user',
        timestamp: now + 1,
        text: 'Convert /Reports/Q4.pdf to text and summarize it.',
      },
      {
        id: planMsgId,
        type: 'acta',
        timestamp: now + 2,
        text: "I'll run these steps:",
        plan: {
          goal: 'Convert + summarize Q4.pdf',
          collapsed: false,
          steps: [
            { id: stepPermissionId, title: 'Request permission to read the file', status: 'in-progress' },
            { id: stepConvertId, title: 'Convert PDF → TXT', status: 'pending' },
            { id: stepSummarizeId, title: 'Summarize text', status: 'pending' },
          ],
        },
      },
    ]

    this.chat.messages = demoMessages
    this.toolOutputs.toolOutputs = []

    if (!window.ActaAPI) {
      this.scenarioStatus = 'Demo: ActaAPI not available'
      this.scenarioBusy = false
      return
    }

    let decision: PermissionDecision = 'deny'
    try {
      decision = await window.ActaAPI.demoPermissionRequest()
    } catch {
      decision = 'deny'
    }

    if (decision === 'deny') {
      this.scenarioStatus = 'Demo: denied'
      this.chat.addSystemMessage('Demo scenario ended: permission denied.', Date.now())
      this.chat.messages = this.chat.messages.map(msg => {
        if (msg.id !== planMsgId || !msg.plan) return msg
        return {
          ...msg,
          plan: {
            ...msg.plan,
            steps: msg.plan.steps.map(step => {
              if (step.id === stepPermissionId) return { ...step, status: 'failed' }
              return step
            }),
          },
        }
      })
      this.scenarioBusy = false
      return
    }

    this.chat.messages = this.chat.messages.map(msg => {
      if (msg.id !== planMsgId || !msg.plan) return msg
      return {
        ...msg,
        plan: {
          ...msg.plan,
          steps: msg.plan.steps.map(step => {
            if (step.id === stepPermissionId) return { ...step, status: 'completed' }
            if (step.id === stepConvertId) return { ...step, status: 'in-progress' }
            return step
          }),
        },
      }
    })

    const convertOutId = this.newId()
    const convertEntry: ToolOutputEntry = {
      id: convertOutId,
      timestamp: Date.now(),
      tool: 'file.convert',
      status: 'running',
      input: '/Reports/Q4.pdf',
      preview: 'Converting PDF → TXT',
      progress: 0,
      raw: { tool: 'file.convert', input: '/Reports/Q4.pdf', output: '/Reports/Q4.txt', progress: 0 },
      expanded: false,
    }

    this.toolOutputs.toolOutputs = [convertEntry, ...this.toolOutputs.toolOutputs]

    setTimeout(() => {
      this.zone.run(() => {
        this.toolOutputs.toolOutputs = this.toolOutputs.toolOutputs.map(out =>
          out.id === convertOutId ? { ...out, progress: 50, raw: { ...(out.raw as object), progress: 0.5 } } : out,
        )
      })
    }, 900)

    setTimeout(() => {
      this.zone.run(() => {
        this.toolOutputs.toolOutputs = this.toolOutputs.toolOutputs.map(out =>
          out.id === convertOutId
            ? {
                ...out,
                status: 'completed',
                progress: 100,
                preview: 'Converted PDF → TXT',
                artifacts: [{ path: '/Reports/Q4.txt' }],
                raw: { ...(out.raw as object), progress: 1, artifacts: ['/Reports/Q4.txt'] },
              }
            : out,
        )

        this.chat.messages = this.chat.messages.map(msg => {
          if (msg.id !== planMsgId || !msg.plan) return msg
          return {
            ...msg,
            plan: {
              ...msg.plan,
              steps: msg.plan.steps.map(step => {
                if (step.id === stepConvertId) return { ...step, status: 'completed' }
                if (step.id === stepSummarizeId) return { ...step, status: 'in-progress' }
                return step
              }),
            },
          }
        })

        const summarizeOutId = this.newId()
        const summarizeEntry: ToolOutputEntry = {
          id: summarizeOutId,
          timestamp: Date.now(),
          tool: 'llm.summarize',
          status: 'running',
          input: '/Reports/Q4.txt',
          preview: 'Summarizing extracted text',
          progress: 0,
          raw: { tool: 'llm.summarize', input: '/Reports/Q4.txt', status: 'running' },
          expanded: false,
        }

        this.toolOutputs.toolOutputs = [summarizeEntry, ...this.toolOutputs.toolOutputs]

        setTimeout(() => {
          this.zone.run(() => {
            this.toolOutputs.toolOutputs = this.toolOutputs.toolOutputs.map(out =>
              out.id === summarizeOutId
                ? {
                    ...out,
                    status: 'completed',
                    progress: 100,
                    preview: 'Summary ready',
                    raw: { ...(out.raw as object), status: 'completed' },
                  }
                : out,
            )

            this.chat.messages = this.chat.messages.map(msg => {
              if (msg.id !== planMsgId || !msg.plan) return msg
              return {
                ...msg,
                plan: {
                  ...msg.plan,
                  steps: msg.plan.steps.map(step =>
                    step.id === stepSummarizeId ? { ...step, status: 'completed' } : step,
                  ),
                },
              }
            })

            this.chat.messages = [
              ...this.chat.messages,
              {
                id: this.newId(),
                type: 'acta',
                timestamp: Date.now(),
                text:
                  'Summary (demo): Q4 sales improved vs prior quarter, with strongest growth in the enterprise segment. Key drivers include pipeline conversion and reduced churn. Suggested next steps: validate assumptions against source tables and export the summary to a shareable doc.',
              },
            ]

            this.scenarioStatus = 'Demo: complete'
            this.scenarioBusy = false
          })
        }, 1100)
      })
    }, 1900)
  }

  // CID:demo-state.service-006 - ID Generator
  // Purpose: Generates IDs for demo messages/steps/tool outputs.
  // Uses: crypto.randomUUID() when available, otherwise timestamp+random fallback
  // Used by: runScenario()
  private newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }

    return `${Date.now()}-${Math.random().toString(16).slice(2)}`
  }
}
