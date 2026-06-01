import api from './api';
import { AuthUser } from '@/types/user';

// ─── Get Current User ─────────────────────────────────────────────────────────

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const res = await api.get('/api/users/me');
    const u = res.data.user;
    return {
      id: u._id,
      username: u.username,
      email: u.email,
      avatar: u.avatar,
      rating: u.rating,
      stats: u.stats,
    };
  } catch {
    return null;
  }
}
