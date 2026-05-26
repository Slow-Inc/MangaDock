import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { RedisService } from '../cache/redis.service';
import type { ForumComment } from './forum.types';

export type ForumSSEEvent =
  | { type: 'vote'; postId: string; targetType: 'post' | 'comment'; targetId: string; upvotes: number; downvotes: number }
  | { type: 'comment'; postId: string; comment: ForumComment }
  | { type: 'post_edited'; postId: string; title: string; content: string; updatedAt: string }
  | { type: 'post_deleted'; postId: string }
  | { type: 'comment_deleted'; postId: string; commentId: string };

export type FeedSSEEvent = {
  type: 'new_post';
  id: string;
  title: string;
  authorName: string | null;
  authorPhotoUrl: string | null;
  category: string;
  createdAt: string;
};

interface MessageEvent {
  data: object;
}

const REDIS_POST_CHANNEL = 'forum:events';
const REDIS_FEED_CHANNEL = 'forum:feed';

@Injectable()
export class ForumEventsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ForumEventsService.name);
  private readonly postSubject = new Subject<ForumSSEEvent>();
  private readonly feedSubject = new Subject<FeedSSEEvent>();
  private readonly unsubscribeFns: Array<() => void> = [];

  constructor(private readonly redis: RedisService) {}

  onModuleInit() {
    const unsubPost = this.redis.subscribe(REDIS_POST_CHANNEL, (data: unknown) => {
      if (data && typeof data === 'object' && 'postId' in data) {
        this.postSubject.next(data as ForumSSEEvent);
      }
    });
    const unsubFeed = this.redis.subscribe(REDIS_FEED_CHANNEL, (data: unknown) => {
      if (data && typeof data === 'object' && 'type' in data) {
        this.feedSubject.next(data as FeedSSEEvent);
      }
    });
    this.unsubscribeFns.push(unsubPost, unsubFeed);
    this.logger.log('Forum SSE event bridge initialized');
  }

  onModuleDestroy() {
    this.unsubscribeFns.forEach(fn => fn());
    this.postSubject.complete();
    this.feedSubject.complete();
  }

  async broadcastPostEvent(event: ForumSSEEvent): Promise<void> {
    if (this.redis.available) {
      await this.redis.publish(REDIS_POST_CHANNEL, event);
    } else {
      this.postSubject.next(event);
    }
  }

  async broadcastFeedEvent(event: FeedSSEEvent): Promise<void> {
    if (this.redis.available) {
      await this.redis.publish(REDIS_FEED_CHANNEL, event);
    } else {
      this.feedSubject.next(event);
    }
  }

  getPostStream(postId: string): Observable<MessageEvent> {
    return this.postSubject.pipe(
      filter(e => e.postId === postId),
      map(e => ({ data: e })),
    );
  }

  getFeedStream(): Observable<MessageEvent> {
    return this.feedSubject.pipe(
      map(e => ({ data: e })),
    );
  }
}
