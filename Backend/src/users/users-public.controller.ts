import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { EmailValidationService } from './email-validation.service';
import { UsersService } from './users.service';

@Controller('users')
export class UsersPublicController {
  constructor(
    private readonly emailValidation: EmailValidationService,
    private readonly users: UsersService,
  ) {}

  @Post('validate-email')
  async validateEmail(@Body() body: { email?: string }) {
    const email = typeof body?.email === 'string' ? body.email : '';
    if (!email.trim()) {
      throw new BadRequestException('email is required');
    }

    return this.emailValidation.validateForSignup(email);
  }

  /** Public translator profile — no authentication required. */
  @Get(':uid/translator')
  async getTranslatorProfile(@Param('uid') uid: string) {
    if (!uid?.trim()) throw new NotFoundException('Translator not found');
    return this.users.getPublicTranslatorProfile(uid);
  }
}
