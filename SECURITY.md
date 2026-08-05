# Security Policy

## Reporting a vulnerability

**Please don't open a public issue for a security problem.**

Report it privately instead, one of two ways:

- **GitHub:** [open a private advisory](https://github.com/martian56/ufazien/security/advisories/new) (preferred, keeps the discussion attached to the repository)
- **Email:** **fuadelizade6@gmail.com**

A useful report includes what the problem is, how to reproduce it, and what an attacker could do with it. A proof of concept helps but isn't required. A clear description of the flaw is enough to get started.

## What to expect

| | |
|---|---|
| First response | within 72 hours |
| Assessment and severity | within 7 days |
| Fix for a confirmed critical issue | as quickly as we can, typically days |

You'll be kept updated while it's being worked on, and credited when it's fixed unless you'd rather not be.

## Scope

Ufazien is a live platform, so the following are in scope:

- **ufazien.com** and **api.ufazien.com**
- User-hosted sites under **\*.ufazien.com**, where the flaw is in the platform rather than in a user's own site
- This repository, including the deployment and CI configuration

Particularly interested in:

- Anything exposing one user's data to another, **especially email addresses**, which must never reach another user
- Escaping the boundary of a hosted site, or reaching another user's hosted files or databases
- Authentication and authorisation flaws, including anything letting a participant grant themselves permissions in the campus simulator
- Secrets reachable over HTTP from a hosted site

Out of scope:

- Vulnerabilities in a user's own uploaded site content
- Denial of service through sheer volume of traffic
- Missing hardening headers with no demonstrated impact
- Reports produced by a scanner with no evidence of exploitability

## Supported versions

The deployed platform is what's supported. Fixes land on `main` and go out with the next deployment; there are no maintained release branches.

## Disclosure

Please give us a reasonable window to ship a fix before disclosing publicly. We'd rather work with you on the timing than be surprised by it.
