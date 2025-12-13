import { Controller, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post('sync')
    async syncUser(@Body() body: { id: string; email: string }) {
        return this.usersService.syncUser(body.id, body.email);
    }
}
