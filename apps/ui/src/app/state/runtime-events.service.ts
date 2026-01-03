/*
 * Code Map: Runtime Event Routing
 * - RuntimeEventsService: Connects to runtime IPC and routes inbound messages to state services.
 * - Constructor: connects + subscribes; routes permission/task messages inside NgZone.
 * - disconnect(): unsubscribes and disconnects IPC.
 *
 * CID Index:
 * CID:runtime-events.service-001 -> RuntimeEventsService (router)
 * CID:runtime-events.service-002 -> constructor message routing
 * CID:runtime-events.service-003 -> disconnect
 *
 * Lookup: rg -n "CID:runtime-events.service-" apps/ui/src/app/state/runtime-events.service.ts
 */

import { Injectable, NgZone } from '@angular/core'
import type { Subscription } from 'rxjs'
import type { ActaMessage } from '@acta/ipc'
import { RuntimeIpcService } from '../runtime-ipc.service'
import { ChatStateService } from './chat-state.service'
import { PermissionStateService } from './permission-state.service'
import { ToolOutputsStateService } from './tool-outputs-state.service'

// CID:runtime-events.service-001 - Runtime Message Router
// Purpose: Ensures runtime IPC is connected and dispatches incoming messages into UI state services.
// Uses: RuntimeIpcService (connect/messages$/disconnect), NgZone, ChatStateService, PermissionStateService, ToolOutputsStateService
// Used by: AppShellService DI graph (constructed at app startup)
@Injectable({ providedIn: 'root' })
export class RuntimeEventsService {
  private sub: Subscription | null = null

  // CID:runtime-events.service-002 - Connect + Subscribe
  // Purpose: Connects to IPC and routes messages inside the Angular zone so UI updates render.
  // Uses: RuntimeIpcService.connect(), RuntimeIpcService.messages$, NgZone.run()
  // Used by: RuntimeEventsService instantiation
  constructor(
    private zone: NgZone,
    private runtimeIpc: RuntimeIpcService,
    private chat: ChatStateService,
    private permission: PermissionStateService,
    private toolOutputs: ToolOutputsStateService,
  ) {
    this.runtimeIpc.connect()

    this.sub = this.runtimeIpc.messages$.subscribe((msg: ActaMessage) => {
      this.zone.run(() => {
        if (msg.type === 'permission.request') {
          this.permission.handlePermissionRequestFromRuntime(msg)
          return
        }

        if (msg.type === 'chat.response') {
          this.chat.handleChatResponseMessage(msg)
          return
        }

        if (msg.type === 'chat.error') {
          this.chat.handleChatErrorMessage(msg)
          return
        }

        if (msg.type === 'task.plan') {
          this.chat.handleTaskPlanMessage(msg)
          return
        }

        if (msg.type === 'task.step') {
          this.chat.handleTaskStepMessage(msg)
          this.toolOutputs.handleTaskStepMessage(msg)
          return
        }

        if (msg.type === 'task.result') {
          this.chat.handleTaskResultMessage(msg)
          return
        }

        if (msg.type === 'task.error') {
          this.chat.handleTaskErrorMessage(msg)
          return
        }
      })
    })
  }

  // CID:runtime-events.service-003 - Disconnect
  // Purpose: Unsubscribes from message stream and disconnects runtime IPC.
  // Uses: Subscription.unsubscribe(), RuntimeIpcService.disconnect()
  // Used by: App shutdown / teardown flows
  disconnect(): void {
    this.sub?.unsubscribe?.()
    this.sub = null
    this.runtimeIpc.disconnect()
  }
}
