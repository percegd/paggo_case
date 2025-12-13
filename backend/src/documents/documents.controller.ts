import {
    Controller,
    Get,
    Post,
    Delete,
    Param,
    UploadedFile,
    UseInterceptors,
    Body,
    Query,
    BadRequestException
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { memoryStorage } from 'multer';

@Controller('documents')
export class DocumentsController {
    constructor(private readonly documentsService: DocumentsService) { }

    @Post('upload')
    @UseInterceptors(FileInterceptor('file', {
        storage: memoryStorage(), // Perfect: Keeps file in buffer for Supabase
        limits: { fileSize: 5 * 1024 * 1024 }, // Limit: 5MB to prevent server crash
        fileFilter: (req, file, callback) => {
            // Allow only images and PDFs
            if (!file.mimetype.match(/\/(jpg|jpeg|png|pdf)$/)) {
                return callback(new BadRequestException('Only image or PDF files are allowed!'), false);
            }
            callback(null, true);
        },
    }))
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Body('userId') userId: string,
        @Body('email') email: string
    ) {
        if (!file) {
            throw new BadRequestException('File is required');
        }
        if (!userId) {
            throw new BadRequestException('User ID is required');
        }

        // Fallback email is okay, but UserID is mandatory
        const userEmail = email || `user-${userId}@example.com`;

        return this.documentsService.create(file, userId, userEmail);
    }

    @Get()
    async findAll(@Query('userId') userId: string) {
        if (!userId) throw new BadRequestException('User ID is required');
        return this.documentsService.findAll(userId);
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Query('userId') userId: string) {
        if (!userId) throw new BadRequestException('User ID is required');
        return this.documentsService.findOne(id, userId);
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @Query('userId') userId: string) {
        if (!userId) throw new BadRequestException('User ID is required');
        return this.documentsService.remove(id, userId);
    }
}