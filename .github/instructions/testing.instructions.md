---
applyTo: "**/*.test.*,**/*.spec.*,**/test_*.*,**/__tests__/**"
---
## TEST_RUNNER

- [P1-SHOULD] Use Vitest as the default test runner for new projects — it provides fast execution, native ESM support, and TypeScript out of the box.
- [P1-SHOULD] Use Jest when the existing project already uses it or when specific Jest ecosystem plugins are required.
- [P2-MAY] Use Playwright Test for end-to-end and integration tests that require browser interaction.

## STRUCTURE

- [P0-MUST] Follow Arrange-Act-Assert (AAA) pattern.
- [P1-SHOULD] One assertion per test when possible. Multiple acceptable when verifying a single behavior.
- [P1-SHOULD] Test names describe the behavior: `should return 404 when user is not found`.

## COVERAGE

- [P0-MUST] Test happy path: expected inputs produce expected outputs.
- [P0-MUST] Test error cases: invalid input, missing data, permission errors.
- [P1-SHOULD] Test edge cases: empty strings, zero, null/undefined, maximum values, boundary conditions.
- [P1-SHOULD] Test integration points: API contracts, database queries, external service calls.
- [P2-MAY] Do not test: implementation details, private methods, third-party library internals, trivial getters/setters.

## MOCKING

- [P0-MUST] Mock external dependencies (APIs, databases, file system, time).
- [P0-MUST] Do not mock the code under test.
- [P1-SHOULD] Prefer dependency injection over patching/monkey-patching.
- [P1-SHOULD] Reset mocks between tests to prevent state leakage.

## ORGANIZATION

- [P1-SHOULD] Mirror source directory structure or co-locate tests next to source files.
- [P1-SHOULD] Group related tests with `describe` blocks (JS/TS) or test classes (Python).
- [P2-MAY] Use setup/teardown hooks for shared test fixtures.

## QUALITY

- [P0-MUST] Tests must be deterministic — no flaky tests.
- [P0-MUST] Tests must be independent — running one must not affect another.
- [P1-SHOULD] Tests must be fast — mock slow dependencies.
- [P1-SHOULD] Delete obsolete tests. Dead tests erode confidence.
