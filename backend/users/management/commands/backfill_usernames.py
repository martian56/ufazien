"""Rewrite usernames that hand out the address they belong to."""

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from users import usernames
from users.models import User


class Command(BaseCommand):
    help = "Replace usernames that are an email address, or its local part."

    def add_arguments(self, parser):
        parser.add_argument(
            "--apply",
            action="store_true",
            help="Write the changes. Without it nothing is saved.",
        )
        parser.add_argument(
            "--keep",
            action="append",
            default=[],
            help="A username to leave alone. Repeatable.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=0,
            help="Only process this many, for a cautious first run.",
        )

    def limit_from(self, options):
        limit = options["limit"]
        if limit < 0:
            raise CommandError("--limit cannot be negative.")
        return limit

    @staticmethod
    def needs_replacing(user):
        """Any username that should not exist, not only one matching its owner.

        `reveals_email` compares a handle against its own address, so it never
        saw the accounts that carry somebody else's: eight people here had an
        address in the username field that was not theirs, which publishes a
        third party's rather than their own.
        """
        if usernames.reveals_email(user.username, user.email):
            return True
        return usernames.check(user.username, user.email) is not None

    def handle(self, *args, **options):
        keep = {name.strip().lower() for name in options["keep"] if name.strip()}

        held = {name.lower() for name in User.objects.values_list("username", flat=True)}

        def taken(candidate):
            return candidate.lower() in held

        limit = self.limit_from(options)

        affected = []
        for user in User.objects.order_by("id").iterator(chunk_size=500):
            if user.username.lower() in keep:
                continue
            if not self.needs_replacing(user):
                continue
            affected.append(user)
            if limit and len(affected) >= limit:
                break

        if not affected:
            self.stdout.write("Nothing to do: no username reveals its address.")
            return

        renames = []
        for user in affected:
            handle = usernames.for_person(
                user.first_name, user.last_name, taken, email=user.email
            )
            held.discard(user.username.lower())
            held.add(handle.lower())
            renames.append((user, handle))

        derived = sum(1 for user, _ in renames if usernames.from_names(user.first_name, user.last_name))
        self.stdout.write(f"{len(renames)} to rename: {derived} from names, {len(renames) - derived} generated.")
        for user, handle in renames[:20]:
            self.stdout.write(f"  id={user.id:<5} -> {handle}")
        if len(renames) > 20:
            self.stdout.write(f"  ... and {len(renames) - 20} more")

        if not options["apply"]:
            self.stdout.write(self.style.WARNING("Dry run. Re-run with --apply to write."))
            return

        changed = 0
        with transaction.atomic():
            for user, handle in renames:
                changed += User.objects.filter(
                    pk=user.pk, username=user.username, email=user.email
                ).update(username=handle)
        skipped = len(renames) - changed

        remaining = sum(
            1
            for user in User.objects.only("username", "email", "first_name", "last_name").iterator(chunk_size=500)
            if user.username.lower() not in keep and self.needs_replacing(user)
        )
        self.stdout.write(self.style.SUCCESS(f"Renamed {changed}."))
        if skipped:
            self.stdout.write(
                self.style.WARNING(f"{skipped} changed underneath us and were left alone.")
            )
        if remaining:
            self.stdout.write(self.style.ERROR(f"{remaining} still reveal an address."))
