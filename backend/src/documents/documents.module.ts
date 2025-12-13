import { Module } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { DocumentsController } from './documents.controller';
import { OcrModule } from '../ocr/ocr.module';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [OcrModule, AiModule],
    controllers: [DocumentsController],
    providers: [DocumentsService],
})
export class DocumentsModule { }
