/*
 * Code Map: Planning LLM Wrapper
 * - createPlanningLLM: Provide a minimal LLM interface that can gate cloud usage behind trust decisions.
 *
 * CID Index:
 * CID:planning-llm-001 -> createPlanningLLM
 *
 * Quick lookup: rg -n "CID:planning-llm-" /home/spanexx/Shared/Projects/ACTA/apps/runtime/src/ipc-ws/task/planning-llm.ts
 */

import type { Logger } from '@acta/logging'
import { canExecute, type PermissionDecision, type PermissionDecisionType, type PermissionRequest, type TrustProfile } from '@acta/trust'
import type { LLMRequest } from '@acta/llm'
import { LLMRouter, toLLMError } from '@acta/llm'

import type { Profile } from '@acta/profiles'

// CID:planning-llm-001 - createPlanningLLM
// Purpose: Wrap LLMRouter.generate with permission gating for cloud providers and enrich request metadata.
// Uses: Trust evaluation (evaluatePermission/canExecute), runtime profile/task metadata, opts.emitEvent.
// Used by: runTaskRequest when constructing the Planner.
export function createPlanningLLM(opts: {
  llmRouter: LLMRouter
  profileDoc: Profile
  task: { taskId: string; correlationId: string; profileId: string }
  logger: Logger
  profile: TrustProfile
  emitEvent: (type: string, payload: any) => void
  waitForPermission: (request: PermissionRequest) => Promise<PermissionDecisionType>
  evaluatePermission?: (request: PermissionRequest) => Promise<PermissionDecision>
}): Pick<LLMRouter, 'generate'> {
  return {
    generate: async (request: LLMRequest, options?: { adapterId?: string; model?: string }) => {
      const adapterId = opts.profileDoc.llm?.adapterId
      const mode = opts.profileDoc.llm?.mode
      const isCloudProvider = mode === 'cloud' || adapterId === 'openai' || adapterId === 'anthropic' || adapterId === 'gemini'

      if (isCloudProvider) {
        const provider = adapterId ?? 'unknown'
        const permissionRequest: PermissionRequest = {
          id: `perm-llm:${opts.task.taskId}`,
          tool: 'llm.cloud',
          action: 'generate',
          reason: 'Allow sending task data to a cloud LLM provider',
          scope: provider,
          risk: 'high',
          reversible: true,
          timestamp: Date.now(),
          profileId: opts.task.profileId,
          cloud: {
            provider,
            model: opts.profileDoc.llm?.model,
            warning: `This will send data to a cloud provider (${provider}).`,
          },
        }

        let decision = opts.evaluatePermission
          ? await opts.evaluatePermission(permissionRequest)
          : await canExecute(permissionRequest, opts.profile, opts.logger)

        if (decision.decision === 'ask') {
          opts.emitEvent('permission.request', permissionRequest)
          decision = {
            ...decision,
            decision: await opts.waitForPermission(permissionRequest),
          }
        }

        if (decision.decision !== 'allow') {
          throw toLLMError(new Error('Cloud LLM usage denied'), {
            code: 'llm.unknown',
            message: 'Cloud LLM usage was denied by the user.',
            provider,
            retryable: false,
          })
        }
      }

      return await opts.llmRouter.generate(
        {
          ...request,
          metadata: {
            ...request.metadata,
            profileId: opts.task.profileId,
            requestId: opts.task.correlationId,
          },
        },
        {
          ...options,
          model: options?.model ?? opts.profileDoc.llm?.model,
        },
      )
    },
  }
}
