#!/usr/bin/env python3
"""
Release notes for Ufazien.

What went in, where it went, and who wrote it. The commits already say why —
anybody who wants that can follow the pull request from the line it is on.

Run it with a tag and it prints markdown:

    python3 .github/scripts/release_notes.py v1.2.0

The heavy lifting is pure functions over strings, so it can be tested without
a repository — see `test_release_notes.py`, which is what stops a broken
generator being discovered at the moment somebody pushes a tag.
"""

from __future__ import annotations

import argparse
import re
import subprocess
import sys
from collections import Counter, OrderedDict
from dataclasses import dataclass, field

#: Field and record separators for `git log --pretty`. A commit message can
#: contain newlines, pipes, tabs and anything else a person types, so the
#: separators are the two ASCII characters meant for exactly this.
#:
#: Not NUL, which would be the obvious choice: it cannot be passed to git at
#: all, because an argument is a NUL-terminated string and Python refuses to
#: build the argv. That is only visible when something actually runs git, which
#: is why there is a test that does.
FIELD = '\x1f'
RECORD = '\x1e'

LOG_FORMAT = FIELD.join(['%H', '%an', '%ae', '%s', '%b']) + RECORD

#: `type(scope): subject`, with the `!` that means a breaking change.
CONVENTIONAL = re.compile(r'^(?P<type>[a-z]+)(?:\((?P<scope>[^)]+)\))?(?P<breaking>!)?:\s*(?P<subject>.+)$')

#: The `(#123)` a squash merge leaves on the subject.
PR_NUMBER = re.compile(r'\s*\(#(\d+)\)\s*$')

CO_AUTHOR = re.compile(r'^Co-authored-by:\s*(?P<name>[^<]+?)\s*<(?P<email>[^>]*)>\s*$', re.IGNORECASE | re.MULTILINE)

#: How the sections are ordered and what they are called. The wording matters:
#: this project does not have a "Bug Fixes" section, it has an account of what
#: was wrong.
SECTIONS: "OrderedDict[str, str]" = OrderedDict([
    ('feat', 'New'),
    ('fix', 'What was wrong'),
    ('perf', 'Faster'),
    ('refactor', 'Rearranged'),
    ('docs', 'Written down'),
    ('test', 'Now covered'),
    ('build', 'Build and tooling'),
    ('ci', 'Build and tooling'),
    ('chore', 'Housekeeping'),
])

#: Scopes, spelled the way a person would say them rather than the way the
#: directory is named. Anything missing falls back to the scope itself.
SCOPE_NAMES = {
    'campus': 'Campus simulator',
    'hosting': 'Hosting',
    'blog': 'Blog',
    'community': 'Community',
    'gpa': 'GPA calculator',
    'average': 'Average calculator',
    'auth': 'Sign in',
    'home': 'Landing page',
    'schedule': 'Calendar',
    'ai': 'AI tools',
    'ai-tools': 'AI tools',
    'dev': 'Developer setup',
    'api': 'API',
    'deps': 'Dependencies',
}

#: Accounts that are not people to thank by name.
BOTS = ('[bot]', 'github-actions', 'dependabot', 'noreply@github.com')


@dataclass
class Commit:
    sha: str
    author: str
    email: str
    subject: str
    body: str
    type: str = 'other'
    scope: str = ''
    breaking: bool = False
    title: str = ''
    pr: int | None = None
    co_authors: list[tuple[str, str]] = field(default_factory=list)


def is_bot(name: str, email: str) -> bool:
    haystack = f'{name} {email}'.lower()
    return any(marker in haystack for marker in BOTS)


def parse_commit(raw: str) -> Commit | None:
    parts = raw.split(FIELD)
    if len(parts) < 4:
        return None

    sha, author, email, subject = parts[0].strip(), parts[1], parts[2], parts[3]
    body = parts[4] if len(parts) > 4 else ''
    if not sha:
        return None

    commit = Commit(sha=sha, author=author.strip(), email=email.strip(), subject=subject.strip(), body=body)

    pr = PR_NUMBER.search(commit.subject)
    if pr:
        commit.pr = int(pr.group(1))
        commit.subject = PR_NUMBER.sub('', commit.subject).strip()

    match = CONVENTIONAL.match(commit.subject)
    if match:
        commit.type = match.group('type')
        commit.scope = (match.group('scope') or '').strip()
        commit.breaking = bool(match.group('breaking'))
        commit.title = match.group('subject').strip()
    else:
        commit.title = commit.subject

    if 'BREAKING CHANGE' in body:
        commit.breaking = True

    commit.co_authors = [
        (m.group('name').strip(), m.group('email').strip())
        for m in CO_AUTHOR.finditer(body or '')
    ]
    return commit


def parse_log(log: str) -> list[Commit]:
    commits = []
    for raw in log.split(RECORD):
        if raw.strip():
            commit = parse_commit(raw.strip('\n'))
            if commit:
                commits.append(commit)
    return commits


def scope_name(scope: str) -> str:
    return SCOPE_NAMES.get(scope, scope.replace('-', ' ').capitalize() if scope else '')


def group_by_section(commits: list[Commit]) -> "OrderedDict[str, list[Commit]]":
    """Commits under their section heading, in the order the sections are listed."""
    grouped: "OrderedDict[str, list[Commit]]" = OrderedDict()
    for kind, heading in SECTIONS.items():
        for commit in commits:
            if commit.type == kind:
                grouped.setdefault(heading, []).append(commit)

    leftovers = [c for c in commits if c.type not in SECTIONS]
    if leftovers:
        grouped.setdefault('Everything else', []).extend(leftovers)
    return grouped


def contributors(commits: list[Commit]) -> "OrderedDict[str, int]":
    """Who wrote this release, most commits first, ties alphabetical."""
    counts: Counter = Counter()
    for commit in commits:
        if not is_bot(commit.author, commit.email):
            counts[commit.author] += 1
    ordered = sorted(counts.items(), key=lambda kv: (-kv[1], kv[0].lower()))
    return OrderedDict(ordered)


def new_contributors(commits: list[Commit], seen_before: set[str]) -> list[str]:
    """
    Anybody whose first commit to this repository is in this release.

    Matched on email rather than name: the same person shows up as `Martian`
    and `martian56` in this history, and welcoming them twice would be worse
    than not welcoming them at all.
    """
    known = {email.lower() for email in seen_before}
    newcomers: "OrderedDict[str, None]" = OrderedDict()
    for commit in commits:
        if is_bot(commit.author, commit.email):
            continue
        if commit.email.lower() not in known:
            newcomers.setdefault(commit.author, None)
            known.add(commit.email.lower())
    return list(newcomers)


def helpers(commits: list[Commit]) -> list[str]:
    """Co-authors, which is where the tools that helped are credited."""
    names: "OrderedDict[str, None]" = OrderedDict()
    for commit in commits:
        for name, _email in commit.co_authors:
            names.setdefault(name, None)
    return list(names)


def area_tally(commits: list[Commit]) -> list[tuple[str, int]]:
    """Where the work went, by scope. The most-changed part of the app first."""
    counts: Counter = Counter()
    for commit in commits:
        if commit.scope:
            counts[scope_name(commit.scope)] += 1
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))


def render(
    tag: str,
    previous: str | None,
    commits: list[Commit],
    diffstat: tuple[int, int, int] | None,
    seen_before: set[str],
    repo: str,
) -> str:
    """The notes themselves."""
    people = contributors(commits)
    newcomers = new_contributors(commits, seen_before)
    breaking = [c for c in commits if c.breaking]
    prs = sorted({c.pr for c in commits if c.pr})
    out: list[str] = []

    # An opening line that says what this actually is, rather than "Release
    # v1.2.0". Somebody reading this wants to know whether to care.
    counted = f'{len(commits)} change{"s" if len(commits) != 1 else ""}'
    if prs:
        counted += f' across {len(prs)} pull request{"s" if len(prs) != 1 else ""}'
    if previous:
        out.append(f'{counted} since [`{previous}`](https://github.com/{repo}/releases/tag/{previous}).')
    else:
        out.append(f'The first tagged release. {counted}, and everything before it.')
    out.append('')

    if breaking:
        out.append('## Breaking')
        out.append('')
        out.append('Read these before upgrading.')
        out.append('')
        for commit in breaking:
            out.append(f'- {entry(commit, repo)}')
        out.append('')

    grouped = group_by_section(commits)
    for heading, group in grouped.items():
        out.append(f'## {heading}')
        out.append('')
        out.extend(f'- {entry(c, repo)}' for c in group)
        out.append('')

    if diffstat:
        files, added, removed = diffstat
        out.append('## By the numbers')
        out.append('')
        out.append(f'- **{len(commits)}** commits, **{len(prs)}** pull requests')
        out.append(f'- **{files}** files touched, **+{added:,}** / **−{removed:,}** lines')
        areas = area_tally(commits)
        if areas:
            written = ', '.join(f'{name} ({count})' for name, count in areas[:6])
            out.append(f'- Where the work went: {written}')
        out.append('')

    out.append('## Who wrote it')
    out.append('')
    if newcomers:
        # The part worth getting right. A first pull request to somebody else's
        # project takes a bit of nerve.
        welcome = ', '.join(f'**{name}**' for name in newcomers)
        out.append(f'First release with a contribution from {welcome} — welcome, and thank you.')
        out.append('')
    if people:
        for name, count in people.items():
            mark = ' 🌱' if name in newcomers else ''
            out.append(f'- {name} — {count} commit{"s" if count != 1 else ""}{mark}')
    else:
        out.append('- Nobody is credited on these commits, which is unusual enough to be worth checking.')
    out.append('')

    assisted = helpers(commits)
    if assisted:
        out.append(f'_Written with help from {", ".join(assisted)}._')
        out.append('')

    if previous:
        out.append(f'**Full changelog**: https://github.com/{repo}/compare/{previous}...{tag}')
    else:
        out.append(f'**Everything in it**: https://github.com/{repo}/commits/{tag}')

    return '\n'.join(out).rstrip() + '\n'


def entry(commit: Commit, repo: str) -> str:
    """One change, with its reason and a link back to where it was decided."""
    where = f'**{scope_name(commit.scope)}** — ' if commit.scope else ''
    line = f'{where}{commit.title}'
    if commit.pr:
        line += f' ([#{commit.pr}](https://github.com/{repo}/pull/{commit.pr}))'
    return line


# --- talking to git -------------------------------------------------------


def git(*args: str) -> str:
    return subprocess.run(
        ['git', *args], check=True, capture_output=True, text=True
    ).stdout.strip()


def previous_tag(tag: str) -> str | None:
    try:
        return git('describe', '--tags', '--abbrev=0', f'{tag}^') or None
    except subprocess.CalledProcessError:
        return None  # The first tag has nothing before it.


def commits_between(previous: str | None, tag: str) -> list[Commit]:
    span = f'{previous}..{tag}' if previous else tag
    # `--no-merges` because a merge commit repeats what its parents already say.
    return parse_log(git('log', '--no-merges', f'--pretty=format:{LOG_FORMAT}', span))


def diff_numbers(previous: str | None, tag: str) -> tuple[int, int, int] | None:
    if not previous:
        return None
    try:
        out = git('diff', '--shortstat', f'{previous}..{tag}')
    except subprocess.CalledProcessError:
        return None
    files = int(next(iter(re.findall(r'(\d+) files? changed', out)), 0))
    added = int(next(iter(re.findall(r'(\d+) insertions?', out)), 0))
    removed = int(next(iter(re.findall(r'(\d+) deletions?', out)), 0))
    return files, added, removed


def emails_before(previous: str | None) -> set[str]:
    """Everybody who had already committed before this release."""
    if not previous:
        return set()
    try:
        out = git('log', '--pretty=format:%ae', previous)
    except subprocess.CalledProcessError:
        return set()
    return {line.strip().lower() for line in out.split('\n') if line.strip()}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('tag', help='The tag being released, e.g. v1.2.0')
    parser.add_argument('--repo', default='martian56/ufazien', help='owner/name, for links')
    parser.add_argument('--previous', default=None, help='Override the tag to compare against')
    args = parser.parse_args(argv)

    previous = args.previous or previous_tag(args.tag)
    commits = commits_between(previous, args.tag)
    if not commits:
        print(f'No commits between {previous or "the beginning"} and {args.tag}.', file=sys.stderr)

    sys.stdout.write(render(
        tag=args.tag,
        previous=previous,
        commits=commits,
        diffstat=diff_numbers(previous, args.tag),
        seen_before=emails_before(previous),
        repo=args.repo,
    ))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
