---
applyTo: "**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.mts,**/*.mjs"
---
## TYPE_SAFETY

- [P0-MUST] Never use `any` without justification — prefer `unknown` and narrow with type guards.
- [P1-SHOULD] Define explicit return types for exported functions.
- [P1-SHOULD] Use interfaces for object shapes and type aliases for unions/intersections.
- [P2-MAY] Use `readonly` for properties that should not be mutated after creation.

## SYNTAX

- [P0-MUST] Use `const` by default. Use `let` only when reassignment is necessary. Never use `var`.
- [P1-SHOULD] Use template literals over string concatenation.
- [P1-SHOULD] Use optional chaining (`?.`) and nullish coalescing (`??`) instead of verbose null checks.
- [P2-MAY] Use destructuring for function parameters and object access where it improves clarity.

## ASYNC

- [P0-MUST] Always handle Promise rejections — use try/catch or `.catch()`.
- [P1-SHOULD] Use `async/await` over raw Promises and callbacks.
- [P1-SHOULD] Use `Promise.all()` for independent concurrent operations.
- [P1-SHOULD] Avoid `await` inside loops — collect promises and await together.
- [P2-MAY] Use `Promise.allSettled()` when partial failure is acceptable.

## REACT

- [P1-SHOULD] Use functional components with hooks. No class components for new code.
- [P0-MUST] Do not use `forwardRef` — pass `ref` as a regular prop (React 19+).
- [P1-SHOULD] Extract custom hooks for reusable stateful logic.
- [P1-SHOULD] Keep components under 150 lines. Split when exceeded.
- [P2-MAY] Use `React.memo`, `useMemo`, `useCallback` only when profiling shows a benefit.
- [P2-MAY] Co-locate component, styles, tests, and types in the same directory.

## MODULES

- [P1-SHOULD] One primary export per file for components and classes.
- [P1-SHOULD] Keep helper functions private (unexported) unless reused elsewhere.
- [P2-MAY] Use barrel files (`index.ts`) for clean public APIs — do not re-export everything.
