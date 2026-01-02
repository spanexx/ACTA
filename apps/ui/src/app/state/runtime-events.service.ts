import { Injectable, NgZone } from '@angular/core'
import type { Subscription } from 'rxjs'
import type { ActaMessage } from '@acta/ipc'
import { RuntimeIpcService } from '../runtime-ipc.service'
import { ChatStateService } from './chat-state.service'
import { PermissionStateService } from './permission-state.service'
import { ToolOutputsStateService } from './tool-outputs-state.service'

@Injectable({ providedIn: 'root' })
export class RuntimeEventsService {
  private sub: Subscription | null = null

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

  disconnect(): void {
    this.sub?.unsubscribe?.()
    this.sub = null
    this.runtimeIpc.disconnect()
  }
}
