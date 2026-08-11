"""
Create the media buckets and pin their read policies.

Run from the container entrypoint so a fresh deployment provisions its own
storage. It is idempotent: existing buckets are left alone apart from having
their policy reasserted, which is the point. A private bucket that silently
became public is exactly the failure this command exists to prevent, so the
policy is written every start rather than only at creation.
"""

import json

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

PUBLIC_READ_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {"AWS": ["*"]},
            "Action": ["s3:GetObject"],
            "Resource": [],
        }
    ],
}


class Command(BaseCommand):
    help = "Create the public and private media buckets and apply their policies."

    def add_arguments(self, parser):
        parser.add_argument(
            "--check",
            action="store_true",
            help="Report what would change without touching anything.",
        )

    def handle(self, *args, **options):
        if not settings.USE_OBJECT_STORAGE:
            self.stdout.write(
                "Object storage is not configured (AWS_S3_ENDPOINT_URL unset); nothing to do."
            )
            return

        try:
            import boto3
            from botocore.exceptions import ClientError
        except ImportError as exc:  # pragma: no cover - dependency is declared
            raise CommandError(f"boto3 is required for object storage: {exc}")

        client = boto3.client(
            "s3",
            endpoint_url=settings.AWS_S3_ENDPOINT_URL,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            region_name=settings.AWS_S3_REGION_NAME,
        )

        check = options["check"]
        public = settings.AWS_PUBLIC_BUCKET_NAME
        private = settings.AWS_PRIVATE_BUCKET_NAME

        for name, is_public in ((public, True), (private, False)):
            try:
                client.head_bucket(Bucket=name)
                exists = True
            except ClientError:
                exists = False

            if not exists:
                if check:
                    self.stdout.write(f"would create bucket {name}")
                    continue
                client.create_bucket(Bucket=name)
                self.stdout.write(self.style.SUCCESS(f"created bucket {name}"))
            else:
                self.stdout.write(f"bucket {name} already exists")

            if check:
                continue

            if is_public:
                policy = dict(PUBLIC_READ_POLICY)
                policy["Statement"] = [
                    {**PUBLIC_READ_POLICY["Statement"][0], "Resource": [f"arn:aws:s3:::{name}/*"]}
                ]
                client.put_bucket_policy(Bucket=name, Policy=json.dumps(policy))
                self.stdout.write(f"  {name}: anonymous read allowed")
            else:
                # Removing the policy leaves the bucket owner-only, which is
                # what makes a leaked object path useless without a signature.
                try:
                    client.delete_bucket_policy(Bucket=name)
                except ClientError:
                    pass
                self.stdout.write(f"  {name}: private, signed URLs only")
