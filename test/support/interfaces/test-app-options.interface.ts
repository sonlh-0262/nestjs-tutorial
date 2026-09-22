export interface TestAppOptions {
  /**
   * Mount the OpenAPI document. Off by default: building it costs a full pass
   * over every controller, and only `app.e2e-spec.ts` asserts it.
   */
  swagger?: boolean;
}
