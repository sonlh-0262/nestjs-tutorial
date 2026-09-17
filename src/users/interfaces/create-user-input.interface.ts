/**
 * Fields `UsersService.create` needs. The password arrives already hashed -
 * hashing is the auth module's job, the users module never sees a plain one.
 */
export interface CreateUserInput {
  username: string;
  email: string;
  passwordHash: string;
}
