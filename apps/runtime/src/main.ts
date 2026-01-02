import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { loadConfig } from '@acta/core'
import { createLogger } from '@acta/logging'

async function bootstrap() {
  const cfg = loadConfig()
  const logger = createLogger('runtime', cfg.logLevel)

  const app = await NestFactory.create(AppModule)
  await app.listen(cfg.port)
  // Minimal ready log as per Phase-1 expectations
  logger.info(`Acta Phase-1 Runtime (NestJS) ready on :${cfg.port}`, {
    port: cfg.port,
    profileId: cfg.profileId ?? 'default',
  })

  // Graceful shutdown handling
  const signals = ['SIGINT', 'SIGTERM']
  signals.forEach(sig => {
    process.on(sig, async () => {
      logger.info(`Received ${sig}, shutting down gracefully`)

      try {
        await app.close()
        logger.info('Server closed')
        process.exit(0)
      } catch (err) {
        logger.error('Error during shutdown', err)
        process.exit(1)
      }
    })
  })
}

bootstrap().catch(err => {
  const logger = createLogger('runtime', 'error')
  logger.error('Runtime boot error:', err)
  process.exit(1)
})
