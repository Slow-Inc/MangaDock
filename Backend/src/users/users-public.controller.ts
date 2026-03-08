import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { EmailValidationService } from './email-validation.service';

@Controller('users')
export class UsersPublicController {
  constructor(private readonly emailValidation: EmailValidationService) {}

  @Post('validate-email')
  async validateEmail(@Body() body: { email?: string }) {
    const email = typeof body?.email === 'string' ? body.email : '';
    if (!email.trim()) {
      throw new BadRequestException('email is required');
    }

    return this.emailValidation.validateForSignup(email);
  }
}
