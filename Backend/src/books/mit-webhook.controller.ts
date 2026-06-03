import { Body, Controller, Header, Headers, HttpException, HttpStatus, Logger, Post } from '@nestjs/common';
import * as crypto from 'crypto';
import { BooksService } from './books.service';

@Controller('webhooks/mit')
export class MitWebhookController {
  private readonly logger = new Logger(MitWebhookController.name);

  constructor(private readonly booksService: BooksService) {}

  @Post('callback')
  async handleCallback(
    @Headers('x-mit-signature') signature: string,
    @Body() body: any,
  ) {
    const secret = process.env.MIT_WEBHOOK_SECRET;
    
    // T4-STANDARD Pillar 2: HMAC Verification
    if (secret) {
      if (!signature) {
        this.logger.error('Missing x-mit-signature header');
        throw new HttpException('Missing signature', HttpStatus.UNAUTHORIZED);
      }

      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(JSON.stringify(body)).digest('hex');
      const sigBuf = Buffer.from(signature, 'hex');
      const digBuf = Buffer.from(digest, 'hex');

      if (sigBuf.length !== digBuf.length || !crypto.timingSafeEqual(sigBuf, digBuf)) {
        this.logger.error('Invalid HMAC signature');
        throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
      }
    } else {
      this.logger.warn('MIT_WEBHOOK_SECRET not set — skipping signature verification (NOT RECOMMENDED FOR PRODUCTION)');
    }

    // T4-STANDARD Pillar 2: Idempotent Webhook Processing
    const { taskId, pageIndex, result, error } = body;
    
    if (!taskId) {
      throw new HttpException('Missing taskId in webhook body', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`Received MIT webhook for task ${taskId} (page ${pageIndex})`);

    try {
      await this.booksService.handleMitCallback(taskId, pageIndex, result, error);
      return { ok: true };
    } catch (err) {
      this.logger.error(`Failed to process MIT callback: ${String(err)}`);
      throw new HttpException('Internal processing error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
