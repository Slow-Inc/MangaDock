import {
  Body,
  Controller,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
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

    // HMAC policy (#95 S2, resolved 2026-06-05):
    // - secret configured → verify every callback (over raw bytes, S1).
    // - no secret in production → reject; an open results endpoint would let
    //   anyone inject translations. Misconfiguration must fail loudly.
    // - no secret outside production → accept unauthenticated (local dev runs
    //   MIT without a secret on purpose — decision 2026-06-04).
    if (!secret && process.env.NODE_ENV === 'production') {
      this.logger.error(
        'MIT_WEBHOOK_SECRET is not configured — rejecting webhook in production',
      );
      throw new HttpException(
        'Webhook secret not configured',
        HttpStatus.UNAUTHORIZED,
      );
    }
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

      if (
        sigBuf.length !== digBuf.length ||
        !crypto.timingSafeEqual(sigBuf, digBuf)
      ) {
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
    const { taskId, pageIndex, imgWidth, imgHeight, patches, regions, error } = body;

    if (!taskId) {
      throw new HttpException(
        'Missing taskId in webhook body',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Live stage update (UX): {taskId, pageIndex, stage} with no patch data.
    // Informational fire-and-forget — forwarded to batch listeners, never
    // recorded as a completed page. Not logged: one event per stage per page.
    if (typeof body.stage === 'string' && patches === undefined && !error) {
      this.booksService.notifyBatchProgress(taskId, pageIndex, body.stage);
      return { ok: true };
    }

    this.logger.log(
      `Received MIT webhook for task ${taskId} (page ${pageIndex})`,
    );

    // #160: forward the text layer (#158) so handleMitCallback can persist it.
    const result = { imgWidth, imgHeight, patches, regions };

    try {
      await this.booksService.handleMitCallback(
        taskId,
        pageIndex,
        result,
        error,
      );
      return { ok: true };
    } catch (err) {
      this.logger.error(`Failed to process MIT callback: ${String(err)}`);
      throw new HttpException(
        'Internal processing error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
