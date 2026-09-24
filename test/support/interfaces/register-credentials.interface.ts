/** What `POST /users` needs to create an account. */
export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
}
