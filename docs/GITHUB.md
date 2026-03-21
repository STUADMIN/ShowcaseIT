# GitHub setup

The repo uses **git** at the monorepo root (`showcaseit/`).

## First-time push

1. Create an empty repository on GitHub (no README/license if you already have them locally).

2. From the project root:

```bash
cd showcaseit
git add -A
git status
git commit -m "chore: initial commit"
git branch -M main   # skip if already on main
git remote add origin https://github.com/YOUR_USER/showcaseit.git
git push -u origin main
```

If your first commit is already on `main`, use `git push -u origin main` only.

3. Use SSH if you prefer:

```bash
git remote add origin git@github.com:YOUR_USER/showcaseit.git
```

## GitHub CLI (`gh`)

```bash
gh auth login
cd showcaseit
gh repo create showcaseit --private --source=. --remote=origin --push
```

## Protect `main` (optional)

On GitHub: **Settings → Branches → Branch protection** for `main` (require PR, status checks).
