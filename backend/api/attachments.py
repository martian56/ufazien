"""
Storage callable for attachments that must not be public.

Passing the storage as a callable rather than an instance keeps it out of
migrations: Django serialises a storage *instance* into the migration file,
which would pin the deployed bucket into version control and force a new
migration every time the backend changed. A callable is recorded by reference
and resolved at run time, so the same migration works on a laptop with local
files and in production with MinIO.
"""

from django.core.files.storage import storages


def private_attachment_storage():
    """The bucket that requires a signed URL, or local disk when unconfigured."""
    return storages["private"]
