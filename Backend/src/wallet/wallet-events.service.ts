import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class WalletEventsService {
  private readonly subjects = new Map<string, Subject<{ balance: number }>>();

  private getOrCreate(paymentId: string): Subject<{ balance: number }> {
    if (!this.subjects.has(paymentId)) {
      this.subjects.set(paymentId, new Subject<{ balance: number }>());
    }
    return this.subjects.get(paymentId)!;
  }

  stream$(paymentId: string): Observable<{ balance: number }> {
    return this.getOrCreate(paymentId).asObservable();
  }

  emit(paymentId: string, data: { balance: number }): void {
    const sub = this.subjects.get(paymentId);
    if (!sub) return;
    sub.next(data);
    sub.complete();
    this.subjects.delete(paymentId);
  }
}
