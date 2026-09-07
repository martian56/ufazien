"""Deriving and validating usernames without leaking the email behind them."""

import random
import re
import unicodedata

MIN_LENGTH = 3
MAX_LENGTH = 30

ALLOWED = re.compile(r"^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$")

TRANSLITERATE = {
    "Ə": "e", "ə": "e",
    "İ": "i", "ı": "i",
    "Ğ": "g", "ğ": "g",
    "Ø": "o", "ø": "o",
    "Æ": "ae", "æ": "ae",
    "Œ": "oe", "œ": "oe",
    "ß": "ss",
    "Ł": "l", "ł": "l",
    "Đ": "d", "đ": "d",
    "Ð": "d", "ð": "d",
    "Þ": "th", "þ": "th",
}

RESERVED = {
    "admin", "administrator", "root", "system", "support", "help", "staff",
    "moderator", "mod", "official", "ufazien", "ufaz", "api", "www", "mail",
    "me", "self", "null", "none", "undefined", "anonymous", "deleted",
    "security", "abuse", "postmaster", "webmaster", "noreply", "no-reply",
}

ADJECTIVES = [
    "amber", "brave", "bright", "calm", "clever", "coastal", "curious", "eager",
    "gentle", "golden", "hidden", "keen", "lucky", "merry", "mellow", "noble",
    "quiet", "rapid", "royal", "silent", "small", "solar", "steady", "sunny",
    "swift", "tidy", "vivid", "warm", "wild", "wise",
]

NOUNS = [
    "anchor", "arch", "atlas", "beacon", "birch", "bridge", "canyon", "cedar",
    "comet", "compass", "delta", "ember", "falcon", "forest", "garden", "harbour",
    "heron", "island", "lantern", "meadow", "orchard", "otter", "pine", "quarry",
    "raven", "river", "summit", "thistle", "valley", "willow",
]


def normalise(value):
    """Reduce free text to the characters a username may contain."""
    if not value:
        return ""
    text = "".join(TRANSLITERATE.get(ch, ch) for ch in str(value))
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().replace("'", "").replace("’", "")
    text = re.sub(r"[^a-z0-9]+", ".", text)
    text = re.sub(r"\.{2,}", ".", text).strip("._-")
    return text[:MAX_LENGTH].strip("._-")


def from_names(first_name, last_name):
    """`first.last`, or as much of it as the names allow."""
    first = normalise(first_name)
    last = normalise(last_name)
    if first and last:
        candidate = f"{first}.{last}"
    else:
        candidate = first or last
    candidate = candidate[:MAX_LENGTH].strip("._-")
    return candidate if len(candidate) >= MIN_LENGTH else ""


def random_handle(rng=None):
    """A pronounceable handle for somebody whose name we do not have."""
    rng = rng or random
    return f"{rng.choice(ADJECTIVES)}.{rng.choice(NOUNS)}{rng.randint(10, 9999)}"


def looks_like_email(value):
    return "@" in str(value or "")


def reveals_email(username, email):
    """Whether this username hands out the address it belongs to."""
    if not username or not email or "@" not in email:
        return False
    handle = str(username).strip().lower()
    address = str(email).strip().lower()
    return handle == address or handle == address.split("@", 1)[0]


def is_reserved(value):
    return str(value or "").strip().lower() in RESERVED


def unique(base, taken, rng=None):
    """`base`, or `base` with the smallest suffix that nobody holds."""
    rng = rng or random
    candidate = normalise(base) or random_handle(rng)
    if len(candidate) < MIN_LENGTH:
        candidate = random_handle(rng)
    if not taken(candidate) and not is_reserved(candidate):
        return candidate

    stem = candidate
    for suffix in range(2, 1000):
        tail = str(suffix)
        trimmed = stem[: MAX_LENGTH - len(tail)].strip("._-")
        attempt = f"{trimmed}{tail}"
        if not taken(attempt) and not is_reserved(attempt):
            return attempt

    while True:
        attempt = random_handle(rng)
        if not taken(attempt) and not is_reserved(attempt):
            return attempt


def for_person(first_name, last_name, taken, email=None, rng=None):
    """The handle a new account gets: their name, or a generated one.

    A name can land on the address's local part by coincidence, which is the
    condition this exists to avoid, so it counts as taken.
    """

    def unavailable(candidate):
        return taken(candidate) or reveals_email(candidate, email)

    return unique(from_names(first_name, last_name), unavailable, rng=rng)


def check(value, email=None):
    """Return an error message for `value`, or None when it is acceptable."""
    if value is None:
        return "A username is required."
    handle = str(value).strip()

    if not handle:
        return "A username is required."
    if looks_like_email(handle):
        return "A username cannot be an email address."
    if len(handle) < MIN_LENGTH:
        return f"A username must be at least {MIN_LENGTH} characters."
    if len(handle) > MAX_LENGTH:
        return f"A username must be at most {MAX_LENGTH} characters."
    if not ALLOWED.match(handle.lower()):
        return (
            "A username may use letters, numbers, dots, hyphens and underscores, "
            "and must start and end with a letter or number."
        )
    if is_reserved(handle):
        return "That username is reserved."
    if email and reveals_email(handle, email):
        return "A username cannot be the address it belongs to."
    return None
