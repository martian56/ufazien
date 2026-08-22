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
that bites phones.** Everything outdoors as it ships — 150 trees of four
species, 90 bushes, 40 rocks and the street planting — measures **444 draw
calls and 339.4k triangles** at the spawn, against 425 and 45.8k for the
procedural version it replaced. `?trees=drawn` still renders the old one, which
is how that was decided.

The four tree species carry 3, 4, 2 and 3 primitives, so the campus scatter is
twelve instanced meshes however many trees are in it, and the street planting
three more.

**There are two tree scatters, and they are in different files.** The campus
grounds are `CampusProps` in `CampusScenery`; the street planting along Nizami
Street is `StreetTrees` in `NizamiDistrict`. Changing one and not the other
leaves half the trees looking like the old ones, which is exactly what
happened. Both draw models now — the campus mixes four species, the street uses
one, because a municipality plants one tree down a road.

Indoors the win is the other way round. The cafeteria drew sixteen tables and
sixty-four chairs as separate objects — 464 meshes, computed from the
components rather than measured, because reaching an interior with the probe
means walking there. (`Table` is five meshes and `Chair` six: the legs are
inside a `.map`, so counting JSX tags undercounts them, which is how this was
first written down as 448.) As two instanced models that is four draw calls,
and the sixty-fifth chair is free.

**Furniture and the seat it carries must read the same constants.** A seat says
where a player is put; the model says where the furniture looks. Stated twice
they drift, and the player sits in mid-air — which happened to the entrance
hall's benches, three metres apart for months.

## Deployment

Coolify on a Hetzner VPS, not from CI. `ci.yml` runs tests and a frontend build only. Do not add a deploy step to it.

Config lives in Coolify environment variables, not in the repo. `settings.py` reads `DB_HOST`, `DB_PORT`, `ALLOWED_HOSTS`, `DJANGO_CORS_ALLOWED_ORIGINS`, `DJANGO_CSRF_TRUSTED_ORIGINS` and the `LIVEKIT_*` values from the environment.

## Releases

Push a tag beginning with `v` and `release.yml` publishes a GitHub release for
it. It deploys nothing — Coolify still does that from the server.

The notes are built by `.github/scripts/release_notes.py` from the commits
between this tag and the one before it: what changed, grouped by area, with the
pull request beside each line, then the numbers and who wrote it. It welcomes
anybody whose first commit is in that range, matched on email address rather
than name — the same person appears here as both `Martian` and `martian56`.

Its tests run in CI, on every pull request, because a release happens once and
whatever it produces is what people read. A tag with a hyphen in the version
(`v1.2.0-rc.1`) publishes as a pre-release. Re-running the workflow on a tag
updates the notes rather than failing.

## Working style

- Branch off `main`; the repository has branch protection and expects pull requests.
- Commit messages explain **why**. For a bug, describe the behaviour that was wrong.
- Keep changes focused. Unrelated refactoring makes review and revert harder.
- Commit the migration alongside a model change.
- Verify before claiming. Run the tests, check the browser, and say what you actually did, including what you could not verify.

## Hosting analytics

Traffic comes from nginx's own access logs, not from anything in the user's
site. `hosting/nginx/hosting.conf` writes one JSON object per request to
`/var/log/hosting/access.log` — a bind mount the Django resource also sees, and
deliberately outside the webroot, because anything under `/var/www/html` is
servable and `logs.ufazien.com` would have handed out every visitor's address.

`manage.py aggregate_access_logs` rolls those into one `WebsiteAnalytics` row
per site per day. Run it on a timer. Everything it writes is an absolute total,
so running it twice changes nothing — and it refuses to lower a day's figures
unless given `--force`, because a log that holds less than it did is rotation
rather than a quieter day.

`bounce_rate` and `avg_session_duration` stay at zero, honestly: a log line is a
request, not a session. They need a script on the page, which nothing serves.

One run fills three tables: `WebsiteAnalytics` (the pages), `BandwidthUsage`
(the quota) and `Website.total_visits` (the header, the dashboard total, and the
public listing's sort order). All three were read by something and written by
nothing.

Bandwidth is stored in **bytes**. `BandwidthUsage.bandwidth_mb` is a whole
number of megabytes and the sites here serve kilobytes a day: rounding down
records a real day as nothing, rounding up records 14 KB as a megabyte. Read
`bandwidth_bytes`; the megabyte column is kept for older readers.

Storage is separate and already worked: `manage.py compute_storage` measures
`/srv/hosting/<subdomain>` and writes `Website.storage_used_mb`. Run it on a
timer too.

**Referrers are stored as an origin, never a full URL.** A `Referer` carries
the whole address of the page somebody came from, and that page belongs to a
different site than the one being reported to — its path and query can hold a
reset token, an unsubscribe link or somebody's email address. Keeping only
scheme and host is the same rule as the one about emails in `community`:
somebody else's identifier must not reach a site owner. `scrub_referrers`
reduces rows written before that rule.

`webhooks/analytics/` is signed with `HOSTING_WEBHOOK_SECRET` and identifies a
site by subdomain. A subdomain says which site a payload is about and nothing
about who sent it, so without the signature anybody could post any figures for
anybody's site. Unset, the endpoint refuses everything rather than accepting
anything.
