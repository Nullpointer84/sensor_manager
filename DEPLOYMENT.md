# Deployment

The app ships as **one Docker container**: the Spring Boot backend serves the REST API *and* the production build of the React SPA from the same origin. The client's relative `/api/...` calls therefore work in production exactly as they do behind the Vite dev proxy — no CORS, no hardcoded backend origin.

- **Platform:** [Fly.io](https://fly.io) (region `arn`, Stockholm), config in [fly.toml](fly.toml).
- **Pipeline:** [GitHub Actions](.github/workflows/ci.yml) — tests on every PR and every push to `main`; deploy on green pushes to `main`.
- **Image:** multi-stage [Dockerfile](Dockerfile) — Node 22 builds the SPA → JDK 21 builds the jar with the SPA baked into `static/` → Temurin 21 JRE Alpine runtime, non-root user.

```
PR / push ──► backend-tests (gradlew test)
          ──► web-build     (npm ci && npm run build, strict tsc)
          ──► docker-build  (image assembles, not pushed)
                   │
push to main, all green
                   ▼
              deploy ──► flyctl deploy --remote-only ──► https://sensor-manager-nullpointer84.fly.dev
```

## One-time setup

1. **Install flyctl, then open a new terminal**

   ```powershell
   # Windows PowerShell — run directly (no `pwsh -Command` wrapper, or the
   # PATH update lands in a throwaway child process and `fly` won't be found).
   iwr https://fly.io/install.ps1 -useb | iex
   ```

   The installer adds `fly` to your user PATH but the current shell won't see it
   until restarted — **open a new terminal**, then sign in:

   ```powershell
   fly auth signup   # or: fly auth login
   ```

   > **Billing — read this.** A new Fly account gets a trial of **2 VM-hours or 7
   > days**, whichever comes first; you can create and deploy *without* a card, so
   > every step below initially works. But once the trial ends the app **stops
   > running and deploys start failing** until you add a payment method (Fly
   > dashboard → Billing). For the course requirement that the demo stays
   > reachable unattended, add a card now — with scale-to-zero the real cost is
   > cents/month, not free, but close.

2. **Create the app** (name must be globally unique — if taken, pick another name and search the repo for `sensor-manager-nullpointer84`, replacing every hit: `app` in [fly.toml](fly.toml), `environment.url` in [ci.yml](.github/workflows/ci.yml), the token command in step 3 below, and the URLs in [README.md](README.md), this file, and [CLAUDE.md](CLAUDE.md)):

   ```bash
   fly apps create sensor-manager-nullpointer84
   ```

3. **Create a deploy token and store it as a GitHub Secret** — this is the only credential anywhere; nothing sensitive lives in the repo:

   ```bash
   fly tokens create deploy --app sensor-manager-nullpointer84 --expiry 8760h
   ```

   Copy the full output (starts with `FlyV1 `), then on GitHub: **Settings → Secrets and variables → Actions → New repository secret**, name `FLY_API_TOKEN`, paste the token.

4. **Push to `main`.** The pipeline runs the three test/build jobs and then deploys. First deploy takes a few minutes (remote image build).

## The verify loop (course requirement)

1. Make a visible change (e.g. tweak the footer text in [App.tsx](web/src/App.tsx)).
2. Commit and push to `main`.
3. Watch the run under **Actions** — all three check jobs must pass, then wait for the `Deploy to Fly.io` job to go green.
4. Open <https://sensor-manager-nullpointer84.fly.dev> and confirm the change is live. (First hit after idle may take ~1 s to wake the machine, or ~15 s if Fly fell back to a full stop.)

Manual redeploy without a code change: **Actions → CI/CD → Run workflow** (the `workflow_dispatch` trigger), or `fly deploy --remote-only --ha=false` from the repo root.

## Operations notes

- **Scale-to-zero:** `auto_stop_machines = "suspend"` + `min_machines_running = 0` means the machine suspends (RAM snapshot) when idle. The next request resumes it in ~1 s; if Fly falls back to a full stop, the next request pays the ~15 s JVM boot instead. Set `min_machines_running = 1` if you want it always-warm (no wake delay, but it never scales to zero).
- **Health check:** Fly polls `/actuator/health` (Spring Actuator, already enabled). A failing deploy rolls back automatically.
- **Single machine:** the deploy uses `--ha=false` — one 512 MB shared-CPU machine is plenty for a read-only landing page. Fly billing is pay-as-you-go; with scale-to-zero the cost is a few cents/month, but a payment method must be on file (see the billing note in step 1).
- **Logs / status:** `fly logs`, `fly status` from the repo root.
- **No runtime secrets today:** the API is intentionally public and the data is a committed JSON snapshot. When a real database lands, put its URL/credentials in `fly secrets set ...` (runtime) and GitHub Secrets (pipeline) — never in `application.yml`.

## Known wrinkle: `gradlew` executable bit

`backend/gradlew` is committed without the Unix executable bit (the repo was created on Windows). The Dockerfile and the CI workflow both run `chmod +x gradlew` before using it, so nothing breaks — but the permanent fix is one command, run once:

```bash
git update-index --chmod=+x backend/gradlew && git commit -m "Make gradlew executable"
```

## Alternatives considered

- **Railway** — works with the same Dockerfile; config lives in the dashboard rather than the repo, and the Actions integration is less direct than Fly's token-based deploy.
- **Render free tier** — also Dockerfile-compatible and free, but free instances sleep and take ~1 min to wake (cold start + JVM boot), which makes the "reachable without you sitting next to it" demo noticeably worse.
- **GitHub Pages + separate API host** — splits the app across two origins, forcing CORS config and a hardcoded backend URL in the client, which this repo's architecture rules forbid.
