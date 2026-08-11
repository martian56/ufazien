"""
Tests for the object storage split.

The rule these guard: a direct message attachment must never be readable
without a signature. Before the split every upload was served off MEDIA_URL
from the container filesystem, so knowing the path was enough to read a
private conversation's files.
"""

from django.core.files.storage import storages
from django.test import SimpleTestCase, TestCase, override_settings
from django.core.management import call_command
from io import StringIO

from api.attachments import private_attachment_storage


class StorageSelectionTests(SimpleTestCase):
    def test_local_disk_is_the_default_without_an_endpoint(self):
        """A developer with no MinIO gets filesystem storage, not an error."""
        from django.conf import settings

        if settings.USE_OBJECT_STORAGE:
            self.skipTest("object storage is configured in this environment")
        self.assertIn("FileSystemStorage", settings.STORAGES["default"]["BACKEND"])
        self.assertIn("FileSystemStorage", settings.STORAGES["private"]["BACKEND"])

    def test_private_alias_is_registered(self):
        """community.models resolves this by name at run time."""
        self.assertIsNotNone(storages["private"])

    def test_attachment_storage_is_a_callable_not_an_instance(self):
        """
        Django serialises a storage instance into migrations. A callable is
        recorded by reference instead, so the deployed bucket never gets
        baked into version control.
        """
        self.assertTrue(callable(private_attachment_storage))
        self.assertIs(private_attachment_storage(), storages["private"])


@override_settings(
    USE_OBJECT_STORAGE=True,
    AWS_S3_ENDPOINT_URL="https://media.example.com",
    AWS_ACCESS_KEY_ID="key",
    AWS_SECRET_ACCESS_KEY="secret",
    AWS_PUBLIC_BUCKET_NAME="test-public",
    AWS_PRIVATE_BUCKET_NAME="test-private",
    AWS_PRIVATE_URL_EXPIRY_SECONDS=900,
)
class ObjectStorageConfigTests(SimpleTestCase):
    def test_public_storage_serves_unsigned_urls(self):
        from api.storages import PublicMediaStorage

        store = PublicMediaStorage()
        self.assertEqual(store.bucket_name, "test-public")
        self.assertFalse(store.querystring_auth, "public objects must not be signed")

    def test_private_storage_signs_and_expires(self):
        from api.storages import PrivateMediaStorage

        store = PrivateMediaStorage()
        self.assertEqual(store.bucket_name, "test-private")
        self.assertTrue(store.querystring_auth, "private objects must require a signature")
        self.assertEqual(store.querystring_expire, 900)

    def test_neither_storage_grants_a_public_acl(self):
        """
        MinIO honours ACLs. Setting one here would make the private bucket's
        objects world-readable regardless of the bucket policy.
        """
        from api.storages import PrivateMediaStorage, PublicMediaStorage

        self.assertIsNone(PublicMediaStorage().default_acl)
        self.assertIsNone(PrivateMediaStorage().default_acl)


class EnsureBucketsCommandTests(TestCase):
    def test_command_is_a_no_op_without_object_storage(self):
        """The entrypoint runs this on every start, including local ones."""
        out = StringIO()
        with override_settings(USE_OBJECT_STORAGE=False):
            call_command("ensure_media_buckets", stdout=out)
        self.assertIn("not configured", out.getvalue())


class PrivateAttachmentFieldTests(TestCase):
    def test_direct_message_attachments_use_the_private_store(self):
        """
        The regression this exists for: these two fields sat on the public
        default storage, so a leaked path was a leaked file.
        """
        from community.models import PrivateMessage

        for field_name in ("file_attachment", "image_attachment"):
            field = PrivateMessage._meta.get_field(field_name)
            self.assertIs(
                field.storage,
                storages["private"],
                f"{field_name} must not be publicly readable",
            )

    def test_group_message_attachments_use_the_private_store(self):
        from community.models import GroupMessage

        for field_name in ("file_attachment", "image_attachment"):
            field = GroupMessage._meta.get_field(field_name)
            self.assertIs(field.storage, storages["private"])

    def test_avatars_stay_public(self):
        """Profile pictures are shown to everyone; signing them would break caching."""
        from users.models import User

        # A field that declares no storage gets DefaultStorage, a lazy proxy
        # around storages["default"]. isinstance resolves it; comparing
        # identity or _wrapped does not.
        storage = User._meta.get_field("avatar").storage
        self.assertIsNot(storage, storages["private"])
        self.assertIsInstance(storage, type(storages["default"]))
