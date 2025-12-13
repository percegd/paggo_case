import { Injectable, Logger } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf = require('pdf-parse');

@Injectable()
export class OcrService {
    private readonly logger = new Logger(OcrService.name);

    // Simplified: Now accepts only Buffer for in-memory processing
    async extractText(dataBuffer: Buffer): Promise<string> {
        this.logger.log('Starting text extraction...');

        // PDF detection using Magic Bytes (%PDF)
        const isPdf = dataBuffer.toString('utf8', 0, 4) === '%PDF';

        try {
            if (isPdf) {
                this.logger.log('Processing file as PDF...');
                const data = await pdf(dataBuffer);

                // Basic cleanup: Remove excessive empty lines common in parsed PDFs
                const cleanText = data.text.replace(/\n\s*\n/g, '\n');

                this.logger.log('PDF text extracted successfully.');
                return cleanText;
            } else {
                this.logger.log('Processing file as Image (OCR)...');

                // Using 'por+eng' to support both Portuguese (accents) and English keywords
                const worker = await createWorker('por+eng');

                const { data: { text } } = await worker.recognize(dataBuffer);

                await worker.terminate();
                this.logger.log('Image OCR completed successfully.');
                return text;
            }
        } catch (error) {
            this.logger.error('Text extraction failed', error);
            // Throw a generic error message for the upper layers to handle
            throw new Error('Failed to extract text from the file.');
        }
    }
}