/**
 * Constants owned by the users module.
 *
 * Single source of truth for the shape of a user: the entity columns, the auth
 * DTOs that validate incoming payloads and the Swagger docs all read from here.
 *
 * These lengths mirror the columns created by the `CreateUsersTable` migration.
 * Widening one means writing a new migration as well as editing this file.
 */

export const USERNAME_MIN_LENGTH = 3;

export const USERNAME_MAX_LENGTH = 50;

/** Letters, digits, underscore and hyphen only - no spaces, no dots, no `@`. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export const EMAIL_MAX_LENGTH = 255;

/** Wide enough for any bcrypt hash (60 chars) plus room for a future algorithm. */
export const PASSWORD_HASH_MAX_LENGTH = 255;

/** Maximum length of the profile image URL. */
export const IMAGE_URL_MAX_LENGTH = 512;
