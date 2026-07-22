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
