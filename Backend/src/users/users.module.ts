import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersPublicController } from './users-public.controller';
import { UsersService } from './users.service';
import { EmailValidationService } from './email-validation.service';

@Module({
  controllers: [UsersController, UsersPublicController],
  providers: [UsersService, EmailValidationService],
  exports: [UsersService],
})
export class UsersModule {}
