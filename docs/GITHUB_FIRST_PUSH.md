# First push to GitHub

Your project folder is already a **git** repo with an **initial commit** on branch `main`. `.env` is **not** tracked (see `.gitignore`). Generated `eval/latest-report.json` is ignored.

## 1. Create an empty repository on GitHub

1. Open [https://github.com/new](https://github.com/new).
2. **Repository name:** e.g. `elfster-ai-prototype`.
3. Choose **Public** (or Private).
4. **Do not** add a README, `.gitignore`, or license (avoids merge conflicts).
5. Click **Create repository**.

GitHub will show you commands; use the ones below instead if you prefer.

## 2. Connect `origin` and push

In PowerShell, from the project root (replace `YOUR_USER` and `YOUR_REPO`):

```powershell
cd c:\Users\Admin\Downloads\elfster-ai-prototype
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git branch -M main
git push -u origin main
```

- If Git asks you to sign in, use a **Personal Access Token** (classic) with `repo` scope as the password, or sign in via **Git Credential Manager**.
- Create a token: GitHub → **Settings** → **Developer settings** → **Personal access tokens**.

SSH variant (if you use SSH keys):

```powershell
git remote add origin git@github.com:YOUR_USER/YOUR_REPO.git
git push -u origin main
```

## 3. Windows: if `git commit` fails with `unknown option trailer`

Some installs route `git` through `cmd\git.exe` in a way that breaks subcommands like `commit-tree`. Use the real binary for commits:

```text
C:\Program Files\Git\mingw64\bin\git.exe
```

Your initial commit was created with that path so the repo is valid. For future commits, either update Git for Windows to a recent version or call `mingw64\bin\git.exe` directly.

## 4. After the push

- Import the repo in **Vercel** for a public URL (see main `README.md` → **Public deploy (Vercel)**).
