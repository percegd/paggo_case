import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';

@Injectable()
export class ChatService {
    constructor(
        private prisma: PrismaService,
        private aiService: AiService,
    ) { }

    async sendMessage(documentId: string, userId: string, message: string) {
        const document = await this.prisma.document.findUnique({
            where: { id: documentId, userId }, // Enforce ownership
        });

        if (!document) {
            throw new NotFoundException('Document not found');
        }

        // Save User message
        await this.prisma.chatMessage.create({
            data: {
                documentId,
                role: 'USER',
                content: message,
            },
        });

        // Get AI response
        const context = document.extractedText || '';
        const aiResponse = await this.aiService.chatAboutDocument(context, message);

        // Save AI message
        const aiMsg = await this.prisma.chatMessage.create({
            data: {
                documentId,
                role: 'AI',
                content: aiResponse,
            },
        });

        return aiMsg;
    }

    async getMessages(documentId: string, userId: string) {
        // Ensure user owns the document before returning messages
        const doc = await this.prisma.document.findFirst({
            where: { id: documentId, userId },
        });

        if (!doc) {
            throw new NotFoundException('Document not found or access denied');
        }

        return this.prisma.chatMessage.findMany({
            where: { documentId },
            orderBy: { createdAt: 'asc' },
        });
    }
}
