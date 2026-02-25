---
applyTo: "**"
---
## NAMING

- [P0-MUST] Use descriptive, intention-revealing names for variables, functions, and classes.
- [P1-SHOULD] Functions describe actions (`getUserById`, `calculateTotal`, `validateInput`).
- [P1-SHOULD] Booleans read as questions (`isActive`, `hasPermission`, `canDelete`).
- [P1-SHOULD] Constants use UPPER_SNAKE_CASE. Variables and functions use camelCase or snake_case per language convention.

## FUNCTIONS

- [P0-MUST] Each function does one thing. If it needs "and" in its name, split it.
- [P1-SHOULD] Keep functions under 40 lines. Extract helpers when complexity grows.
- [P1-SHOULD] Limit parameters to 4. Use an options/config object for more.
- [P2-MAY] Prefer pure functions — same input always produces same output, no side effects.

## ERROR_HANDLING

- [P0-MUST] Handle errors at the appropriate level — do not catch errors just to re-throw unchanged.
- [P0-MUST] Never silently swallow errors. At minimum, log them.
- [P1-SHOULD] Provide actionable error messages that help diagnose the issue.
- [P1-SHOULD] Validate inputs at system boundaries (API handlers, CLI parsers, form processors).

## DEPENDENCIES

- [P1-SHOULD] Prefer well-maintained libraries with active communities.
- [P1-SHOULD] Pin dependency versions in lock files.
- [P2-MAY] Audit new dependencies for security vulnerabilities, bundle size, and maintenance status.

## IMPORTS

- [P1-SHOULD] Group imports: standard library, external packages, internal modules, relative imports.
- [P1-SHOULD] Remove unused imports.
- [P2-MAY] Prefer named imports over wildcard imports for clarity and tree-shaking.
