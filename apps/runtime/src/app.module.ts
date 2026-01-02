import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { DemoController } from './demo.controller'
import { AgentDemoController } from './agent-demo.controller'

@Module({
  imports: [],
  controllers: [HealthController, DemoController, AgentDemoController],
  providers: [],
})
export class AppModule {}
