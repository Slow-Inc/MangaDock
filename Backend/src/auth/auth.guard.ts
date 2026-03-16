import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService, SupabaseUser } from '../supabase/supabase.service';

export const UID_KEY = 'uid';
export const USER_KEY = 'supabaseUser';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const accessToken = authHeader.slice(7);
    try {
      const user = await this.supabase.verifyToken(accessToken);
      req[USER_KEY] = user;
      req[UID_KEY] = user.uid;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
