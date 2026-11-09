import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { PushDeviceDto, PushPreferencesDto } from './push.dto';

@Injectable()
export class PushService {
  constructor(private readonly supabase: SupabaseService) {}

  async register(uid: string, dto: PushDeviceDto) {
    const { data, error } = await this.supabase.client
      .rpc('phase5_push_register', {
        p_uid: uid,
        p_device: dto.deviceId,
        p_token: dto.token,
        p_platform: dto.platform,
      })
      .returns<boolean>();
    if (error || data !== true)
      throw new Error('Supabase push registration failed');
    return { registered: true as const };
  }

  async remove(uid: string, dto: PushDeviceDto) {
    const { error } = await this.supabase.client
      .from('push_devices')
      .delete()
      .eq('uid', uid)
      .eq('device_id', dto.deviceId)
      .eq('token', dto.token);
    if (error) throw new Error('Supabase push removal failed');
  }

  async preferences(uid: string): Promise<PushPreferencesDto> {
    const { data, error } = await this.supabase.client
      .from('push_preferences')
      .select('new_chapter, new_follower')
      .eq('uid', uid)
      .maybeSingle<{ new_chapter: boolean; new_follower: boolean }>();
    if (error) throw new Error('Supabase push preferences failed');
    return {
      newChapter: data?.new_chapter ?? true,
      newFollower: data?.new_follower ?? true,
    };
  }

  async savePreferences(uid: string, dto: PushPreferencesDto) {
    const { error } = await this.supabase.client
      .from('push_preferences')
      .upsert({
        uid,
        new_chapter: dto.newChapter,
        new_follower: dto.newFollower,
      });
    if (error) throw new Error('Supabase push preferences failed');
    return dto;
  }
}
