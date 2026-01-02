import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { DemoController } from './demo.controller'
import { AgentDemoController } from './agent-demo.controller'
import { RuntimeWsIpcServer } from './ipc-ws.server'

@Module({
  imports: [],
  controllers: [HealthController, DemoController, AgentDemoController],
  providers: [RuntimeWsIpcServer],
})
export class AppModule {}
