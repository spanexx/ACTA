import { Controller, Get } from '@nestjs/common'
import { loadConfig } from '@acta/core'

@Controller('health')
export class HealthController {
  @Get()
  status() {
    const cfg = loadConfig()
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      config: {
        port: cfg.port,
        logLevel: cfg.logLevel,
        profileId: cfg.profileId ?? 'default',
        dataDir: cfg.dataDir,
      },
    }
  }
}
