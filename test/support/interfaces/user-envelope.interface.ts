/**
 * The `{ user: … }` body that `POST /users`, `POST /users/login`, `GET /user`
 * and `PUT /user` answer with.
 *
 * Written out by hand rather than reused from `UserDto`: a test asserting
 * against the type the controller serialises with would keep passing if that
 * type lost a field.
 */
export interface UserEnvelope {
  user: {
    email: string;
    username: string;
    bio: string | null;
    image: string | null;
    token?: string;
  };
}
