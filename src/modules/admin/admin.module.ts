import { Module } from '@nestjs/common';
import { AdminClientsService } from './services/admin-clients.service';
import { AdminClientsController } from './controllers/admin-clients.controller';

@Module({
  controllers: [AdminClientsController],
  providers: [AdminClientsService],
})
export class AdminModule {}
