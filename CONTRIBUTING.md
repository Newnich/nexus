# Contributing to NEXUS

## 🚀 Quick Start

```bash
# Clone the repo
git clone https://github.com/Newnich/nexus.git
cd nexus

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Fill in .env.local with your Supabase credentials, then:
npm run seed        # Populate test data
npm run dev         # Start development server
```

## 🌿 Branch Strategy

| Branch    | Purpose                                      | Protected                    |
| --------- | -------------------------------------------- | ---------------------------- |
| `master`  | Production — deploys to Vercel automatically | ✅ CI must pass, PR required |
| `feat/*`  | New features (e.g. `feat/dark-mode`)         | ❌                           |
| `fix/*`   | Bug fixes (e.g. `fix/login-error`)           | ❌                           |
| `chore/*` | Maintenance (e.g. `chore/update-deps`)       | ❌                           |
| `docs/*`  | Documentation (e.g. `docs/api-guide`)        | ❌                           |

**Rule:** All work happens on feature branches. `master` is always deployable.

## 🔄 PR Workflow

```
Create branch → Commit → Push → Open PR → CI passes → Merge
```

### Step-by-step

1. **Create a branch** from the latest `master`:

   ```bash
   git checkout master
   git pull origin master
   git checkout -b feat/my-feature
   ```

2. **Make changes and commit**:

   ```bash
   git add .
   git commit -m "feat: add my feature"
   ```

3. **Push and open a PR**:

   ```bash
   git push origin feat/my-feature
   ```

   Then open a PR at **https://github.com/Newnich/nexus/pulls**

4. **CI runs automatically** — the pipeline checks:
   - ✅ TypeScript type checking (`tsc --noEmit`)
   - ✅ Linting (`next lint`)
   - ✅ Test data seeded into Supabase
   - ✅ Production build succeeds
   - ✅ 10 E2E tests pass against the build

5. **Merge once CI passes** — click "Merge pull request" on GitHub

## ✅ What the CI Does

Every push and PR triggers the **CI** workflow:

```
npm ci                  → Clean install dependencies
npx playwright install  → Install test browsers
tsc --noEmit            → TypeScript type check
next lint               → ESLint check
npx tsx scripts/seed.ts → Seed test data into Supabase
npm run build           → Production build
npx playwright test     → 10 E2E tests against the build
```

All checks must pass before merging into `master`.

## 🌐 Preview Deployments

When you open a PR, **Vercel** automatically:

1. Builds your branch
2. Deploys it to a unique preview URL
3. Posts the preview link as a comment on the PR

This lets you test changes in a live environment before merging.

## 🧪 Testing

### E2E Tests

All E2E tests are in `e2e/` using Playwright:

```bash
# Run all tests (requires dev server or production build)
npx playwright test

# Run a specific test
npx playwright test --grep "Dashboard"

# Open the Playwright UI
npx playwright test --ui
```

### Adding Tests

When adding new features, include E2E tests that verify:

- The page renders without errors
- Key interactive elements work
- Data loads correctly from the API

## 📝 Commit Guidelines

Use descriptive commit messages in the present tense:

| Prefix   | Example                            |
| -------- | ---------------------------------- |
| `feat:`  | `feat: add dark mode toggle`       |
| `fix:`   | `fix: handle empty search results` |
| `chore:` | `chore: update dependencies`       |
| `docs:`  | `docs: add API reference`          |
| `test:`  | `test: add graph page E2E tests`   |

## 🔧 Environment Variables

Required in `.env.local` for local development:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Supabase credentials are also configured in:

- **GitHub Secrets** (for CI)
- **Vercel Environment Variables** (for production & preview)

---

## 🦴 Skeleton System (Loading States)

NEXUS uses a **two-layer skeleton system** to give users immediate visual feedback during loading:

1. **`loading.tsx`** — Automatically shown by Next.js during SSR streaming and route transitions (server-side)
2. **Inline `if (loading) { return }`** — Shown while the client-side component fetches its own data

### PageSkeleton (Reusable Layout Skeleton)

`components/page-skeleton.tsx` provides the common page layout skeleton (header + search + filters + content). Import it in `loading.tsx` or inline loading blocks:

```tsx
import { PageSkeleton } from "@/components/page-skeleton";

export default function MyPageLoading() {
  return (
    <PageSkeleton
      titleWidth="w-48" // Width of title skeleton (default: "w-48")
      subtitleWidth="w-64" // Width of subtitle skeleton (default: "w-64")
      actionWidths={["w-36"]} // Widths of action button skeletons
      searchBar // Show a search bar skeleton
      filterCount={6} // Number of filter chip skeletons
      filterWidth="w-20" // Width of each filter chip (default: "w-20")
    >
      {/* Page-specific content skeleton */}
      <ItemSkeleton viewMode="grid" count={8} />
    </PageSkeleton>
  );
}
```

### Page-Specific Skeleton Components

| Component            | File                                 | Matches                   | Props                                                                                             |
| -------------------- | ------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------- |
| `ItemSkeleton`       | `components/item-skeleton.tsx`       | Items list cards          | `viewMode: "grid" \| "list"` (default: `"grid"`), `count?: number` (default: `8` grid / `5` list) |
| `CollectionSkeleton` | `components/collection-skeleton.tsx` | Collections list cards    | `count?: number` (default: `4`)                                                                   |
| `ActivitySkeleton`   | `components/activity-skeleton.tsx`   | Activity timeline entries | `count?: number` (default: `5`)                                                                   |

### Quick Reference — When to Use What

| Pattern                                      | Where                                            | Example                             |
| -------------------------------------------- | ------------------------------------------------ | ----------------------------------- |
| **`loading.tsx` + `PageSkeleton`**           | New page — always create one                     | `app/(dashboard)/items/loading.tsx` |
| **`if (loading) { return <PageSkeleton> }`** | Early-return loading (replaces entire component) | Settings pages, Graph page          |
| **`{loading && <PlainContentSkeleton>}`**    | Inline loading (real header already visible)     | Tags page, Search page              |

### Rules for Adding Loading States to a New Page

1. **Create `loading.tsx`** — Always create a `loading.tsx` file in the route directory for SSR streaming
2. **Use `PageSkeleton`** for the page wrapper in `loading.tsx` — pass the right widths and filter count
3. **Pass the page-specific skeleton** (ItemSkeleton, CollectionSkeleton, etc.) as children
4. **For client-side loading**, use:
   - `if (loading) { return <PageSkeleton>...</PageSkeleton> }` if the loading state replaces the entire component output
   - `{loading && <div>...</div>}` with plain content skeletons if the real header/search bar are already rendered by the parent JSX
5. **All skeleton elements** must use the `skeleton` CSS class only — do not add `animate-pulse` or other animation classes (the `skeleton` class has its own shimmer animation)

### Example: Full Pattern for a New Page

```tsx
// app/(dashboard)/my-items/loading.tsx
import { PageSkeleton } from "@/components/page-skeleton";
import { ItemSkeleton } from "@/components/item-skeleton";

export default function MyItemsLoading() {
  return (
    <PageSkeleton
      titleWidth="w-32"
      subtitleWidth="w-56"
      actionWidths={["w-32"]}
      searchBar
      filterCount={4}
    >
      <ItemSkeleton viewMode="grid" count={8} />
    </PageSkeleton>
  );
}
```

```tsx
// app/(dashboard)/my-items/page.tsx (snippet — client-side loading)
import { PageSkeleton } from "@/components/page-skeleton";
import { ItemSkeleton } from "@/components/item-skeleton";

// Early-return pattern (replaces entire component during loading):
if (loading) {
  return (
    <PageSkeleton titleWidth="w-32" subtitleWidth="w-56" actionWidths={["w-32"]}>
      <ItemSkeleton viewMode="grid" count={8} />
    </PageSkeleton>
  );
}
```

### Styling

The `skeleton` CSS class is defined in `app/globals.css`:

```css
.skeleton {
  @apply bg-muted rounded;
  animation: shimmer 2s infinite;
  background: linear-gradient(
    90deg,
    rgba(30, 41, 59, 0) 0%,
    rgba(99, 102, 241, 0.05) 50%,
    rgba(30, 41, 59, 0) 100%
  );
  background-size: 200% 100%;
}
```

It produces a subtle indigo-tinted shimmer that matches the NEXUS brand. All skeleton components use this class exclusively — do not add additional animation classes.
