import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export const UID_KEY = 'uid';
export const USER_KEY = 'supabaseUser';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const idToken = authHeader.slice(7);
    try {
      const decoded = await this.supabase.verifyAccessToken(idToken);
      req[USER_KEY] = decoded;
      req[UID_KEY] = decoded.uid;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
