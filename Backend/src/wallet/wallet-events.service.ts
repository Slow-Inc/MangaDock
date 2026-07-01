import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

@Injectable()
export class WalletEventsService {
  private readonly subjects = new Map<string, Subject<{ balance: number }>>();

  private getOrCreate(paymentId: string): Subject<{ balance: number }> {
    let subject = this.subjects.get(paymentId);
    if (!subject) {
      subject = new Subject<{ balance: number }>();
      this.subjects.set(paymentId, subject);
    }
    return subject;
  }

  stream$(paymentId: string): Observable<{ balance: number }> {
    return new Observable<{ balance: number }>((subscriber) => {
      const subject = this.getOrCreate(paymentId);
      const inner = subject.subscribe(subscriber);
      // Teardown fires on client disconnect or QR-expiry timer (controller's
      // takeUntil). Once the last subscriber leaves, finalize the subject and
      // drop the Map entry so the registry can't grow unbounded as topups
      // expire without ever being paid (emit() only fires on success).
      return () => {
        inner.unsubscribe();
        if (subject.observers.length === 0) {
          subject.complete();
          this.subjects.delete(paymentId);
        }
      };
    });
  }

  emit(paymentId: string, data: { balance: number }): void {
    const sub = this.subjects.get(paymentId);
    if (!sub) return;
    sub.next(data);
    sub.complete();
    this.subjects.delete(paymentId);
  }
}
