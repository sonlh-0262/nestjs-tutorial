/**
 * The `{ user: … }` body that `POST /users`, `POST /users/login`, `GET /user`
 * and `PUT /user` all answer with.
 *
 * Three spec files declared their own copy - two byte-identical, the third a
 * narrower subset that this one satisfies. Written out by hand rather than
 * reused from `UserDto` on purpose: a test that asserted against the very type
 * the controller serialises with would keep passing if that type lost a field.
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
