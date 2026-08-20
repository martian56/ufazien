"""
The characters a player can wear in the campus.

The catalogue lives here rather than only in the client because the server
decides what it will store: a client that offers a body the server rejects, or
stores one the client cannot draw, is a player who looks like nobody. The same
ids are declared in `frontend/src/components/campus/avatarCatalogue.ts`, and
`test_catalogue_matches_the_client` keeps the two from drifting.

`avatar` on the user model is already taken — it is the profile photograph, a
different thing entirely — so the field that holds this is `campus_character`.

Adding one is two lines and a built asset: run the character through
`scripts/build-avatars.mjs`, drop the `.glb` in `frontend/public/avatars/`, and
add its id here and in the client's catalogue.
"""

#: Every character id the server will accept, in the order the picker shows them.
CAMPUS_CHARACTERS = (
    'casual-hoodie',
    'casual-2',
    'suit',
)

#: Stored when a player has never chosen. Not a character: it means "whichever
#: one this player has always had", which is derived from their user id on the
#: client. Defaulting to a real character would silently restyle everybody who
#: has ever played, the first time this shipped.
UNCHOSEN = ''


def is_valid_character(value) -> bool:
    """Whether `value` is something we are willing to store."""
    return value == UNCHOSEN or value in CAMPUS_CHARACTERS
