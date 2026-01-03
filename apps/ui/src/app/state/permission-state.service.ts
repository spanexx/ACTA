/*
  * Code Map: Permission Requests UI State
  * - PermissionStateService: Owns permission modal state and submits decisions to the runtime.
  * - Runtime intake: parses permission.request messages and opens modal.
  * - Submission: sends decision (with optional remember) and updates tool output timeline.
  * - UI helpers: label/icon helpers delegated to permission-state/labels.
  *
  * CID Index:
  * CID:permission-state.service-001 -> PermissionStateService (state container)
  * CID:permission-state.service-002 -> handlePermissionRequestFromRuntime
  * CID:permission-state.service-003 -> cancel
  * CID:permission-state.service-004 -> submit
  * CID:permission-state.service-005 -> label/icon helpers
  * CID:permission-state.service-006 -> openWithRequest
  * CID:permission-state.service-007 -> attachPermissionListener
  *
  * Lookup: rg -n "CID:permission-state.service-" apps/ui/src/app/state/permission-state.service.ts
  */

import { Injectable, NgZone } from '@angular/core'
import type { ActaMessage } from '@acta/ipc'
import { RuntimeIpcService } from '../runtime-ipc.service'
import type { PermissionDecision, PermissionRequestEvent } from '../models/ui.models'
import { ChatStateService } from './chat-state.service'
import { SessionService } from './session.service'
import { ToolOutputsStateService } from './tool-outputs-state.service'
import { permissionRequestFromRuntime } from './permission-state/from-runtime'
import {
  cloudLabel,
  folderScope,
  leadIcon,
  permissionDecisionLabel,
  primaryEffect,
  riskLabel,
  secondaryEffect,
  trustModeLabel,
} from './permission-state/labels'
import { sendPermissionDecision } from './permission-state/submit'
import { attachActaApiPermissionListener } from './permission-state/listener'

// CID:permission-state.service-001 - Permission State Container
// Purpose: Holds permission modal state and coordinates permission decision submission.
// Uses: RuntimeIpcService, SessionService, ChatStateService, ToolOutputsStateService, permission-state helpers
// Used by: Permission modal component; RuntimeEventsService routes runtime messages here
@Injectable({ providedIn: 'root' })
export class PermissionStateService {
  open = false
  submitting = false
  request: PermissionRequestEvent | null = null
  decision: PermissionDecision = 'allow_once'
  remember = false

  private permissionUnsubscribe: (() => void) | null = null

  constructor(
    private zone: NgZone,
    private runtimeIpc: RuntimeIpcService,
    private session: SessionService,
    private chat: ChatStateService,
    private toolOutputs: ToolOutputsStateService,
  ) {
    this.attachPermissionListener()
  }

  // CID:permission-state.service-002 - Runtime Permission Request Intake
  // Purpose: Parses a runtime permission.request message and opens the modal.
  // Uses: permissionRequestFromRuntime(), openWithRequest()
  // Used by: RuntimeEventsService
  handlePermissionRequestFromRuntime(msg: ActaMessage): void {
    const parsed = permissionRequestFromRuntime(msg)
    if (!parsed) return
    this.openWithRequest(parsed.req, parsed.now)
  }

  // CID:permission-state.service-003 - Cancel Shortcut
  // Purpose: Cancels the currently shown request by submitting a deny decision.
  // Uses: submit()
  // Used by: Permission modal cancel action
  cancel(): void {
    void this.submit('deny')
  }

  // CID:permission-state.service-004 - Submit Permission Decision
  // Purpose: Sends the user's decision to the runtime and updates local UI + tool output state.
  // Uses: sendPermissionDecision(), ChatStateService.addSystemMessage(), ToolOutputsStateService.applyPermissionDecision()
  // Used by: Permission modal submit actions
  async submit(decision: PermissionDecision): Promise<void> {
    if (!this.request) return
    if (this.submitting) return

    const request = this.request
    const remember = decision === 'allow_always' || this.remember

    this.submitting = true

    await sendPermissionDecision({
      runtimeIpc: this.runtimeIpc,
      profileId: this.session.profileId,
      request,
      decision,
      remember,
    })

    this.submitting = false
    this.open = false
    this.request = null
    this.remember = false
    this.decision = 'allow_once'

    this.chat.addSystemMessage(`Permission decision for ${request.tool}: ${this.permissionDecisionLabel(decision)}.`)
    this.toolOutputs.applyPermissionDecision(request, decision, remember)
  }

  // CID:permission-state.service-005 - Label/Icon Helpers
  // Purpose: Delegates UI label/icon rendering to shared helpers.
  // Uses: permission-state/labels exports
  // Used by: Permission modal component template
  leadIcon(request: PermissionRequestEvent): string {
    return leadIcon(request)
  }

  cloudLabel(request: PermissionRequestEvent): string {
    return cloudLabel(request)
  }

  riskLabel(request: PermissionRequestEvent): string {
    return riskLabel(request)
  }

  trustModeLabel(level: number): string {
    return trustModeLabel(level)
  }

  primaryEffect(request: PermissionRequestEvent): string {
    return primaryEffect(request)
  }

  secondaryEffect(request: PermissionRequestEvent): string {
    return secondaryEffect(request)
  }

  folderScope(request: PermissionRequestEvent): string | null {
    return folderScope(request)
  }

  permissionDecisionLabel(decision: PermissionDecision): string {
    return permissionDecisionLabel(decision)
  }

  // CID:permission-state.service-006 - Open Modal With Request
  // Purpose: Normalizes state for a new request and records it in chat + tool output timeline.
  // Uses: ChatStateService.addSystemMessage(), ToolOutputsStateService.trackPermissionRequest()
  // Used by: handlePermissionRequestFromRuntime(), attachPermissionListener()
  private openWithRequest(req: PermissionRequestEvent, now: number): void {
    this.request = req
    this.decision = 'allow_once'
    this.remember = false
    this.open = true

    this.chat.addSystemMessage(`Permission requested for ${req.tool}.`, now)
    this.toolOutputs.trackPermissionRequest(req, now)
  }

  // CID:permission-state.service-007 - Preload Permission Listener Wiring
  // Purpose: Attaches an ActaAPI listener that can surface permission requests directly to the renderer.
  // Uses: attachActaApiPermissionListener(), NgZone
  // Used by: PermissionStateService constructor
  private attachPermissionListener(): void {
    const next = attachActaApiPermissionListener({
      zone: this.zone,
      onRequest: (req, now) => this.openWithRequest(req, now),
      existingUnsubscribe: this.permissionUnsubscribe,
    })
    if (next) this.permissionUnsubscribe = next
  }
}
