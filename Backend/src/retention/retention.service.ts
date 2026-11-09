import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  CollectionDto,
  CollectionItemDto,
  FeedQuery,
} from './retention.dto';
import type { ForumPost } from '../forum/forum.types';

export type ReadingCollection = {
  id: string;
  owner_uid: string;
  name: string;
  description: string;
  visibility: 'public' | 'private';
  created_at: string;
  updated_at: string;
};
export type CollectionDetail = ReadingCollection & {
  items: { manga_id: string; title: string; added_at: string }[];
};

@Injectable()
export class RetentionService {
  constructor(private readonly supabase: SupabaseService) {}

  async feed(uid: string, query: FeedQuery) {
    const { data, error } = await this.supabase.client
      .rpc('phase5_feed', {
        p_uid: uid,
        p_mode: query.mode,
        p_limit: query.limit,
        p_offset: query.offset,
      })
      .returns<{ items: ForumPost[]; total: number }>();
    if (error) throw new Error(`Supabase feed failed: ${error.message}`);
    return data as { items: ForumPost[]; total: number };
  }

  async list(uid: string) {
    const { data, error } = await this.supabase.client
      .from('reader_collections')
      .select('*')
      .eq('owner_uid', uid)
      .order('updated_at', { ascending: false })
      .limit(100)
      .returns<ReadingCollection[]>();
    if (error) throw new Error(`Supabase collections failed: ${error.message}`);
    return data;
  }

  async detail(id: string, uid: string | null): Promise<CollectionDetail> {
    // One statement checks visibility and reads items: no public/private TOCTOU.
    const { data, error } = await this.supabase.client
      .rpc('phase5_collection', { p_id: id, p_uid: uid })
      .returns<CollectionDetail | null>();
    if (error) throw new Error(`Supabase collection failed: ${error.message}`);
    if (!data) throw new NotFoundException('Collection not found');
    return data as CollectionDetail;
  }

  async create(uid: string, dto: CollectionDto) {
    const { data, error } = await this.supabase.client
      .from('reader_collections')
      .insert({ owner_uid: uid, ...dto })
      .select('*')
      .single<ReadingCollection>();
    if (error?.code === '23514')
      throw new BadRequestException('Collection limit reached');
    if (error)
      throw new Error(`Supabase create collection failed: ${error.message}`);
    return data;
  }

  async update(uid: string, id: string, dto: CollectionDto) {
    const { data, error } = await this.supabase.client
      .from('reader_collections')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_uid', uid)
      .select('*')
      .maybeSingle<ReadingCollection>();
    if (error)
      throw new Error(`Supabase update collection failed: ${error.message}`);
    if (!data) throw new NotFoundException('Collection not found');
    return data;
  }

  async remove(uid: string, id: string) {
    const { error } = await this.supabase.client
      .from('reader_collections')
      .delete()
      .eq('id', id)
      .eq('owner_uid', uid);
    if (error)
      throw new Error(`Supabase delete collection failed: ${error.message}`);
  }

  async item(uid: string, id: string, dto: CollectionItemDto, remove = false) {
    const { data, error } = await this.supabase.client
      .rpc('phase5_collection_item', {
        p_uid: uid,
        p_id: id,
        p_manga_id: dto.mangaId,
        p_title: dto.title,
        p_remove: remove,
      })
      .returns<boolean>();
    if (error?.code === '23514')
      throw new BadRequestException('Collection item limit reached');
    if (error)
      throw new Error(`Supabase collection item failed: ${error.message}`);
    if (!data) throw new NotFoundException('Collection not found');
  }
}
