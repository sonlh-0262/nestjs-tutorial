import { User } from '../../users/entities/user.entity';
import { TokenIdentity } from './token-identity.interface';

export interface AuthenticatedUser extends TokenIdentity {
  user: User;
}
