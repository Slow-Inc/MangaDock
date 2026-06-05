import { Body, Controller, Header, Headers, HttpException, HttpStatus, Logger, Post, Req } from '@nestjs/common';
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
    @Req() req?: { rawBody?: Buffer },
  ) {
    const secret = process.env.MIT_WEBHOOK_SECRET;

    // HMAC verification: only enforced when MIT_WEBHOOK_SECRET is configured.
    // When no secret is set, MIT won't sign the callback — accept it unauthenticated.
    // Production deployments should always set MIT_WEBHOOK_SECRET.
    if (secret) {
      if (!signature) {
        this.logger.error('Missing x-mit-signature header');
        throw new HttpException('Missing signature', HttpStatus.UNAUTHORIZED);
      }

      // #95 S1: verify over the raw request bytes MIT actually signed. Re-serializing
      // the parsed body can differ byte-for-byte (key order via middleware transforms,
      // float formatting: Python json.dumps "1.0" vs JSON.stringify "1"). rawBody is
      // captured by the json() verify hook in main.ts; the stringify fallback only
      // covers callers without an Express request (e.g. direct unit invocation).
      const data = req?.rawBody ?? Buffer.from(JSON.stringify(body), 'utf8');
      const hmac = crypto.createHmac('sha256', secret);
      const digest = hmac.update(data).digest('hex');
      const sigBuf = Buffer.from(signature, 'hex');
      const digBuf = Buffer.from(digest, 'hex');

      if (sigBuf.length !== digBuf.length || !crypto.timingSafeEqual(sigBuf, digBuf)) {
        this.logger.error('Invalid HMAC signature');
        throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
      }
    }

    // T4-STANDARD Pillar 2: Idempotent Webhook Processing
    // MIT sends a FLAT payload: { taskId, pageIndex, imgWidth, imgHeight, patches, error }.
    // It does NOT nest the patch data under a `result` key (the NDJSON streaming path in
    // _runMitBatch reads the same flat shape). Adapt it here into the structured `result`
    // object that handleMitCallback expects — this controller is the anti-corruption layer
    // between MIT's wire format and the service's domain shape.
    const { taskId, pageIndex, imgWidth, imgHeight, patches, error } = body;

    if (!taskId) {
      throw new HttpException('Missing taskId in webhook body', HttpStatus.BAD_REQUEST);
    }

    this.logger.log(`Received MIT webhook for task ${taskId} (page ${pageIndex})`);

    const result = { imgWidth, imgHeight, patches };

    try {
      await this.booksService.handleMitCallback(taskId, pageIndex, result, error);
      return { ok: true };
    } catch (err) {
      this.logger.error(`Failed to process MIT callback: ${String(err)}`);
      throw new HttpException('Internal processing error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
