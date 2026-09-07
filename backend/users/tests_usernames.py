import random

from django.test import TestCase

from users import usernames


class NormaliseTests(TestCase):
    def test_lowercases_and_keeps_the_allowed_characters(self):
        self.assertEqual(usernames.normalise("Fuad Alizada"), "fuad.alizada")

    def test_strips_accents_rather_than_dropping_the_letter(self):
        self.assertEqual(usernames.normalise("Əliyev Rəşad"), "eliyev.resad")

    def test_collapses_punctuation_runs(self):
        self.assertEqual(usernames.normalise("a   b---c"), "a.b.c")

    def test_never_starts_or_ends_with_a_separator(self):
        self.assertEqual(usernames.normalise("  .hello.  "), "hello")

    def test_survives_a_name_with_nothing_usable_in_it(self):
        self.assertEqual(usernames.normalise("!!!"), "")

    def test_respects_the_length_limit(self):
        self.assertLessEqual(len(usernames.normalise("x" * 80)), usernames.MAX_LENGTH)


class FromNamesTests(TestCase):
    def test_joins_first_and_last(self):
        self.assertEqual(usernames.from_names("Aysel", "Mammadova"), "aysel.mammadova")

    def test_uses_what_it_has_when_a_name_is_missing(self):
        self.assertEqual(usernames.from_names("Kamran", ""), "kamran")

    def test_gives_nothing_back_when_the_result_is_too_short(self):
        self.assertEqual(usernames.from_names("A", ""), "")

    def test_gives_nothing_back_when_there_are_no_names(self):
        self.assertEqual(usernames.from_names("", ""), "")

    def test_an_azerbaijani_name_keeps_its_letters(self):
        self.assertEqual(usernames.from_names("Əlvin", "Əliyev"), "elvin.eliyev")

    def test_a_turkish_dotless_i_survives(self):
        self.assertEqual(usernames.from_names("Irı", "Yılmaz"), "iri.yilmaz")

    def test_a_double_barrelled_name_stays_one_handle(self):
        self.assertEqual(usernames.from_names("Anna Maria", "Del Rio"), "anna.maria.del.rio")


class RandomHandleTests(TestCase):
    def test_is_acceptable_as_a_username(self):
        rng = random.Random(1)
        for _ in range(200):
            self.assertIsNone(usernames.check(usernames.random_handle(rng)))

    def test_does_not_repeat_itself_constantly(self):
        rng = random.Random(2)
        handles = {usernames.random_handle(rng) for _ in range(100)}
        self.assertGreater(len(handles), 90)


class RevealsEmailTests(TestCase):
    def test_catches_the_whole_address(self):
        self.assertTrue(usernames.reveals_email("a@b.com", "a@b.com"))

    def test_catches_the_local_part(self):
        self.assertTrue(usernames.reveals_email("fuadelizade6", "fuadelizade6@gmail.com"))

    def test_ignores_case(self):
        self.assertTrue(usernames.reveals_email("FuadElizade6", "fuadelizade6@GMAIL.com"))

    def test_leaves_an_unrelated_handle_alone(self):
        self.assertFalse(usernames.reveals_email("quiet.harbour", "fuadelizade6@gmail.com"))

    def test_a_handle_that_merely_starts_the_same_is_fine(self):
        self.assertFalse(usernames.reveals_email("fuad", "fuadelizade6@gmail.com"))


class UniqueTests(TestCase):
    def test_returns_the_base_when_nobody_holds_it(self):
        self.assertEqual(usernames.unique("aysel.mammadova", lambda c: False), "aysel.mammadova")

    def test_suffixes_a_collision(self):
        self.assertEqual(usernames.unique("taken", {"taken"}.__contains__), "taken2")

    def test_keeps_counting_past_the_first_suffix(self):
        held = {"taken", "taken2", "taken3"}
        self.assertEqual(usernames.unique("taken", held.__contains__), "taken4")

    def test_a_suffixed_name_still_fits_the_length_limit(self):
        base = "x" * usernames.MAX_LENGTH
        held = {base}
        result = usernames.unique(base, held.__contains__)
        self.assertLessEqual(len(result), usernames.MAX_LENGTH)
        self.assertNotIn(result, held)

    def test_falls_back_to_a_handle_when_there_is_no_base(self):
        result = usernames.unique("", lambda c: False, random.Random(3))
        self.assertIsNone(usernames.check(result))

    def test_never_hands_back_a_reserved_name(self):
        self.assertNotEqual(usernames.unique("admin", lambda c: False), "admin")


class CheckTests(TestCase):
    def test_accepts_an_ordinary_handle(self):
        self.assertIsNone(usernames.check("aysel.mammadova"))

    def test_refuses_an_email_address(self):
        self.assertIn("email", usernames.check("someone@example.com"))

    def test_refuses_the_local_part_of_its_own_email(self):
        self.assertIsNotNone(usernames.check("fuadelizade6", email="fuadelizade6@gmail.com"))

    def test_allows_a_handle_unrelated_to_the_email(self):
        self.assertIsNone(usernames.check("quiet.harbour", email="fuadelizade6@gmail.com"))

    def test_refuses_something_too_short(self):
        self.assertIsNotNone(usernames.check("ab"))

    def test_refuses_something_too_long(self):
        self.assertIsNotNone(usernames.check("x" * (usernames.MAX_LENGTH + 1)))

    def test_refuses_a_reserved_name(self):
        self.assertIn("reserved", usernames.check("admin"))

    def test_refuses_spaces_and_symbols(self):
        for bad in ["has space", "slash/es", "semi;colon", "angle<br>", "quote'd"]:
            self.assertIsNotNone(usernames.check(bad), bad)

    def test_refuses_a_leading_or_trailing_separator(self):
        self.assertIsNotNone(usernames.check(".leading"))
        self.assertIsNotNone(usernames.check("trailing."))

    def test_refuses_nothing_at_all(self):
        self.assertIsNotNone(usernames.check(""))
        self.assertIsNotNone(usernames.check(None))

    def test_refuses_a_script_tag(self):
        self.assertIsNotNone(usernames.check("<script>alert(1)</script>"))
