import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';

@Injectable()
export class XenditService {
  private readonly logger = new Logger(XenditService.name);

  private get authHeader(): string {
    const key = process.env.XENDIT_SECRET_KEY ?? '';
    return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
  }

  async createPromptPayCharge(
    amount: number,
    referenceId: string,
    description: string,
  ): Promise<{ payment_id: string; qr_string: string; expires_at: string }> {
    const res = await fetch('https://api.xendit.co/payment_requests', {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
        'api-version': "2024-11-11",
      },
      body: JSON.stringify({
        reference_id: referenceId,
        currency: 'THB',
        amount,
        country: 'TH',
        payment_method: {
          type: 'QR_CODE',
          reusability: 'ONE_TIME_USE',
          qr_code: { channel_code: 'PROMPTPAY' },
        },
        description,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Xendit API error ${res.status}: ${text}`);
      throw new InternalServerErrorException('Payment service unavailable');
    }

    const data = (await res.json()) as Record<string, any>;
    const qr_string: string =
      data?.payment_method?.qr_code?.channel_properties?.qr_string ?? '';
    const expires_at: string =
      data?.expires_at ?? new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return { payment_id: data.id as string, qr_string, expires_at };
  }

  /**
   * Fetch the authoritative state of a payment request directly from Xendit.
   * Used to verify an inbound webhook before crediting coins (V1/V2) — the
   * webhook payload alone is never trusted.
   */
  async getPaymentRequest(
    paymentRequestId: string,
  ): Promise<{ status: string; amount: number; currency: string }> {
    const res = await fetch(
      `https://api.xendit.co/payment_requests/${encodeURIComponent(paymentRequestId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: this.authHeader,
          'api-version': '2024-11-11',
        },
      },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Xendit get payment_request error ${res.status}: ${text}`);
      throw new InternalServerErrorException('Failed to verify payment');
    }

    const data = (await res.json()) as Record<string, any>;
    return {
      status: data.status as string,
      amount: Number(data.amount),
      currency: data.currency as string,
    };
  }

  async simulatePayment(paymentRequestId: string, amount: number): Promise<void> {
    const res = await fetch(
      `https://api.xendit.co/v3/payment_requests/${encodeURIComponent(paymentRequestId)}/simulate`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader,
          'Content-Type': 'application/json',
          'api-version': '2024-11-11',
        },
        body: JSON.stringify({ amount }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(`Xendit simulate error ${res.status}: ${text}`);
      throw new InternalServerErrorException('Failed to simulate payment');
    }
  }
}
