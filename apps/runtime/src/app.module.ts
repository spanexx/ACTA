import { Module } from '@nestjs/common'
import { HealthController } from './health.controller'
import { DemoController } from './demo.controller'
import { AgentDemoController } from './agent-demo.controller'
import { RuntimeWsIpcServer } from './ipc-ws.server'
import { ProfileService } from './profile.service'

@Module({
  imports: [],
  controllers: [HealthController, DemoController, AgentDemoController],
  providers: [RuntimeWsIpcServer, ProfileService],
})
export class AppModule {}
