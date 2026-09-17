import { User } from '../../users/entities/user.entity';

/**
 * What register and login both hand back: the account, and the freshly signed
 * token the controller returns with it.
 */
export interface AuthenticationResult {
  user: User;
  token: string;
}
