import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    app.enableCors({
        origin: '*', // Allow all origins for now (or specify process.env.FRONTEND_URL)
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        allowedHeaders: 'Content-Type, Accept, Authorization',
    });

    // Usa a porta do servidor de Deploy OU a 3001 se estiver local
    const port = process.env.PORT || 3001;

    await app.listen(port);
    console.log(`🚀 Application is running on: ${await app.getUrl()}`);
}
bootstrap();