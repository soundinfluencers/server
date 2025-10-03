import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Module } from '@nestjs/common';

@WebSocketGateway({ cors: true, path: '/socket.io' })
export class AppGateway {
  @WebSocketServer() server: Server;

  handleConnection(client: Socket) {
    client.join(client.id);
  }

  sendWhatsappMessageStatusUpdate(socketId: string, status: any) {
    this.server.to(socketId).emit('whatsappMessageStatusUpdate', status);
  }

  refreshPostDetailsStatusUpdate(socketId: string, data: any) {
      this.server.to(socketId).emit('refreshPostDetailsStatusUpdate', data);
  }
}

@Module({
  providers: [AppGateway],
  exports: [AppGateway],
})
export class WebsocketModule {}
