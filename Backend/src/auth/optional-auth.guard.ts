import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { UID_KEY, USER_KEY } from './auth.guard';
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return true;
    }
    const idToken = authHeader.slice(7);
    try {
      const decoded = await this.supabase.verifyAccessToken(idToken);
      req[USER_KEY] = decoded;
      req[UID_KEY] = decoded.uid;
    } catch {
      /* ignore */
    }
    return true;
  }
}
