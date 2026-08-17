# Contributing to Ufazien

Thanks for wanting to help. Bug reports, fixes, docs and features are all welcome.

If you're a UFAZ student, this is your platform. The features that get built are usually the ones somebody asked for.

## Before you start

For anything beyond a small fix, open an issue first. It's easier to agree on an approach in a paragraph than in a pull request that took you an evening. Small, obvious fixes can go straight to a PR.

## Getting it running

You need **Python 3.11**, **Node 24**, and **git**. No database server is required: the backend falls back to SQLite unless `ENVIRONMENT=production`.

The Node version matters: `frontend/.nvmrc` pins it, so `nvm use` in `frontend/` picks the right one. Newer Node works, but it is the version CI runs and the one to reproduce a failure against.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate      # Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt

export SECRET_KEY=anything-for-local-use
python manage.py migrate
python manage.py runserver
```

The API is then on `http://localhost:8000`, with docs at `/api/docs/`.

`requirements-dev.txt` includes the runtime dependencies plus `daphne`. The WebSocket tests need it, and so does `runserver`: Channels 4 keeps the ASGI-aware development server in `daphne`, and `settings.py` enables it whenever it is installed. Without it `runserver` is an ordinary WSGI server, and the campus loads but nobody else ever appears in it. Production installs `requirements.txt` only and serves ASGI through uvicorn.

### Frontend

```bash
cd frontend
bun install
VITE_API_URL=http://localhost:8000 bun run dev
```

Open the URL Vite prints. Create an account through the UI, or use the Django admin after `python manage.py createsuperuser`.

### Optional: voice and screen sharing

The campus simulator's voice features need a LiveKit server. Without one everything else still works; voice reports that it isn't configured and the rest of the game is unaffected. To enable it, put these in `backend/.env`:

```
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_URL=wss://your-livekit-host
```

[LiveKit Cloud](https://livekit.io/) has a free tier that works for development.

## Running the tests

```bash
cd backend
python manage.py test              # everything
python manage.py test community    # one app
```

Please add tests for what you change. Several apps started life with an empty `tests.py`, and every bug those files now cover was one that reached production unnoticed.

The frontend runs Vitest: `bun run test`, plus `bun run typecheck`. Coverage is still thin, so verify
visual changes in the browser too, and say in the PR what you actually checked.

## Making a change

1. Branch off `main`. Name it for what it does: `fix/chat-autoscroll`, `feat/calendar-recurrence`.
2. Keep the change focused. A PR that fixes one thing gets reviewed; a PR that fixes five gets postponed.
3. Write a commit message that explains **why**, not just what. If you fixed a bug, describe the behaviour that was wrong.
4. Open a pull request against `main` and fill in the template.

CI runs on every PR: Django checks, migrations and the full test suite on Python 3.11, plus a frontend build on Node 24. Both must pass. Lint runs but doesn't block yet.

## What reviewers look for

- **Does it work?** Say how you know. "Tests added" or "verified in the browser, here's what I clicked" both count.
- **Is the scope right?** Unrelated refactoring makes a change harder to review and harder to revert.
- **Does it match the code around it?** Follow the patterns already in the file rather than introducing a new style.
- **Migrations included?** If you touched a model, commit the migration with it.

## A few project-specific rules

**Never expose one user's email to another.** Serializers that include user data must return an email only to the user it belongs to. `community/serializers.py` shows the pattern, and `community/tests.py` guards it. This has gone wrong before.

**Don't commit secrets.** `.env`, keys and certificates are gitignored, so keep it that way. If you commit one by accident, tell a maintainer: rotating it matters more than rewriting history.

**Scope data to its owner.** Anything user-owned should be filtered by the requesting user in `get_queryset`, so another user's record returns 404 rather than merely being hidden from a list.

**Keep secrets out of the frontend.** Anything that decides permissions belongs on the server. The LiveKit integration is the reference: the token says what a participant may publish, so a modified client can't grant itself more.

## Reporting bugs

Open an issue with the bug template. The most useful reports say what you expected, what happened, and how to reproduce it. Screenshots help for anything visual.

## Security

Don't report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).

## Code of Conduct

Taking part means agreeing to the [Code of Conduct](CODE_OF_CONDUCT.md).
