"""Turning user input into the plain text a field claims to hold."""

import html as html_module
import re

import bleach

TAG_LIKE = re.compile(r"</?[A-Za-z][^>]*>")
WHITESPACE = re.compile(r"[ \t ]+")
BLANK_LINES = re.compile(r"\n{3,}")


def plain_text(value, max_length=None, keep_newlines=False):
    """Markup removed, entities resolved, so the result is what it looks like.

    Escaping alone is not enough. `bleach` leaves `a < b` as `a &lt; b`, and a
    field rendered by React escapes it a second time, so the reader sees the
    entity rather than the character. Unescaping afterwards gives back what
    somebody actually typed.

    Unescaping can also turn `&lt;script&gt;` back into live markup, which is
    why anything tag-shaped is dropped afterwards. The pattern needs a letter
    after the bracket, so `a < b` and `I <3 this` survive as themselves.
    """
    if value is None:
        return ""

    text = bleach.clean(str(value), tags=set(), attributes={}, strip=True, strip_comments=True)
    text = html_module.unescape(text)
    text = TAG_LIKE.sub("", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    if keep_newlines:
        text = "\n".join(WHITESPACE.sub(" ", line).strip() for line in text.split("\n"))
        text = BLANK_LINES.sub("\n\n", text).strip()
    else:
        text = WHITESPACE.sub(" ", text.replace("\n", " ")).strip()

    if max_length is not None and len(text) > max_length:
        text = text[:max_length].rstrip()

    return text


class PlainTextFieldsMixin:
    """Reduce the named fields to plain text on the way in.

    Declared per serializer rather than written out as `validate_<field>`
    methods, because the write path is often a different serializer from the
    read path and a field guarded on only one of them is not guarded at all.

    Applied in `to_internal_value` so a serializer's own `validate` is free to
    do its job, and sees text that is already clean.
    """

    plain_text_fields = {}

    def to_internal_value(self, data):
        attrs = super().to_internal_value(data)
        for field, options in self.plain_text_fields.items():
            if field in attrs and attrs[field] is not None:
                attrs[field] = plain_text(attrs[field], **options)
        return attrs
