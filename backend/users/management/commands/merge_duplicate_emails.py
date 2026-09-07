"""Fold each pair of accounts sharing an address into one."""

from django.apps import apps
from django.contrib.auth.hashers import is_password_usable
from django.core.exceptions import ObjectDoesNotExist
from django.core.management.base import BaseCommand, CommandError
from django.db import models, transaction
from django.db.models.functions import Lower

from users.models import User

PROFILE_FIELDS = ["first_name", "last_name", "bio"]

DISCARD = {"token_blacklist.outstandingtoken", "token_blacklist.blacklistedtoken"}


def is_google_only(user):
    return not user.password or not is_password_usable(user.password)


def scoped_models():
    """Every concrete column pointing at User, with the keys a merge can break.

    Scanned from the app registry rather than written out, because there are 55
    of them and a table missed here is content silently left on an account that
    is about to be deleted.

    `include_auto_created` is what brings in the many-to-many through tables.
    Reverse m2m accessors cannot be assigned to row by row, and the follower
    table names User twice, so the through model is edited directly and each of
    its two columns is treated as its own relation.
    """
    found = []
    for model in apps.get_models(include_auto_created=True):
        if model is User:
            continue
        for field in model._meta.concrete_fields:
            if not field.is_relation or field.related_model is not User:
                continue
            found.append((model, field, unique_keys(model, field)))
    return found


def unique_keys(model, field):
    """The unique constraints this field takes part in.

    A one-to-one, or a `unique_together` naming only the user, means the keeper
    may already hold the row and the loser's copy has to go rather than move.
    """
    keys = []
    if getattr(field, "one_to_one", False) or field.unique:
        keys.append((field.name,))
    for together in model._meta.unique_together:
        if field.name in together:
            keys.append(tuple(together))
    for constraint in model._meta.constraints:
        if isinstance(constraint, models.UniqueConstraint) and constraint.fields:
            if field.name in constraint.fields:
                keys.append(tuple(constraint.fields))
    return keys


def dependents(row):
    """How much would go with this row if it were deleted.

    A clashing row is normally a settings row or a duplicate follow and is safe
    to drop. But `average_userschemagrades` is only a link: the marks hang off
    it in `average_fieldgrade`, and one of the pairs here has twenty of them on
    each side. Dropping the loser's link to satisfy `unique(schema, user)` would
    take twenty real grades with it, silently.
    """
    total = 0
    for related in row._meta.related_objects:
        accessor = related.get_accessor_name()
        if related.one_to_one:
            try:
                getattr(row, accessor)
                total += 1
            except ObjectDoesNotExist:
                pass
        else:
            total += getattr(row, accessor).count()
    return total


def attached_rows(user):
    total = 0
    for model, field, _ in scoped_models():
        total += model._default_manager.filter(**{field.name: user}).count()
    return total


def choose_keeper(candidates, forced=None):
    """The account that keeps working for the person afterwards.

    Thirteen of the fourteen pairs are a Google sign-up that came first and a
    password sign-up that came later, so keeping the password account leaves
    both routes open: Google resolves by address and finds it, and the password
    they last set still works. Keeping the Google-only account would take the
    password away without telling anybody.
    """
    if forced is not None:
        for user in candidates:
            if user.id == forced:
                return user
        raise CommandError(f"--keep {forced} is not one of this group's accounts.")

    def rank(user):
        return (not is_google_only(user), attached_rows(user), user.date_joined)

    return max(candidates, key=rank)


def freed_username(keeper, losers):
    """A loser's handle is often the keeper's without the digits.

    The backfill gave the second account a numeric suffix to keep handles
    unique. Once the first is gone the plain form is free, and the person gets
    back the name they would have had.
    """
    for loser in losers:
        base = loser.username.lower()
        if keeper.username.lower().rstrip("0123456789") == base and keeper.username.lower() != base:
            return loser.username
    return None


class Command(BaseCommand):
    help = "Merge accounts that share an email address, keeping one."

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write the changes.")
        parser.add_argument("--only", default=None, help="Just this address.")
        parser.add_argument("--keep", type=int, default=None, help="Force the keeper id. Use with --only.")
        parser.add_argument(
            "--force-discard",
            action="store_true",
            help="Drop clashing rows even when content hangs off them.",
        )

    def groups(self, only):
        duplicated = (
            User.objects.exclude(email="")
            .annotate(key=Lower("email"))
            .values("key")
            .annotate(n=models.Count("id"))
            .filter(n__gt=1)
            .values_list("key", flat=True)
        )
        keys = sorted(duplicated)
        if only:
            wanted = only.strip().lower()
            if wanted not in keys:
                raise CommandError(f"{only} is not held by more than one account.")
            keys = [wanted]
        for key in keys:
            yield key, list(User.objects.annotate(k=Lower("email")).filter(k=key).order_by("id"))

    def move(self, loser, keeper, dry_run, force=False, key_label=""):
        """Reassign the loser's rows, dropping the ones the keeper already has."""
        moved, dropped = 0, 0
        for model, field, keys in scoped_models():
            table = model._meta.db_table
            rows = model._default_manager.filter(**{field.name: loser})
            if not rows.exists():
                continue
            if model._meta.label_lower in DISCARD:
                n = rows.count()
                dropped += n
                self.discards[table] = self.discards.get(table, 0) + n
                if not dry_run:
                    rows.delete()
                continue
            if not keys:
                moved += rows.count() if dry_run else rows.update(**{field.name: keeper})
                continue
            for row in list(rows):
                clash = False
                for key in keys:
                    lookup = {}
                    for name in key:
                        lookup[name] = keeper if name == field.name else getattr(row, f"{name}_id", None) or getattr(row, name)
                    if model._default_manager.filter(**lookup).exists():
                        clash = True
                        break
                if clash:
                    carried = dependents(row)
                    if carried and not force:
                        self.blocked.append((key_label, table, row.pk, carried))
                        continue
                    dropped += 1
                    self.discards[table] = self.discards.get(table, 0) + 1
                    if not dry_run:
                        row.delete()
                else:
                    moved += 1
                    if not dry_run:
                        setattr(row, field.name, keeper)
                        row.save(update_fields=[field.name])
        return moved, dropped

    def fill_blanks(self, keeper, loser, dry_run):
        filled = []
        for name in PROFILE_FIELDS:
            if not getattr(keeper, name, "") and getattr(loser, name, ""):
                filled.append(name)
                if not dry_run:
                    setattr(keeper, name, getattr(loser, name))
        if filled and not dry_run:
            keeper.save(update_fields=filled)
        return filled

    def handle(self, *args, **options):
        dry_run = not options["apply"]
        if options["keep"] is not None and not options["only"]:
            raise CommandError("--keep needs --only, so it is clear which group it applies to.")

        self.discards = {}
        self.blocked = []
        force = options["force_discard"]
        total_moved = total_dropped = total_deleted = 0

        for key, candidates in self.groups(options["only"]):
            keeper = choose_keeper(candidates, options["keep"])
            for loser in [u for u in candidates if u.pk != keeper.pk]:
                self.move(loser, keeper, dry_run=True, force=force, key_label=key)

        unsafe = {entry[0] for entry in self.blocked}
        if self.blocked:
            self.stdout.write(self.style.ERROR("Skipping addresses whose clash would destroy content:"))
            for key, table, pk, carried in self.blocked:
                masked = key[:2] + "***@" + key.split("@")[1]
                self.stdout.write(f"  {masked}: {table} row {pk} carries {carried} rows")
            self.stdout.write(
                self.style.WARNING(
                    "Merge these by hand, or re-run with --force-discard to drop them anyway."
                )
            )
            self.stdout.write("")

        self.discards = {}
        self.blocked = []

        with transaction.atomic():
            for key, candidates in self.groups(options["only"]):
                if key in unsafe:
                    continue
                keeper = choose_keeper(candidates, options["keep"])
                losers = [u for u in candidates if u.pk != keeper.pk]

                masked = key[:2] + "***@" + key.split("@")[1]
                self.stdout.write(f"{masked}")
                self.stdout.write(
                    f"  keep   id={keeper.id} {keeper.username} "
                    f"({'google' if is_google_only(keeper) else 'password'}, {attached_rows(keeper)} rows)"
                )

                for loser in losers:
                    moved, dropped = self.move(loser, keeper, dry_run, force=force, key_label=key)
                    filled = self.fill_blanks(keeper, loser, dry_run)
                    self.stdout.write(
                        f"  drop   id={loser.id} {loser.username} "
                        f"({'google' if is_google_only(loser) else 'password'}) "
                        f"-> moved {moved}, discarded {dropped} duplicate"
                        + (f", filled {', '.join(filled)}" if filled else "")
                    )
                    total_moved += moved
                    total_dropped += dropped
                    total_deleted += 1
                    if not dry_run:
                        loser.delete()

                rename = freed_username(keeper, losers)
                if rename:
                    self.stdout.write(f"  rename {keeper.username} -> {rename}")
                    if not dry_run:
                        User.objects.filter(pk=keeper.pk).update(username=rename)

            self.stdout.write("")
            self.stdout.write(
                f"{total_deleted} accounts merged away, {total_moved} rows moved, "
                f"{total_dropped} duplicates discarded."
            )
            if self.discards:
                self.stdout.write("discarded by table:")
                for table, n in sorted(self.discards.items(), key=lambda kv: -kv[1]):
                    self.stdout.write(f"  {n:<5} {table}")

            if dry_run:
                self.stdout.write(self.style.WARNING("Dry run. Re-run with --apply to write."))
                transaction.set_rollback(True)
            else:
                self.stdout.write(self.style.SUCCESS("Applied."))
