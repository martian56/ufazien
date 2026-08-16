<div align="center">

<img src="frontend/public/icon-512.png" alt="Ufazien" width="104" height="104">

# Ufazien

**A student platform for UFAZ: calculators, a blog, a community, web hosting, and a multiplayer 3D campus.**

[![Live](https://img.shields.io/badge/live-ufazien.com-1F3A93?style=for-the-badge)](https://ufazien.com)
[![License](https://img.shields.io/badge/license-MIT-1F3A93?style=for-the-badge)](LICENCE)

[![CI](https://img.shields.io/github/actions/workflow/status/martian56/ufazien/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/martian56/ufazien/actions/workflows/ci.yml)
[![Issues](https://img.shields.io/github/issues/martian56/ufazien?style=flat-square)](https://github.com/martian56/ufazien/issues)
[![Pull requests](https://img.shields.io/github/issues-pr/martian56/ufazien?style=flat-square)](https://github.com/martian56/ufazien/pulls)
[![Last commit](https://img.shields.io/github/last-commit/martian56/ufazien?style=flat-square)](https://github.com/martian56/ufazien/commits/main)
[![Stars](https://img.shields.io/github/stars/martian56/ufazien?style=flat-square)](https://github.com/martian56/ufazien/stargazers)

[![Django](https://img.shields.io/badge/Django-5.2-092E20?style=flat-square&logo=django&logoColor=white)](https://www.djangoproject.com/)
[![DRF](https://img.shields.io/badge/DRF-3.16-A30000?style=flat-square)](https://www.django-rest-framework.org/)
[![Channels](https://img.shields.io/badge/Channels-4.0-092E20?style=flat-square)](https://channels.readthedocs.io/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vite.dev/)
[![three.js](https://img.shields.io/badge/three.js-r178-000000?style=flat-square&logo=three.js&logoColor=white)](https://threejs.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-4.1-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![LiveKit](https://img.shields.io/badge/LiveKit-WebRTC-1E1E1E?style=flat-square)](https://livekit.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)

<img src="images/campus.png" alt="The 3D campus: the UFAZ building on Nizami Street, with another student standing on the quad" width="100%">

</div>

---

## What it is

Ufazien is a platform built for students at the French-Azerbaijani University. It started as a GPA calculator and grew into the tools students kept asking for: somewhere to write, somewhere to talk, somewhere to put their projects online, and a campus they can walk around together.

It runs at **[ufazien.com](https://ufazien.com)**.

## What you can do with it

**Work out your grades.** A GPA calculator with semesters, targets and grade conversion. An average calculator where you build a grading schema once and publish it, so classmates reuse it instead of rebuilding the same spreadsheet every term.

**Put your project online.** Every user gets subdomains under `*.ufazien.com`, static or PHP hosting, provisioned MySQL and PostgreSQL databases, and TLS. Deploy from the dashboard or with the [`ufazien-cli`](https://github.com/martian56/ufazien-cli).

**Write and read.** A blog with a rich text editor, image uploads, categories and tags.

**Talk to people.** Study groups with real-time chat, plus forums, posts and threaded replies.

**Meet on campus.** A multiplayer 3D campus you can walk around with other students. Voice fades with distance, so conversations happen where you're standing. Buildings can be entered, and inside there's a board for screen sharing, enough to run a study session or a lecture, with the host controlling who can speak and present.

**Ask an AI.** A text humanizer backed by Azure OpenAI, with more tools planned.

## A look at it

<table>
<tr>
<td colspan="2"><img src="images/lecture.png" alt="A lecture in the amphitheatre: a shared screen on the projector, the presenter at the lectern"></td>
</tr>
<tr>
<td colspan="2"><b>A lecture, inside the building.</b> Someone shares their screen and it lands on the projector in the room, not pasted over your view. Voice fades with distance, so the back row can whisper. The host decides who may speak and present, and the server issues the publishing rights to match.</td>
</tr>
<tr>
<td width="50%"><img src="images/dashboard.png" alt="The dashboard: GPA, credits, upcoming events and recent activity"></td>
<td width="50%"><img src="images/hosting.png" alt="Hosting: three student sites on ufazien.com subdomains with storage and visit counts"></td>
</tr>
<tr>
<td><b>Dashboard.</b> Where your term stands, what is next, and who has been in touch. <code>Ctrl K</code> opens search from anywhere.</td>
<td><b>Hosting.</b> Student projects on their own subdomains, with storage, traffic and TLS.</td>
</tr>
<tr>
<td><img src="images/community.png" alt="A study group chat about a past exam paper"></td>
<td><img src="images/average.png" alt="The average calculator with a weighted UFAZ schema and a computed average"></td>
</tr>
<tr>
<td><b>Community.</b> Study groups with real-time chat, plus forums and threaded replies.</td>
<td><b>Average calculator.</b> Build a weighted schema once, publish it, and the rest of your year reuses it.</td>
</tr>
</table>

## How it fits together

A Django REST API with WebSocket consumers for anything real-time, and a React single-page app in front of it.

| Layer | Built with |
|---|---|
| **API** | Django 5.2 · Django REST Framework · JWT auth · drf-spectacular |
| **Real-time** | Django Channels, for campus positions, group chat and notifications |
| **Voice & screen share** | LiveKit, with publishing rights issued server-side per participant |
| **Frontend** | React 19 · Vite · Tailwind CSS · three.js via react-three-fiber |
| **Data** | PostgreSQL for the app; per-user MySQL and PostgreSQL for hosted projects |
| **Edge** | Traefik, wildcard TLS across `*.ufazien.com` |

API reference is generated from the code and served at **[api.ufazien.com/api/docs/](https://api.ufazien.com/api/docs/)**.

## Contributing

Contributions are welcome: bug reports, fixes and features alike.

**Start with [CONTRIBUTING.md](CONTRIBUTING.md).** It covers getting the project running locally, how branches and pull requests work here, and what CI expects before a change can merge.

By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

Found a security problem? Please don't open a public issue. See the [Security Policy](SECURITY.md).

## License

[MIT](LICENCE) © Fuad Alizada
