# Evangadi — Deployment Guide (Jenkins → cPanel)

Complete record of the CI/CD setup: **GitHub → Jenkins (Windows) → cPanel shared hosting**.
Every `git push` auto-builds the frontend and deploys **both** apps.

---

## 1. Architecture

```
   You edit code
        │  git push
        ▼
   GitHub  (github.com/amir935/evangadi, branch: main)
        │  Jenkins polls every ~2 min
        ▼
   Jenkins  (Windows PC, http://localhost:8081)
        │  builds frontend, uploads over FTPS
        ├──────────────► evangadi.easywebsoft.com        (frontend / React SPA)
        └──────────────► evangadi-backend  (Node app)    → api-evangadi.easywebsoft.com
```

- **Frontend** — `evangadi2/` (Vite + React). Built with `npm run build` → `dist/`.
- **Backend** — `Backend/` (Express + MySQL). No build step; runs `node server.js` via cPanel Node app.

## 2. Environment values (this project)

| Setting | Value |
|---|---|
| GitHub repo | `https://github.com/amir935/evangadi.git` (branch `main`) |
| Jenkins URL | `http://localhost:8081` |
| Frontend URL | `https://evangadi.easywebsoft.com` |
| Backend URL (`VITE_API_BASE`) | `https://api-evangadi.easywebsoft.com` |
| cPanel host | `easywebsoft.com` |
| cPanel user | `easywebs` |
| Transfer | **FTPS** (explicit TLS), port **21** (host has no SSH) |
| Frontend remote path | `/evangadi.easywebsoft.com` |
| Backend remote path | `/evangadi-backend` |

> Over FTP the login root (`/`) **is** the home dir (`/home/easywebs`), so remote paths have **no** `/home/easywebs` prefix.

## 3. Files in the repo

| File | Purpose |
|---|---|
| `Jenkinsfile` | The pipeline: checkout → build frontend → prep backend → deploy both |
| `jenkins/deploy.ps1` | WinSCP helper that uploads a folder over FTPS and restarts the backend |
| `jenkins/SETUP.md` | Condensed setup checklist |
| `DEPLOYMENT.md` | This document |
| `.gitignore` | Keeps `.env`, `node_modules`, `dist`, `*.zip` out of git |
| `Backend/.env.example`, `evangadi2/.env.example` | Templates showing required env keys (no secrets) |

---

## 4. One-time setup

### 4.1 Git + GitHub
```bash
cd "c:/Users/Amir OMEN/Desktop/Desktop2/VidiewCheclist"
git init            # (already done)
git remote add origin https://github.com/amir935/evangadi.git
git branch -M main
git push -u origin main
```
Confirm on GitHub that **no `.env`** file was uploaded.

### 4.2 Install on the Jenkins PC
- **Java (JDK 21)** — https://adoptium.net
- **Jenkins (Windows)** — https://www.jenkins.io/download/ → install on **port 8081**
  (port 8080 was already taken by an EDB Postgres Apache service).
- **Node.js 22** — https://nodejs.org
- **WinSCP** — https://winscp.net (the deploy script calls `WinSCP.com`)

### 4.3 Jenkins plugins
Manage Jenkins → Plugins → Available → install: **NodeJS**, **Git**, **Credentials Binding**.
Restart Jenkins when done.

### 4.4 Jenkins Node tool
Manage Jenkins → **Tools** → **NodeJS installations** → **Add NodeJS**:
- Name: `node22` (must match the Jenkinsfile)
- Install automatically → version 22.x → **Save**

> ⚠️ This is under **Tools**, not **Nodes** (Nodes = extra build machines — not what we want).

### 4.5 Credential
Manage Jenkins → Credentials → (global) → Add Credentials:
- Kind: **Username with password**
- ID: **`cpanel-deploy`** (must match the Jenkinsfile)
- Username: `easywebs`  ·  Password: your cPanel password

### 4.6 The pipeline job
New Item → name `evangadi-deploy` → **Pipeline** → OK. In the **Pipeline** section:
- Definition: **Pipeline script from SCM**
- SCM: **Git** · Repo URL: `https://github.com/amir935/evangadi.git`
- Credentials: none if the repo is public; else a GitHub user + Personal Access Token
- Branch: `*/main` · Script Path: `Jenkinsfile` → **Save**

### 4.7 cPanel
- **Setup Node.js App** → app with root `evangadi-backend`, startup file `server.js`, Node 18+.
- Create the real **`.env`** inside `evangadi-backend` on the server (see `Backend/.env.example`).
  The pipeline never overwrites it.
- The subdomain `evangadi.easywebsoft.com` document root must be `/evangadi.easywebsoft.com`
  (check cPanel → Domains/Subdomains → Document Root).

### 4.8 First build
On the `evangadi-deploy` job → **Build Now**. This also registers the auto-poll trigger.
Then, **once**, install backend deps on the server:
cPanel → **Setup Node.js App** → `evangadi-backend` → **Run NPM Install** → **Restart**.

---

## 5. Everyday workflow

```bash
git add -A
git commit -m "what you changed"
git push
```
Jenkins auto-builds within **~2 minutes** and deploys both apps. That's it.

- **Only** when you add/remove an npm package (change `Backend/package.json`):
  after the build, cPanel → Setup Node.js App → `evangadi-backend` → **Run NPM Install** → **Restart**.
- Verify a deploy: open `https://api-evangadi.easywebsoft.com/api/health` — the `version` field
  (in `Backend/server.js`) shows which build is live. Bump it on releases.

## 6. How the pipeline works (stages)

1. **Checkout** — pull `main` from GitHub.
2. **Build frontend** — `npm ci && npm run build` in `evangadi2` (bakes in `VITE_API_BASE`) → `dist/`.
3. **Prepare backend** — `npm ci --omit=dev` in `Backend` (validation only; not shipped).
4. **Deploy frontend** — FTPS-sync `evangadi2/dist` → `/evangadi.easywebsoft.com` (retries 3×).
5. **Deploy backend** — FTPS-sync `Backend` (minus `.env`, `.git`, `*.zip`, `node_modules`) →
   `/evangadi-backend`, then upload `tmp/restart.txt` to restart the Node app (retries 3×).

**Auto-deploy:** `triggers { pollSCM('H/2 * * * *') }` in the Jenkinsfile — Jenkins checks GitHub
every ~2 minutes. (Webhooks aren't used because Jenkins is on `localhost`, unreachable from GitHub.)

---

## 7. Troubleshooting (issues we actually hit)

| Symptom | Cause | Fix |
|---|---|---|
| `localhost:8080` shows "EDB Postgres" | Port 8080 taken by EDB's Apache | Install Jenkins on **8081** |
| `The server rejected SFTP connection, but it listens for FTP` | Host has no SSH/SFTP | Use **FTPS** (`DEPLOY_PROTOCOL='ftps'`, port 21) |
| `Can't change directory to /home/easywebs/...` | FTP root is the home dir | Use paths **without** `/home/easywebs` prefix |
| `Can't change directory to .../node_modules` (symlink error) | FTP can't carry `node_modules` symlinks | Exclude `node_modules/`; run **Run NPM Install** in cPanel |
| `Timeout detected (control connection)` | Transient FTP hiccup / host firewall throttle | Auto-retries 3×; if persistent, wait 15–30 min or whitelist Jenkins IP in cPanel cPHulk |
| `index.lock: File exists` | Interrupted git process | Delete `.git/index.lock` and retry |
| Auto-deploy "not working" | Poll interval | It's ~2 min by design; not instant |

## 8. Changing the poll speed / going instant

- Faster polling: change `pollSCM('H/2 * * * *')` → `pollSCM('* * * * *')` (every 1 min; cron minimum).
- **Instant** deploys need a GitHub **webhook**, which requires exposing Jenkins publicly
  (e.g. via **ngrok**) and adding `http://<public-url>/github-webhook/` in GitHub → Settings → Webhooks.

## 9. Security notes

- Secrets live only in the **server `.env`** and **Jenkins credentials** — never in git.
- FTPS encrypts the transfer; `deploy.ps1` accepts any TLS cert (`-certificate=*`). To harden, pin
  the certificate fingerprint.
- Rotate the cPanel password if it was ever exposed.
