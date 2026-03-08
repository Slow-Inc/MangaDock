import { Injectable, Logger } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';

export interface SystemStatusEvent {
  service: string;
  status: 'online' | 'offline' | 'maintenance';
  timestamp: number;
}

@Injectable()
export class StatusService {
  private readonly logger = new Logger(StatusService.name);
  
  // Subject for broadcasting status changes
  private statusSubject = new Subject<SystemStatusEvent>();

  /**
   * Broadcast a status change to all connected SSE clients
   */
  broadcastStatus(service: string, status: 'online' | 'offline' | 'maintenance') {
    this.logger.log(`Broadcasting status update: ${service} is now ${status}`);
    this.statusSubject.next({
      service,
      status,
      timestamp: Date.now()
    });
  }

  /**
   * Get the observable stream of status events
   */
  getStatusStream(): Observable<SystemStatusEvent> {
    return this.statusSubject.asObservable();
  }
}
