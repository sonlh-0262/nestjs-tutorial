import { User } from '../../users/entities/user.entity';

export interface AuthenticatedUser {
  user: User;
  jti: string;
  expiresAt: number;
}
