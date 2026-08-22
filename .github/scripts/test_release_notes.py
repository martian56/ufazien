"""
Tests for the release-notes generator.

A release runs once, from a tag, and whatever it produces is what people read.
There is no second chance to notice it dropped half the commits or welcomed the
maintainer as a new contributor, so the parsing and the wording are pinned here
and run in CI — before anybody pushes a tag, not after.
"""

import unittest

from release_notes import (
    FIELD,
    RECORD,
    area_tally,
    contributors,
    group_by_section,
    helpers,
    new_contributors,
    parse_log,
    render,
)


def log(*commits: tuple) -> str:
    """A `git log` in the format the generator asks git for."""
    return RECORD.join(FIELD.join(str(field) for field in commit) for commit in commits) + RECORD


class ParsingTests(unittest.TestCase):
    def test_reads_a_conventional_commit(self):
        (commit,) = parse_log(log(
            ('abc123', 'Cavid', 'c@example.com', 'fix(campus): stop the lift eating people', 'It ate people.')
        ))

        self.assertEqual(commit.type, 'fix')
        self.assertEqual(commit.scope, 'campus')
        self.assertEqual(commit.title, 'stop the lift eating people')

    def test_reads_one_with_no_scope(self):
        (commit,) = parse_log(log(('abc', 'A', 'a@e.com', 'chore: tidy up', '')))

        self.assertEqual(commit.type, 'chore')
        self.assertEqual(commit.scope, '')

    def test_a_subject_that_is_not_conventional_still_appears(self):
        """Older history is not all conventional, and dropping it would be worse."""
        (commit,) = parse_log(log(('abc', 'A', 'a@e.com', 'Redesign the dashboard', '')))

        self.assertEqual(commit.type, 'other')
        self.assertEqual(commit.title, 'Redesign the dashboard')

    def test_takes_the_pull_request_number_off_the_subject(self):
        (commit,) = parse_log(log(('abc', 'A', 'a@e.com', 'feat(blog): drafts (#178)', '')))

        self.assertEqual(commit.pr, 178)
        self.assertEqual(commit.title, 'drafts')

    def test_notices_a_breaking_change_either_way_it_is_marked(self):
        marked, trailered = parse_log(log(
            ('a', 'A', 'a@e.com', 'feat(api)!: rename the field', ''),
            ('b', 'A', 'a@e.com', 'feat(api): rename the field', 'BREAKING CHANGE: it is renamed.'),
        ))

        self.assertTrue(marked.breaking)
        self.assertTrue(trailered.breaking)

    def test_a_body_with_newlines_does_not_split_the_commit(self):
        """Which is why the fields are separated by bytes a person cannot type."""
        commits = parse_log(log(
            ('a', 'A', 'a@e.com', 'fix: one', 'Line one.\n\nLine two.\n'),
            ('b', 'B', 'b@e.com', 'fix: two', 'Another.'),
        ))

        self.assertEqual(len(commits), 2)
        self.assertEqual(commits[0].title, 'one')
        self.assertEqual(commits[1].title, 'two')


class GroupingTests(unittest.TestCase):
    def test_features_come_before_fixes(self):
        commits = parse_log(log(
            ('a', 'A', 'a@e.com', 'fix(campus): a fix', ''),
            ('b', 'A', 'a@e.com', 'feat(blog): a feature', ''),
        ))

        headings = list(group_by_section(commits))

        self.assertEqual(headings[0], 'New')
        self.assertEqual(headings[1], 'What was wrong')

    def test_ci_and_build_share_a_heading(self):
        commits = parse_log(log(
            ('a', 'A', 'a@e.com', 'ci: pin node', ''),
            ('b', 'A', 'a@e.com', 'build: bump vite', ''),
        ))

        grouped = group_by_section(commits)

        self.assertEqual(len(grouped['Build and tooling']), 2)

    def test_an_unknown_type_is_kept_rather_than_dropped(self):
        commits = parse_log(log(('a', 'A', 'a@e.com', 'wip: something', '')))

        self.assertIn('Everything else', group_by_section(commits))

    def test_the_areas_are_tallied_by_scope(self):
        commits = parse_log(log(
            ('a', 'A', 'a@e.com', 'fix(campus): one', ''),
            ('b', 'A', 'a@e.com', 'feat(campus): two', ''),
            ('c', 'A', 'a@e.com', 'fix(hosting): three', ''),
        ))

        self.assertEqual(area_tally(commits), [('Campus simulator', 2), ('Hosting', 1)])


class PeopleTests(unittest.TestCase):
    def test_counts_commits_per_person_most_first(self):
        commits = parse_log(log(
            ('a', 'Bea', 'b@e.com', 'fix: one', ''),
            ('b', 'Ali', 'a@e.com', 'fix: two', ''),
            ('c', 'Ali', 'a@e.com', 'fix: three', ''),
        ))

        self.assertEqual(list(contributors(commits).items()), [('Ali', 2), ('Bea', 1)])

    def test_bots_are_not_thanked_as_people(self):
        commits = parse_log(log(
            ('a', 'dependabot[bot]', 'x@github.com', 'build: bump', ''),
            ('b', 'Ali', 'a@e.com', 'fix: real work', ''),
        ))

        self.assertEqual(list(contributors(commits)), ['Ali'])

    def test_a_first_commit_makes_a_new_contributor(self):
        commits = parse_log(log(
            ('a', 'Newcomer', 'new@e.com', 'feat: a first change', ''),
            ('b', 'Old Hand', 'old@e.com', 'fix: another', ''),
        ))

        self.assertEqual(new_contributors(commits, {'old@e.com'}), ['Newcomer'])

    def test_somebody_who_has_committed_before_is_not_welcomed_again(self):
        commits = parse_log(log(('a', 'Old Hand', 'OLD@e.com', 'fix: another', '')))

        self.assertEqual(new_contributors(commits, {'old@e.com'}), [])

    def test_one_person_under_two_names_is_welcomed_once(self):
        """
        This history has the same person as `Martian` and `martian56`. Matching
        on the address rather than the name keeps them one person.
        """
        commits = parse_log(log(
            ('a', 'Martian', 'same@e.com', 'feat: one', ''),
            ('b', 'martian56', 'same@e.com', 'feat: two', ''),
        ))

        self.assertEqual(len(new_contributors(commits, set())), 1)

    def test_co_authors_are_credited(self):
        commits = parse_log(log(
            ('a', 'Ali', 'a@e.com', 'fix: one', 'Co-authored-by: Claude <noreply@anthropic.com>'),
        ))

        self.assertEqual(helpers(commits), ['Claude'])


class RenderingTests(unittest.TestCase):
    def notes(self, commits, previous='v1.0.0', seen=frozenset({'old@e.com'}), diffstat=(12, 340, 90)):
        return render(
            tag='v1.1.0',
            previous=previous,
            commits=commits,
            diffstat=diffstat,
            seen_before=set(seen),
            repo='martian56/ufazien',
        )

    def test_a_fix_is_listed_under_what_was_wrong(self):
        commits = parse_log(log(
            ('a', 'Ali', 'a@e.com', 'fix(campus): stop a second tab marking you offline',
             'A long body that is not the release notes\' business.'),
        ))

        notes = self.notes(commits)

        self.assertIn('What was wrong', notes)
        self.assertIn('stop a second tab marking you offline', notes)

    def test_the_body_stays_in_the_commit(self):
        """A release lists what changed. The reasoning is a click away."""
        commits = parse_log(log(
            ('a', 'Ali', 'a@e.com', 'fix(campus): a thing (#12)', 'Paragraphs and paragraphs of why.'),
        ))

        self.assertNotIn('Paragraphs and paragraphs', self.notes(commits))

    def test_the_scope_is_named_the_way_a_person_would_say_it(self):
        commits = parse_log(log(('a', 'Ali', 'a@e.com', 'fix(campus): a thing', '')))

        self.assertIn('**Campus simulator**', self.notes(commits))

    def test_pull_requests_are_linked(self):
        commits = parse_log(log(('a', 'Ali', 'a@e.com', 'feat(blog): drafts (#178)', '')))

        self.assertIn('https://github.com/martian56/ufazien/pull/178', self.notes(commits))

    def test_new_contributors_are_welcomed_by_name(self):
        commits = parse_log(log(('a', 'Newcomer', 'new@e.com', 'feat: something', '')))

        notes = self.notes(commits)

        self.assertIn('**Newcomer**', notes)
        self.assertIn('welcome', notes.lower())
        self.assertIn('🌱', notes)

    def test_a_returning_contributor_is_not_welcomed_as_new(self):
        commits = parse_log(log(('a', 'Old Hand', 'old@e.com', 'feat: something', '')))

        notes = self.notes(commits)

        self.assertIn('Old Hand', notes)
        self.assertNotIn('welcome', notes.lower())

    def test_breaking_changes_are_put_first(self):
        commits = parse_log(log(
            ('a', 'Ali', 'a@e.com', 'fix(api): small', ''),
            ('b', 'Ali', 'a@e.com', 'feat(api)!: renamed a field', ''),
        ))

        notes = self.notes(commits)

        self.assertLess(notes.index('## Breaking'), notes.index('## New'))

    def test_the_numbers_are_reported(self):
        commits = parse_log(log(('a', 'Ali', 'a@e.com', 'feat(campus): one (#12)', '')))

        notes = self.notes(commits)

        self.assertIn('**12** files touched', notes)
        self.assertIn('+340', notes)
        self.assertIn('Campus simulator (1)', notes)

    def test_it_links_the_full_changelog(self):
        commits = parse_log(log(('a', 'Ali', 'a@e.com', 'feat: one', '')))

        self.assertIn('compare/v1.0.0...v1.1.0', self.notes(commits))

    def test_the_first_release_says_so_instead_of_comparing(self):
        commits = parse_log(log(('a', 'Ali', 'a@e.com', 'feat: one', '')))

        notes = self.notes(commits, previous=None, seen=frozenset(), diffstat=None)

        self.assertIn('first tagged release', notes)
        self.assertNotIn('compare/', notes)

    def test_a_release_with_nothing_in_it_still_renders(self):
        """A tag on an unchanged tree should not crash the workflow."""
        notes = self.notes([], diffstat=None)

        self.assertIn('Who wrote it', notes)

    def test_it_does_not_invent_a_heading_for_a_section_with_nothing_in_it(self):
        commits = parse_log(log(('a', 'Ali', 'a@e.com', 'feat: one', '')))

        notes = self.notes(commits)

        self.assertIn('## New', notes)
        self.assertNotIn('## What was wrong', notes)


if __name__ == '__main__':
    unittest.main()
