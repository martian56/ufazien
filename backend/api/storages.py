"""
Object storage backends.

Uploads used to land on the container's own filesystem under MEDIA_ROOT, which
made them a bind mount the app could not scale past and, more seriously, left
every file world-readable to anyone who guessed the URL. Direct message
attachments were served exactly like public avatars.

Two buckets, so the distinction is enforced by the store rather than by
whoever writes the next view:

  public   avatars, blog images, group avatars, forum images. Served straight
           off the endpoint with no signature, cacheable.
  private  direct message and group attachments. Not readable without a signed
           URL, so a leaked path is not a leaked file.

Both use the public endpoint rather than the internal container address. A
presigned URL is signed against a specific host, so signing against an
internal hostname would produce URLs that fail the moment a browser fetches
them from the public domain.
"""

from django.conf import settings
from storages.backends.s3 import S3Storage


class PublicMediaStorage(S3Storage):
    """Anything safe to hand to an unauthenticated browser."""

    default_acl = None
    querystring_auth = False
    file_overwrite = False

    @property
    def bucket_name(self):
        return settings.AWS_PUBLIC_BUCKET_NAME


class PrivateMediaStorage(S3Storage):
    """Objects that must not be readable without a signed, expiring URL."""

    default_acl = None
    querystring_auth = True
    file_overwrite = False

    @property
    def bucket_name(self):
        return settings.AWS_PRIVATE_BUCKET_NAME

    @property
    def querystring_expire(self):
        return settings.AWS_PRIVATE_URL_EXPIRY_SECONDS
