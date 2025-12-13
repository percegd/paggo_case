import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OcrService } from '../ocr/ocr.service';
import { AiService } from '../ai/ai.service';
import * as path from 'path';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class DocumentsService {
    private supabase: SupabaseClient;

    constructor(
        private prisma: PrismaService,
        private ocrService: OcrService,
        private aiService: AiService,
    ) {
        this.supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
    }

    private async uploadToSupabase(file: Express.Multer.File): Promise<string> {
        const fileExt = path.extname(file.originalname);
        const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExt}`;
        const filePath = `uploads/${fileName}`;

        const { data, error } = await this.supabase.storage
            .from('documents')
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: false
            });

        if (error) throw new Error(`Supabase Upload Error: ${error.message}`);

        const { data: publicUrlData } = this.supabase.storage
            .from('documents')
            .getPublicUrl(filePath);

        return publicUrlData.publicUrl;
    }

    async create(file: Express.Multer.File, userId: string, email: string) {
        // 1. Upload to Supabase Storage
        console.log(`[DocumentsService] Uploading to Supabase...`);
        const fileUrl = await this.uploadToSupabase(file);
        console.log(`[DocumentsService] Uploaded: ${fileUrl}`);

        // 2. Ensure User exists (FK Constraint)
        await this.prisma.user.upsert({
            where: { id: userId },
            update: { email },
            create: { id: userId, email },
        });

        // 3. Create DB record
        const document = await this.prisma.document.create({
            data: {
                title: file.originalname,
                fileUrl: fileUrl,
                userId: userId,
                status: 'PROCESSING',
            },
        });

        // 4. Process (OCR + AI)
        try {
            console.log(`[DocumentsService] Processing file from Buffer...`);
            const text = await this.ocrService.extractText(file.buffer);
            console.log(`[DocumentsService] OCR extracted ${text.length} characters.`);

            console.log(`[DocumentsService] Generating summary...`);
            const summary = await this.aiService.generateSummary(text);
            console.log(`[DocumentsService] Summary generated: ${summary.substring(0, 50)}...`);

            return await this.prisma.document.update({
                where: { id: document.id },
                data: {
                    extractedText: text,
                    aiSummary: summary,
                    status: 'COMPLETED',
                },
            });
        } catch (e) {
            // Processing Failed: Mark document as failed so user knows.
            await this.prisma.document.update({
                where: { id: document.id },
                data: { status: 'FAILED' },
            });
            throw e;
        }
    }

    async findAll(userId: string) {
        return this.prisma.document.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string, userId: string) {
        const doc = await this.prisma.document.findFirst({
            where: { id, userId },
            include: { chatMessages: { orderBy: { createdAt: 'asc' } } },
        });
        if (!doc) throw new NotFoundException('Document not found');
        return doc;
    }

    async remove(id: string, userId: string) {
        const doc = await this.findOne(id, userId); // Ensure existence and ownership

        // Delete from Supabase Storage
        if (doc.fileUrl) {
            try {
                const url = new URL(doc.fileUrl);
                // Extract path after /documents/
                // Supabase URLs: .../storage/v1/object/public/documents/uploads/filename.ext
                const pathParts = url.pathname.split('/documents/');
                if (pathParts.length > 1) {
                    const filePath = pathParts[1]; // Should be "uploads/filename.ext"
                    console.log(`[DocumentsService] Deleting file from Storage: ${filePath}`);
                    const { error } = await this.supabase.storage
                        .from('documents')
                        .remove([filePath]);

                    if (error) {
                        console.error('[DocumentsService] Failed to delete file from Supabase:', error);
                        // We continue even if storage delete fails to ensure DB is cleaned up? 
                        // Usually better to log and proceed, or orphaned DB records are worse than orphaned files.
                    }
                }
            } catch (e) {
                console.error('[DocumentsService] Error parsing file URL:', e);
            }
        }

        return this.prisma.$transaction(async (tx) => {
            console.log(`[DocumentsService] Deleting messages for doc: ${doc.id}`);
            const deleted = await tx.chatMessage.deleteMany({
                where: { documentId: doc.id },
            });
            console.log(`[DocumentsService] Deleted ${deleted.count} messages.`);

            return tx.document.delete({
                where: { id: doc.id },
            });
        });
    }
}
