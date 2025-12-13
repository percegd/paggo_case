import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
    private genAI: GoogleGenerativeAI;
    private readonly logger = new Logger(AiService.name);

    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    }

    async generateSummary(text: string): Promise<string> {
        try {
            if (!process.env.GEMINI_API_KEY) {
                this.logger.error('GEMINI_API_KEY is missing');
                return "GEMINI_API_KEY is not set. Cannot generate summary.";
            }

            const modelName = 'gemini-flash-latest';
            this.logger.log(`Initializing Gemini model: ${modelName}`);
            // Use Gemini to generate a concise summary
            const model = this.genAI.getGenerativeModel({ model: modelName });
            const prompt = `Please provide a very concise summary of the following document (maximum 3-4 sentences). Focus strictly on the most important details (e.g., total amount, due date, main subject). Return ONLY plain text. Do NOT use markdown validation, bold text, or lists. Keep it simple and direct.\n\n${text}`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            this.logger.error('Error generating summary with Gemini', error);
            return `Error generating summary: ${error.message}`;
        }
    }

    async chatAboutDocument(documentText: string, userQuestion: string): Promise<string> {
        try {
            if (!process.env.GEMINI_API_KEY) {
                return "GEMINI_API_KEY is not set.";
            }
            const model = this.genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

            const prompt = `You are a helpful assistant. Here is the context of a document:\n\n${documentText}\n\nUser Question: ${userQuestion}\n\nInstructions: Answer clearly and concisely. You MUST use Markdown formatting to highlight key information. Use **Bold** for important terms, values, methods (e.g., **Pix**, **Boleto**), amounts, or dates. Use lists or bullet points if explaining multiple items.`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error: any) {
            this.logger.error('Error chatting with Gemini', error);
            return `I cannot answer right now (AI Error): ${error.message}`;
        }
    }
}
