---
applyTo: "**"
---
## CORE_WEB_VITALS

- [P0-MUST] Target: LCP (Largest Contentful Paint) < 2.5 seconds.
- [P0-MUST] Target: INP (Interaction to Next Paint) < 200 milliseconds.
- [P0-MUST] Target: CLS (Cumulative Layout Shift) < 0.1.
- [P1-SHOULD] Measure before and after optimizations. Do not optimize based on intuition alone.

## IMAGES

- [P0-MUST] Use framework-provided image components when available (e.g., `next/image`, `nuxt-img`) — never raw `<img>` tags.
- [P1-SHOULD] Use modern formats: WebP or AVIF for raster, SVG for icons and illustrations.
- [P1-SHOULD] Set explicit `width` and `height` to prevent layout shift.
- [P1-SHOULD] Use lazy loading for below-the-fold images.
- [P2-MAY] Use `priority` attribute for LCP images (hero images, above-the-fold).

## BUNDLE_SIZE

- [P0-MUST] Never import entire libraries when only specific functions are needed (e.g., `import { debounce } from 'lodash/debounce'` not `import _ from 'lodash'`).
- [P1-SHOULD] Use dynamic imports (`React.lazy`, or framework equivalents) for heavy components not needed on initial load.
- [P1-SHOULD] Use code splitting at route boundaries.
- [P2-MAY] Analyze bundle size with tools like `webpack-bundle-analyzer` or framework-specific analyzers.

## DATA_FETCHING

- [P0-MUST] Never fetch data in loops. Batch requests or use a single query.
- [P1-SHOULD] Cache API responses appropriately. Use stale-while-revalidate patterns.
- [P1-SHOULD] Use pagination for list endpoints. Never fetch unbounded datasets.
- [P1-SHOULD] Prefetch data for likely next navigations.

## RENDERING

- [P1-SHOULD] Prefer server-side rendering for initial page load. Hydrate interactive parts client-side.
- [P1-SHOULD] Use `<Suspense>` boundaries to stream content progressively.
- [P1-SHOULD] Avoid layout thrashing — batch DOM reads and writes.
- [P2-MAY] Use `requestAnimationFrame` for smooth animations.

## DATABASE

- [P0-MUST] Add indexes for columns used in WHERE, JOIN, and ORDER BY clauses.
- [P0-MUST] Use LIMIT on all queries against large tables.
- [P1-SHOULD] Use connection pooling for database access.
- [P1-SHOULD] Avoid N+1 queries — use JOINs or batch loading.
