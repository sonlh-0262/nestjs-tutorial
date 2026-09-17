/**
 * Name of the bearer security scheme declared by `DocumentBuilder`.
 *
 * `addBearerAuth(..., name)` and every `@ApiBearerAuth(name)` have to use the
 * same string, otherwise Swagger UI renders the endpoint as public and never
 * sends the token.
 */
export const SWAGGER_BEARER_AUTH_NAME = 'access-token';
