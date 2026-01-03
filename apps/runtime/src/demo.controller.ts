import { Controller, Get } from '@nestjs/common'
import { createDefaultRegistry } from '@acta/tools'
import { evaluatePermission, type PermissionRequest, type TrustProfile } from '@acta/trust'
import { createMemoryStore } from '@acta/memory'
import { createLogger } from '@acta/logging'
import { ProfileService } from './profile.service'

@Controller('demo')
export class DemoController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  async run() {
    const logger = createLogger('demo')
    const profileId = 'default'

    const profile: TrustProfile = {
      profileId,
      defaultTrustLevel: 2,
    }

    const permReq: PermissionRequest = {
      id: 'demo-permission-1',
      tool: 'explain.content',
      action: 'analyze_text',
      reason: 'Demo permission evaluation',
      scope: 'demo',
      risk: 'low',
      reversible: true,
      timestamp: Date.now(),
      profileId,
    }

    const decision = evaluatePermission(permReq, profile)
    logger.info('Demo permission evaluated', { decision })

    const registry = await createDefaultRegistry()
    const tools = await registry.list()
    const explainTool = await registry.get('explain.content')

    let toolResult: any = null
    if (explainTool) {
      toolResult = await explainTool.execute(
        { text: 'Hello Acta, this is a demo run.' },
        {
          profileId,
          cwd: process.cwd(),
          tempDir: process.cwd(),
          permissions: ['read_files'],
        },
      )
    }

    let memoryDir: string | undefined
    try {
      memoryDir = await this.profileService.getMemoryDir(profileId)
    } catch {
      memoryDir = this.profileService.getActiveMemoryDir() ?? undefined
    }

    const store = createMemoryStore(memoryDir ? { dir: memoryDir } : undefined)
    await store.add('demo:lastRun', { ok: !!toolResult?.success })
    const lastRun = await store.get('demo:lastRun')

    return {
      status: 'ok',
      permission: decision,
      tools: {
        count: tools.length,
        ids: tools.map(t => t.id),
      },
      memory: lastRun,
    }
  }
}
