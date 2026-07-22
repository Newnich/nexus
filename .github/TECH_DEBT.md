# Technical Debt — ESLint Warnings

## ✅ Resolved

All pre-existing `react-hooks/exhaustive-deps` warnings have been fixed.

| #   | File                                          | Fix Applied                                                                                            |
| --- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | `app/(dashboard)/graph/page.tsx`              | Changed `viewBox.w/h` to `viewBoxRef.current.w/h` so the simulation effect doesn't restart on zoom/pan |
| 2   | `app/(dashboard)/items/new/new-item-form.tsx` | Wrapped `handleFiles` in `useCallback` with `[title]` dep, added to `handleFileDrop` deps              |
| 3   | `app/(dashboard)/items/new/new-item-form.tsx` | Same — added `handleFiles` to `handleFileSelect` deps                                                  |
| 4   | `app/(dashboard)/items/[id]/page.tsx`         | Added `trackView` to `useEffect` dependency array                                                      |
| 5   | `app/page.tsx`                                | Moved `PHRASES` constant from component body to module scope                                           |

## Verification

```bash
npm run lint
# Result: 0 errors, 0 warnings 🎉
```

## Future Pattern

When adding new hooks/effects, follow these guidelines to avoid the same warnings:

1. **Stable references** — Functions that don't change between renders should be wrapped in `useCallback` with proper deps
2. **Module-level constants** — Pure constant arrays/objects should be defined outside the component
3. **Refs for mutable values** — Use refs for values that change frequently but shouldn't trigger effect re-runs
4. **Disabled comments** — Only use `// eslint-disable-next-line` when you have a documented reason that affects other team members
