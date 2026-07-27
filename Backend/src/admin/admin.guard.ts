import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { ROLE } from '../users/users.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const uid: string | undefined = req.uid;
    if (!uid) throw new ForbiddenException('Forbidden');

    const { data } = await this.supabase.client
      .from('profiles')
      .select('role')
      .eq('uid', uid)
      .maybeSingle<{ role: number }>();

    if (!data || data.role < ROLE.ADMIN)
      throw new ForbiddenException('Admin access required');
    return true;
  }
}
