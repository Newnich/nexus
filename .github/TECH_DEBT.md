# Technical Debt — ESLint Warnings

These are pre-existing lint warnings that need to be addressed.

## 1. Graph Page — Missing `useEffect` Dependencies

- **File:** `app/(dashboard)/graph/page.tsx`
- **Line:** 322
- **Rule:** `react-hooks/exhaustive-deps`
- **Issue:** `useEffect` is missing dependencies `viewBox.h` and `viewBox.w`
- **Context:** The force-directed graph simulation re-initializes when `data` changes. The `viewBox` values (w, h) are used to calculate center coordinates for centering nodes, but including them in the deps array would trigger expensive re-initialization on every zoom/pan. Needs a ref-based solution or stable reference.

## 2. New Item Form — `useCallback` Missing `handleFiles` Dependency

- **File:** `app/(dashboard)/items/new/new-item-form.tsx`
- **Line:** 97
- **Rule:** `react-hooks/exhaustive-deps`
- **Issue:** `useCallback` (`handleFileDrop`) is missing the dependency `handleFiles`
- **Context:** `handleFileDrop` calls `handleFiles` which isn't in its dependency array. Since `handleFiles` is defined outside `useCallback`, this could lead to stale closure issues.

## 3. New Item Form — `useCallback` Missing `handleFiles` Dependency (duplicate)

- **File:** `app/(dashboard)/items/new/new-item-form.tsx`
- **Line:** 102
- **Rule:** `react-hooks/exhaustive-deps`
- **Issue:** `useCallback` (`handleFileSelect`) is missing the dependency `handleFiles`
- **Context:** Same as above — `handleFileSelect` also calls `handleFiles`. Both callbacks use the same stale reference.

## 4. Item Detail Page — `useEffect` Missing `trackView` Dependency

- **File:** `app/(dashboard)/items/[id]/page.tsx`
- **Line:** 81
- **Rule:** `react-hooks/exhaustive-deps`
- **Issue:** `useEffect` is missing the dependency `trackView`
- **Context:** The effect fetches item data and calls `trackView` to log the view in recently viewed history. `trackView` comes from the `useRecentlyViewed` hook and is currently excluded from deps, likely because its reference is stable enough or to avoid re-firing the effect.

## 5. Landing Page — `useEffect` Missing `phrases` Dependency

- **File:** `app/page.tsx`
- **Line:** 189
- **Rule:** `react-hooks/exhaustive-deps`
- **Issue:** `useEffect` is missing the dependency `phrases`
- **Context:** The landing page has a typing animation effect that cycles through phrases. The `phrases` array is a constant defined outside the component, so it never changes — but the linter can't infer this. The fix is either to move it inside the component with `useMemo` or add a disable comment.

## How to Fix

```bash
# To see all warnings yourself:
npm run lint
```

For each warning, either:

1. Add the missing dependency to the array
2. Wrap the value in `useCallback`/`useMemo` for stable references
3. Add `// eslint-disable-next-line react-hooks/exhaustive-deps` if intentionally excluded
