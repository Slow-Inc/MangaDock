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
  // Tag events published by this instance so the Redis subscriber can skip them
  // (avoids double-delivery to local SSE clients when Redis is active)
  private readonly instanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  constructor(private readonly redis: RedisService) {}

  onModuleInit() {
    const unsubPost = this.redis.subscribe(REDIS_POST_CHANNEL, (data: unknown) => {
      if (data && typeof data === 'object' && 'postId' in data) {
        if ((data as Record<string, unknown>)['_src'] === this.instanceId) return;
        const { _src: _, ...event } = data as Record<string, unknown>;
        this.postSubject.next(event as ForumSSEEvent);
      }
    });
    const unsubFeed = this.redis.subscribe(REDIS_FEED_CHANNEL, (data: unknown) => {
      if (data && typeof data === 'object' && 'type' in data) {
        if ((data as Record<string, unknown>)['_src'] === this.instanceId) return;
        const { _src: _, ...event } = data as Record<string, unknown>;
        this.feedSubject.next(event as FeedSSEEvent);
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
    // Always deliver to local SSE clients immediately (Redis may silently fail)
    if (!this.postSubject.closed) this.postSubject.next(event);
    if (this.redis.available) {
      try {
        await this.redis.publish(REDIS_POST_CHANNEL, { ...event, _src: this.instanceId });
      } catch (err) {
        this.logger.warn(`Redis publish failed for post event: ${String(err)}`);
      }
    }
  }

  async broadcastFeedEvent(event: FeedSSEEvent): Promise<void> {
    if (!this.feedSubject.closed) this.feedSubject.next(event);
    if (this.redis.available) {
      try {
        await this.redis.publish(REDIS_FEED_CHANNEL, { ...event, _src: this.instanceId });
      } catch (err) {
        this.logger.warn(`Redis publish failed for feed event: ${String(err)}`);
      }
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
