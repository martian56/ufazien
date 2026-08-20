# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

Ufazien is a student platform: grade calculators, a blog, a community with real-time chat, a mini web-hosting service for student projects, and a multiplayer 3D campus with proximity voice. Django REST API plus a React SPA. It is deployed and has real users, so changes here reach people.

## Layout

```
backend/     Django project `ufazien`, one app per feature
frontend/    React 19 + Vite SPA
hosting/     nginx + php-fpm compose resource serving *.ufazien.com user sites
```

Backend apps: `api` `users` `blog` `gpa` `average` `game` `ai_tools` `hosting` `community` `schedule`.

Two naming traps:

- **`game`** is the campus simulator. **`schedule`** is the calendar. It is not called `calendar` because a top-level `calendar` package would shadow the standard library module Django itself imports.
- **`hosting`** is the mini-PaaS (user websites and databases). The `hosting/` directory at the repo root is unrelated: it is the nginx/php compose stack.

## Running it

```bash
# backend
cd backend && python -m venv .venv && source .venv/Scripts/activate
pip install -r requirements-dev.txt
SECRET_KEY=dev python manage.py migrate
SECRET_KEY=dev python manage.py runserver

# frontend
cd frontend && bun install
VITE_API_URL=http://localhost:8000 bun run dev
```

`SECRET_KEY` is required. The database is SQLite unless `ENVIRONMENT=production`, so no server is needed locally.

Use `requirements-dev.txt`, not `requirements.txt`: the WebSocket tests import `channels.testing`, which pulls in `daphne`. Production serves ASGI with uvicorn and does not install it.

## Testing

```bash
cd backend && SECRET_KEY=test python manage.py test          # all
cd backend && SECRET_KEY=test python manage.py test community
```

Add tests for what you change. Most apps' `tests.py` began as an empty stub, and everything they now cover was a bug that reached production unnoticed.

The frontend runs Vitest: `bun run test`, with `bun run typecheck` for types. Coverage is thin and
starts at the API client, so a browser check still matters for anything visual. Say what you checked.

## Rules that matter here

**A user's email must never reach another user.** `email` is a `SerializerMethodField` that returns the address only to its owner, and `None` otherwise, including when there is no request in context, which is how WebSocket consumers serialize. See `community/serializers.py`; `community/tests.py` guards it. This leaked in production once.

**Scope user-owned data to its owner in `get_queryset`.** Another user's record should 404, not merely be absent from a list. `schedule/views.py` is the reference.

**Permissions are decided server-side.** The LiveKit token lists exactly which sources a participant may publish, derived from `LobbyMember` fields, so a modified client cannot grant itself the microphone or a screen share. Never move that decision into the browser.

**Never commit secrets.** `.env`, keys and certificates are gitignored. A private key was committed here once and is still in history.

## Traps this codebase has

**`requirements.txt` is UTF-16 with CRLF** (a PowerShell `pip freeze` artefact). pip copes; other tools may not. Preserve the encoding when editing it.

**Model properties are not queryset fields.** `Group.is_full` and `member_count` are Python properties. `.exclude(is_full=True)` raises `FieldError`, and annotating over a property name raises too. Count in the query and compare with `F()`.

**Django URL order matters.** `lobbies/stats/` must be declared before `lobbies/<lobby_id>/`, or `stats` is captured as a lobby id.

**Create serializers may omit `id`.** Several viewsets respond with the write serializer, giving clients no id back. Return the read serializer from `create()`.

**drei's `KeyboardControls` listens on the window** and does not exclude text fields. Anything reading it must ignore input while typing, or chat drives the player. `isTypingInField()` in `CampusWithBackend.jsx`.

**react-three-fiber aims the default camera at the origin.** A camera positioned directly above the origin ends up looking straight down.

**`utils/api.js` is a fetch client that returns parsed JSON**, not an axios `{data}` envelope. Do not destructure `.data` from it. Note `services/api.js` is a *different*, axios-based client.

**Emoji in `print()` crashes on Windows** under cp1252. Use logging.

## 3D assets

Almost everything in the campus is generated in code. What is not is listed
here, and these are the decisions it is built on.

**Models are built from packs, and only the output is committed.** The packs are
tens of megabytes and live nobody-knows-where; the built `.glb` is small and
lives in `frontend/public`. Re-running a build script is a deliberate act, not
part of `bun run build`.

- `scripts/build-avatars.mjs` — rigged characters, from Quaternius's Ultimate
  Modular Men and Women. Keeps 6 of the 24 clips and strips weapons.
- `scripts/build-props.mjs` — static props, from Ultimate Nature Pack (2019).
  Reads OBJ, because that pack has no glTF and its materials are flat `Kd`
  colours with no texture maps, which is what the rest of the campus looks like.
  The newer Stylized Nature pack *does* ship glTF and is textured — bark
  normals, leaf alpha, a megabyte per species — which is the wrong style and the
  wrong budget.

**No mesh compression, and none needed.** The whole outdoor prop set — four
trees, two bushes, two rocks — is 400 KB uncompressed, less than half of one
avatar. Draco or Meshopt would each add a decoder to fetch before anything
renders, to save a couple of hundred kilobytes. Revisit if the props ever pass
about 3 MB; until then the budget is the mechanism.

**Everything repeated is instanced, and the numbers are measured, not guessed.**
`RenderProbe` (`?probe=1` on the campus, development only) walks the camera to
fixed viewpoints and reads `gl.info.render.calls`, leaving the result on
`window.__campusProbe`. Quote before and after when a change adds anything to
the scene.

Baseline, at 1440×900 on `main`, no models:

| viewpoint | draw calls | triangles |
| --- | --- | --- |
| spawn | 425 | 45.8k |
| quad-north | 393 | 41.0k |
| spine-south | 454 | 50.7k |

**Draw calls are the metric that has bitten this project; triangles are the one
that bites phones.** The outdoor set as it ships — 150 trees of four species,
90 bushes, 40 rocks — costs +10 draw calls and +256k triangles against the
procedural version it replaced. `?trees=drawn` still renders the old one, which
is how that was decided.

## Deployment

Coolify on a Hetzner VPS, not from CI. `ci.yml` runs tests and a frontend build only. Do not add a deploy step to it.

Config lives in Coolify environment variables, not in the repo. `settings.py` reads `DB_HOST`, `DB_PORT`, `ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS`, `DJANGO_CSRF_TRUSTED_ORIGINS` and the `LIVEKIT_*` values from the environment.

## Working style

- Branch off `main`; the repository has branch protection and expects pull requests.
- Commit messages explain **why**. For a bug, describe the behaviour that was wrong.
- Keep changes focused. Unrelated refactoring makes review and revert harder.
- Commit the migration alongside a model change.
- Verify before claiming. Run the tests, check the browser, and say what you actually did, including what you could not verify.
