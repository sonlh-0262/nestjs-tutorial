let counter = 0;

/**
 * A process-wide counter for the values factories must keep unique:
 * `users.email`, `users.username` and `articles.slug` all carry unique indexes,
 * and the suite seeds hundreds of rows per file.
 *
 * A counter rather than a random suffix because it survives into failure
 * messages: `user-7` and `user-8` say which rows a failing case created and in
 * what order, where two uuids say nothing. It deliberately does not reset
 * between test cases - `clearDatabase()` empties the tables, so a value can only
 * collide with one from the same case.
 */
export function nextSequence(): number {
  counter += 1;

  return counter;
}
