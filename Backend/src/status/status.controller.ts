import { Controller, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { StatusService, SystemStatusEvent } from './status.service';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('status')
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  @Sse('stream')
  sse(): Observable<MessageEvent> {
    return this.statusService.getStatusStream().pipe(
      map((event: SystemStatusEvent) => ({
        data: event,
      }))
    );
  }
}
