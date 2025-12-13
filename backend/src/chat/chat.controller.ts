import { Controller, Post, Get, Param, Body, Query, BadRequestException } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) { }

    @Post(':documentId')
    async sendMessage(
        @Param('documentId') documentId: string,
        @Body('message') message: string,
        @Body('userId') userId: string,
    ) {
        if (!userId) throw new BadRequestException('User ID is required');
        return this.chatService.sendMessage(documentId, userId, message);
    }

    @Get(':documentId')
    async getMessages(@Param('documentId') documentId: string, @Query('userId') userId: string) {
        if (!userId) throw new BadRequestException('User ID is required');
        return this.chatService.getMessages(documentId, userId);
    }
}
