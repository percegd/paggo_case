import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
    constructor(private prisma: PrismaService) { }

    async syncUser(id: string, email: string) {
        return this.prisma.user.upsert({
            where: { id },
            update: { email },
            create: { id, email },
        });
    }
}
