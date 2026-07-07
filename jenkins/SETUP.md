# Jenkins → cPanel deployment setup

Deploys **both** apps on every build:

- **Frontend** (`evangadi2`, Vite/React) → built to `dist/` → uploaded to `public_html`.
- **Backend** (`Backend`, Express + MySQL) → uploaded to the cPanel Node app root → restarted.

Pipeline: **GitHub → Jenkins (Windows) → cPanel (SFTP)**.

---

## 1. Prerequisites on the Windows Jenkins machine

Install these once (and make sure Jenkins can see them on PATH):

- **Git** – https://git-scm.com
- **Node.js 18+ (22 recommended)** – either system-wide, or via the Jenkins **NodeJS** plugin.
- **WinSCP** – https://winscp.net – the deploy script uses `WinSCP.com`. Add its folder
  (e.g. `C:\Program Files (x86)\WinSCP`) to the system PATH, or the script auto-detects the default install path.

## 2. Jenkins plugins

Manage Jenkins → Plugins → install:

- **Pipeline**
- **Git**
- **Credentials Binding**
- **NodeJS** (only if you use the `tools { nodejs 'node22' }` block)

Then Manage Jenkins → **Tools** → NodeJS installations → add one named exactly **`node22`**
(version 22.x). If Node is already on PATH, delete the `tools { nodejs 'node22' }` line in the Jenkinsfile instead.

## 3. Credentials

Manage Jenkins → Credentials → (global) → **Add Credentials**:

- Kind: **Username with password**
- ID: **`cpanel-deploy`**  ← must match the Jenkinsfile
- Username / Password: your **cPanel FTP or SSH** account (create a dedicated FTP account in
  cPanel → *FTP Accounts* if you prefer scoped access).

## 4. Push the project to GitHub

From the project root (already `git init`-ed with a `.gitignore` that excludes `.env`, `node_modules`, `dist`, `*.zip`):

```bash
git remote add origin https://github.com/<you>/<repo>.git
git branch -M main
git push -u origin main
```

Confirm on GitHub that **no `.env` file** was pushed.

## 5. cPanel one-time setup

**Backend (Node app):** cPanel → *Setup Node.js App* → Create:
- Application root: the same path as `BACKEND_REMOTE` in the Jenkinsfile (e.g. `evangadi-backend`).
- Application startup file: `server.js`.
- Node version: 18+.
- Create the file **`.env`** inside that folder on the server with the real values
  (see `Backend/.env.example`). The pipeline never touches this file.
- The app restarts when `tmp/restart.txt` is updated — which the pipeline does automatically.

**Frontend:** ensure the domain/subdomain document root is the same as `FRONTEND_REMOTE`
(e.g. `public_html`). If the app uses client-side routing, add an `.htaccess` there:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

(The pipeline does not delete existing files, so a hand-placed `.htaccess` is safe.)

## 6. Create the Jenkins job

New Item → **Pipeline** →
- Pipeline → Definition: **Pipeline script from SCM**
- SCM: **Git**, your GitHub repo URL, branch `main`
- Script Path: **`Jenkinsfile`**

Edit the `environment { ... }` block at the top of the `Jenkinsfile` for your real values:
`VITE_API_BASE`, `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_PROTOCOL`, `FRONTEND_REMOTE`, `BACKEND_REMOTE`.

Click **Build Now**.

## 7. Auto-deploy on push (optional)

- Job → Configure → **Build Triggers** → *GitHub hook trigger for GITScm polling*.
- GitHub repo → Settings → Webhooks → add `http://<your-jenkins-host>:8080/github-webhook/`.
- Your Jenkins must be reachable from GitHub (public URL, or use *Poll SCM* `H/5 * * * *` if it is not).

---

## How a build works

1. Checkout from GitHub.
2. `npm ci && npm run build` in `evangadi2` (with `VITE_API_BASE` baked in) → `dist/`.
3. `npm ci --omit=dev` in `Backend` (pure-JS deps, safe to ship from Windows).
4. SFTP-sync `evangadi2/dist` → `public_html`.
5. SFTP-sync `Backend` (minus `.env`, `.git`, `*.zip`) → Node app root, then upload
   `tmp/restart.txt` to restart the app.

## Notes / hardening

- **Host key:** `deploy.ps1` uses `-hostkey="*"` (accept any). For production, pin it —
  run `winscp.com /command "open sftp://USER@HOST/" "exit"` once, copy the shown fingerprint,
  and replace `*` in `deploy.ps1`.
- **node_modules on the server:** shipped from Jenkins because all deps are pure JS. If you'd
  rather install on the server, add `node_modules/` to the backend `-FileMask` and run
  *Run NPM Install* in cPanel's Node app screen (needs the app's virtualenv).
- **Secrets** live only in the server `.env` and in Jenkins credentials — never in Git.
- **FTP instead of SFTP:** set `DEPLOY_PROTOCOL='ftp'` and `DEPLOY_PORT='21'` if your host has no SSH.
