from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from .models import Lobby, LobbyMember, SavedLobby

User = get_user_model()


class LobbyRestTests(TestCase):
    """The REST half of the multiplayer loop: browse, create, join, leave, save."""

    def setUp(self):
        self.host = User.objects.create_user(
            username="host", email="host@example.com", password="pw"
        )
        self.player = User.objects.create_user(
            username="player", email="player@example.com", password="pw"
        )
        self.api = APIClient()
        self.api.force_authenticate(user=self.host)

    @staticmethod
    def _items(response):
        body = response.json()
        return body["results"] if isinstance(body, dict) and "results" in body else body

    def _make_lobby(self, **overrides):
        fields = {"name": "Test Lobby", "host": self.host, "max_players": 20}
        fields.update(overrides)
        lobby = Lobby.objects.create(**fields)
        LobbyMember.objects.create(lobby=lobby, user=lobby.host)
        return lobby

    def test_stats_is_not_swallowed_by_the_lobby_detail_route(self):
        """lobbies/stats/ must not be captured as a lobby id."""
        response = self.api.get("/api/game/lobbies/stats/")
        self.assertEqual(response.status_code, 200, response.content[:300])

    def test_list_lobbies(self):
        self._make_lobby()
        response = self.api.get("/api/game/lobbies/")
        self.assertEqual(response.status_code, 200, response.content[:300])
        self.assertEqual(len(self._items(response)), 1)

    def test_create_lobby_returns_id_and_registers_host(self):
        response = self.api.post("/api/game/lobbies/", {
            "name": "Created Lobby",
            "description": "made in a test",
            "max_players": 10,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.content[:400])
        self.assertIn("id", response.json())

        lobby = Lobby.objects.get(id=response.json()["id"])
        self.assertEqual(lobby.host, self.host)

    def test_another_user_can_join_and_leave(self):
        lobby = self._make_lobby()
        api = APIClient()
        api.force_authenticate(user=self.player)

        join = api.post("/api/game/join/", {"lobby_id": lobby.id}, format="json")
        self.assertIn(join.status_code, (200, 201), join.content[:400])
        self.assertTrue(
            LobbyMember.objects.filter(lobby=lobby, user=self.player).exists()
        )

        leave = api.post(f"/api/game/lobbies/{lobby.id}/leave/")
        self.assertIn(leave.status_code, (200, 204), leave.content[:400])

    def test_joining_twice_is_idempotent(self):
        lobby = self._make_lobby()
        api = APIClient()
        api.force_authenticate(user=self.player)

        first = api.post("/api/game/join/", {"lobby_id": lobby.id}, format="json")
        second = api.post("/api/game/join/", {"lobby_id": lobby.id}, format="json")
        self.assertIn(first.status_code, (200, 201))
        self.assertIn(second.status_code, (200, 201), second.content[:300])
        self.assertEqual(
            LobbyMember.objects.filter(lobby=lobby, user=self.player).count(), 1
        )

    def test_private_lobby_rejects_wrong_password(self):
        lobby = self._make_lobby(is_private=True, password="secret")
        api = APIClient()
        api.force_authenticate(user=self.player)

        wrong = api.post(
            "/api/game/join/", {"lobby_id": lobby.id, "password": "nope"}, format="json"
        )
        self.assertEqual(wrong.status_code, 401, wrong.content[:300])

        right = api.post(
            "/api/game/join/", {"lobby_id": lobby.id, "password": "secret"}, format="json"
        )
        self.assertIn(right.status_code, (200, 201), right.content[:300])

    def test_my_lobbies_lists_only_mine(self):
        mine = self._make_lobby(name="Mine")
        other = Lobby.objects.create(name="Theirs", host=self.player)
        LobbyMember.objects.create(lobby=other, user=self.player)

        response = self.api.get("/api/game/my-lobbies/")
        self.assertEqual(response.status_code, 200)
        names = [row["name"] for row in self._items(response)]
        self.assertIn(mine.name, names)
        self.assertNotIn(other.name, names)

    def test_quick_join_places_user_in_a_lobby(self):
        self._make_lobby(name="Open Lobby")
        api = APIClient()
        api.force_authenticate(user=self.player)

        response = api.post("/api/game/quick-join/", {}, format="json")
        self.assertIn(response.status_code, (200, 201, 404), response.content[:300])
        if response.status_code in (200, 201):
            self.assertTrue(LobbyMember.objects.filter(user=self.player).exists())

    def test_save_and_remove_saved_lobby(self):
        lobby = self._make_lobby()
        api = APIClient()
        api.force_authenticate(user=self.player)

        saved = api.post(
            "/api/game/saved-lobbies/", {"lobby_id": lobby.id}, format="json"
        )
        self.assertIn(saved.status_code, (200, 201), saved.content[:400])
        self.assertTrue(SavedLobby.objects.filter(user=self.player, lobby=lobby).exists())

        listed = api.get("/api/game/saved-lobbies/")
        self.assertEqual(listed.status_code, 200)

        removed = api.delete(f"/api/game/saved-lobbies/{lobby.id}/")
        self.assertIn(removed.status_code, (200, 204), removed.content[:300])
        self.assertFalse(
            SavedLobby.objects.filter(user=self.player, lobby=lobby).exists()
        )

    def test_endpoints_require_authentication(self):
        anon = APIClient()
        for url in (
            "/api/game/lobbies/",
            "/api/game/my-lobbies/",
            "/api/game/saved-lobbies/",
            "/api/game/lobbies/stats/",
        ):
            with self.subTest(url=url):
                self.assertIn(anon.get(url).status_code, (401, 403))


    def test_the_last_person_out_closes_the_lobby(self):
        """
        The line that did this was commented out, so an empty hostless lobby
        stayed active for ever — listed, counted in the stats, and joinable by
        people who then found nobody in it.
        """
        lobby = self._make_lobby(name='Briefly')

        response = self.api.post(f'/api/game/lobbies/{lobby.id}/leave/')
        self.assertEqual(response.status_code, 200)

        lobby.refresh_from_db()
        self.assertFalse(lobby.is_active, 'an empty lobby is still active')

    def test_a_lobby_the_host_leaves_passes_to_somebody_else(self):
        lobby = self._make_lobby(name='Handover')
        LobbyMember.objects.create(lobby=lobby, user=self.player)

        self.api.post(f'/api/game/lobbies/{lobby.id}/leave/')

        lobby.refresh_from_db()
        self.assertTrue(lobby.is_active, 'a lobby with somebody still in it was closed')
        self.assertEqual(lobby.host, self.player)

    def test_leaving_works_on_a_machine_with_no_livekit(self):
        """
        Voice is optional, and a developer without the credentials is the
        normal case. Handing the lobby on pushes the new host's publishing
        rights to LiveKit, and that call re-raises when it is not configured —
        so uncaught, walking out of a lobby is a 500 for most people.
        """
        lobby = self._make_lobby(name='No voice here')
        LobbyMember.objects.create(lobby=lobby, user=self.player)

        response = self.api.post(f'/api/game/lobbies/{lobby.id}/leave/')

        self.assertEqual(response.status_code, 200, response.content[:200])
        lobby.refresh_from_db()
        self.assertEqual(lobby.host, self.player)

    def test_a_lobby_is_handed_on_even_when_the_others_are_offline(self):
        """
        The handover looked at `is_online`, which nothing ever set to False —
        and now that something does, an offline member is still a member. A
        lobby whose remaining players had all closed their tabs would otherwise
        be closed out from under them.
        """
        lobby = self._make_lobby(name='Quiet')
        LobbyMember.objects.create(lobby=lobby, user=self.player, is_online=False)

        self.api.post(f'/api/game/lobbies/{lobby.id}/leave/')

        lobby.refresh_from_db()
        self.assertTrue(lobby.is_active)
        self.assertEqual(lobby.host, self.player)


class LobbyConsumerTests(TestCase):
    """The realtime half: position sync, chat and study rooms over WebSocket."""

    def setUp(self):
        self.host = User.objects.create_user(
            username="wshost", email="wshost@example.com", password="pw"
        )
        self.player = User.objects.create_user(
            username="wsplayer", email="wsplayer@example.com", password="pw"
        )
        self.lobby = Lobby.objects.create(name="WS Lobby", host=self.host)
        LobbyMember.objects.create(lobby=self.lobby, user=self.host)
        LobbyMember.objects.create(lobby=self.lobby, user=self.player)

    def _communicator(self, user):
        from channels.testing import WebsocketCommunicator
        from game.consumers import LobbyConsumer

        communicator = WebsocketCommunicator(
            LobbyConsumer.as_asgi(), f"/ws/game/lobby/{self.lobby.id}/"
        )
        communicator.scope["url_route"] = {"kwargs": {"lobby_id": self.lobby.id}}
        communicator.scope["user"] = user
        return communicator

    async def _connect(self, user):
        communicator = self._communicator(user)
        connected, _ = await communicator.connect()
        return communicator, connected

    def test_member_can_connect(self):
        from asgiref.sync import async_to_sync

        async def scenario():
            communicator, connected = await self._connect(self.host)
            try:
                return connected
            finally:
                await communicator.disconnect()

        self.assertTrue(async_to_sync(scenario)())

    def test_non_member_is_rejected(self):
        from asgiref.sync import async_to_sync

        outsider = User.objects.create_user(
            username="outsider", email="out@example.com", password="pw"
        )

        async def scenario():
            communicator = self._communicator(outsider)
            connected, code = await communicator.connect()
            await communicator.disconnect()
            return connected, code

        connected, code = async_to_sync(scenario)()
        self.assertFalse(connected)
        self.assertEqual(code, 4003)

    def test_position_update_reaches_the_other_player(self):
        from asgiref.sync import async_to_sync

        async def scenario():
            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                # Drain the state/join frames each side receives on connect.
                while await a.receive_nothing(timeout=0.2) is False:
                    await a.receive_from(timeout=1)
                while await b.receive_nothing(timeout=0.2) is False:
                    await b.receive_from(timeout=1)

                await a.send_json_to({
                    "type": "player_position",
                    "x": 5.0,
                    "y": 7.5,
                    "direction": "left",
                    "is_moving": True,
                    "current_room": "library",
                })

                import json
                for _ in range(5):
                    if await b.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await b.receive_from(timeout=2))
                    if payload.get("type") == "position_update":
                        return payload
                return None
            finally:
                await a.disconnect()
                await b.disconnect()

        payload = async_to_sync(scenario)()
        self.assertIsNotNone(payload, "other player never received a position_update")
        position = payload["position"]
        self.assertEqual(position["x"], 5.0)
        self.assertEqual(position["y"], 7.5)
        # These three were silently dropped before: remote players never
        # animated, faced the wrong way, and room presence never synced.
        self.assertEqual(position["direction"], "left")
        self.assertTrue(position["is_moving"])
        self.assertEqual(position["current_room"], "library")

        from .models import PlayerPosition
        stored = PlayerPosition.objects.get(lobby=self.lobby, user=self.host)
        self.assertEqual(stored.direction, "left")
        self.assertTrue(stored.is_moving)
        self.assertEqual(stored.current_room, "library")

    def test_lobby_state_reports_who_is_indoors(self):
        """Joining mid-presentation has to show the share, not a blank screen."""
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        PlayerPosition.objects.create(
            lobby=self.lobby, user=self.host, x=3.0, y=4.0,
            direction="up", is_moving=False, current_room="3",
        )

        async def scenario():
            import json

            communicator, _ = await self._connect(self.player)
            try:
                for _ in range(5):
                    if await communicator.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await communicator.receive_from(timeout=2))
                    if payload.get("type") == "lobby_state":
                        return payload
                return None
            finally:
                await communicator.disconnect()

        payload = async_to_sync(scenario)()
        self.assertIsNotNone(payload, "never received a lobby_state frame")
        rooms = {entry["user_id"]: entry.get("current_room") for entry in payload["positions"]}
        self.assertIn(self.host.id, rooms)
        self.assertEqual(rooms[self.host.id], "3")

    async def _drain(self, *communicators):
        """Swallow the state and join frames each side gets on connect."""
        for c in communicators:
            while await c.receive_nothing(timeout=0.2) is False:
                await c.receive_from(timeout=1)

    @staticmethod
    def _seating(lobby_id):
        """
        Who is sitting where, read while the sockets are still open.

        Disconnecting releases a seat, so anything asserted after the scenario
        has torn down passes whatever the code does.
        """
        from asgiref.sync import sync_to_async
        from .models import PlayerPosition

        @sync_to_async
        def read():
            return {
                p.user_id: (p.seat, p.activity)
                for p in PlayerPosition.objects.filter(lobby_id=lobby_id)
            }

        return read()

    @staticmethod
    async def _next_frame(communicator, kind, tries=6):
        """
        The next frame of a given type, or None.

        Skips whatever else is queued: a seat claim and a chat message land on
        the same socket, and taking the first frame off it asserts against
        whichever happened to arrive first.

        Waiting for the frame is also what makes a test that then reads the
        database deterministic. `send_json_to` only queues, so a fixed pause
        afterwards is a race — and `receive_nothing` returns the instant
        anything is already waiting, which on a busy socket is no pause at all.
        """
        import json

        for _ in range(tries):
            if await communicator.receive_nothing(timeout=1):
                continue
            payload = json.loads(await communicator.receive_from(timeout=2))
            if payload.get('type') == kind:
                return payload
        return None

    @classmethod
    async def _next_position(cls, communicator, tries=6):
        return await cls._next_frame(communicator, 'position_update', tries)

    def test_a_seat_holds_one_person(self):
        """Two people in one chair. The database decides, not the browser."""
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        async def scenario():
            import json

            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                await self._drain(a, b)

                await a.send_json_to({'type': 'take_seat', 'seat': 'lecture-0-4'})
                # Let the first claim land, and let the broadcast of it reach
                # the second player, before the second claim is made.
                await a.receive_from(timeout=2)
                await self._drain(b)

                await b.send_json_to({'type': 'take_seat', 'seat': 'lecture-0-4'})
                for _ in range(6):
                    if await b.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await b.receive_from(timeout=2))
                    # Ignore anything that is about the other player.
                    if payload.get('user_id') == self.host.id:
                        continue
                    if payload.get('type') in ('seat_denied', 'seat_update'):
                        return payload, await self._seating(self.lobby.id)
                return None, await self._seating(self.lobby.id)
            finally:
                await a.disconnect()
                await b.disconnect()

        payload, seating = async_to_sync(scenario)()
        self.assertIsNotNone(payload, 'second player never heard back')
        self.assertEqual(payload['type'], 'seat_denied')
        self.assertEqual(payload['seat'], 'lecture-0-4')

        holders = [uid for uid, (seat, _) in seating.items() if seat == 'lecture-0-4']
        self.assertEqual(holders, [self.host.id])

    def test_standing_up_frees_the_seat(self):
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                await a.send_json_to({'type': 'take_seat', 'seat': 'cafe-1'})
                await a.receive_from(timeout=2)
                await a.send_json_to({'type': 'leave_seat'})
                await a.receive_from(timeout=2)
            finally:
                await a.disconnect()

        async_to_sync(scenario)()
        position = PlayerPosition.objects.get(lobby=self.lobby, user=self.host)
        self.assertIsNone(position.seat)
        self.assertEqual(position.activity, PlayerPosition.STANDING)

    def test_disconnecting_frees_the_seat(self):
        """A chair must not stay held by somebody who closed the tab."""
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        async def scenario():
            a, _ = await self._connect(self.host)
            await self._drain(a)
            await a.send_json_to({'type': 'take_seat', 'seat': 'cafe-2'})
            await a.receive_from(timeout=2)
            await a.disconnect()

        async_to_sync(scenario)()
        self.assertFalse(
            PlayerPosition.objects.filter(lobby=self.lobby, seat='cafe-2').exists()
        )

    def test_moving_does_not_stand_a_seated_player_up(self):
        """
        The client sends position sixty times a second while sitting still.

        Every one of those frames carries an activity, and if a position update
        were allowed to set it, sitting down would be undone by the very next
        frame — which is exactly how `current_room` used to be lost.
        """
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                await a.send_json_to({'type': 'take_seat', 'seat': 'lecture-2-3'})
                await a.receive_from(timeout=2)
                await a.send_json_to({
                    'type': 'player_position',
                    'x': 1.0, 'y': 2.0, 'activity': 'standing', 'is_moving': True,
                })
                await a.receive_nothing(timeout=0.5)
                return await self._seating(self.lobby.id)
            finally:
                await a.disconnect()

        seating = async_to_sync(scenario)()
        self.assertEqual(seating[self.host.id], ('lecture-2-3', PlayerPosition.SITTING))

    def test_a_seated_player_is_announced_as_seated(self):
        """
        The correction has to reach the wire, not just the row.

        Remote clients read `activity` straight off the position frame, so
        storing the player as sitting while telling every peer they are
        standing takes the avatar out of the chair everywhere and leaves the
        server still holding the seat — the same shape of fault as the
        `current_room` one, correct in the database and wrong on the wire.
        """
        from asgiref.sync import async_to_sync

        async def scenario():
            import json

            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                await self._drain(a, b)
                await a.send_json_to({'type': 'take_seat', 'seat': 'lecture-1-2'})
                await a.receive_from(timeout=2)
                await self._drain(b)

                await a.send_json_to({
                    'type': 'player_position',
                    'x': 1.0, 'y': 2.0, 'activity': 'standing', 'is_moving': True,
                })
                for _ in range(5):
                    if await b.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await b.receive_from(timeout=2))
                    if payload.get('type') == 'position_update':
                        return payload
                return None
            finally:
                await a.disconnect()
                await b.disconnect()

        payload = async_to_sync(scenario)()
        self.assertIsNotNone(payload, 'other player never received a position_update')
        self.assertEqual(payload['position']['activity'], 'sitting')

    def test_a_seated_player_can_still_emote(self):
        """Raising a hand from a chair is the point of having both."""
        from asgiref.sync import async_to_sync

        async def scenario():
            import json

            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                await self._drain(a, b)
                await a.send_json_to({'type': 'take_seat', 'seat': 'lecture-1-3'})
                await a.receive_from(timeout=2)
                await self._drain(b)

                await a.send_json_to({
                    'type': 'player_position',
                    'x': 1.0, 'y': 2.0, 'activity': 'hand_raised', 'is_moving': False,
                })
                for _ in range(5):
                    if await b.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await b.receive_from(timeout=2))
                    if payload.get('type') == 'position_update':
                        return payload, await self._seating(self.lobby.id)
                return None, None
            finally:
                await a.disconnect()
                await b.disconnect()

        payload, seating = async_to_sync(scenario)()
        self.assertIsNotNone(payload)
        # Only 'standing' is overridden, so the emote survives...
        self.assertEqual(payload['position']['activity'], 'hand_raised')
        # ...and the seat is still held, because only leave_seat releases it.
        self.assertEqual(seating[self.host.id][0], 'lecture-1-3')

    def test_a_position_frame_carries_the_seat_the_server_holds(self):
        """
        Peers keep their own record of who is sitting where, and the position
        frame is most of what feeds it.

        The frame used to carry no seat at all, which reads as "sitting
        nowhere": a seated player's chair dropped out of every other client's
        map the moment they did anything that sent a frame, waving included.
        The chair was then offered to the next person to walk up to it, whose
        claim the server refused — which in a browser looks like the key not
        working.
        """
        from asgiref.sync import async_to_sync

        async def scenario():
            import json

            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                await self._drain(a, b)
                await a.send_json_to({'type': 'take_seat', 'seat': 'lecture-1-4'})
                await a.receive_from(timeout=2)
                await self._drain(b)

                # Waving from the chair: exactly the frame that used to erase
                # the seat everywhere.
                await a.send_json_to({
                    'type': 'player_position',
                    'x': 1.0, 'y': 2.0, 'activity': 'waving', 'is_moving': False,
                })
                seated = await self._next_position(b)

                await a.send_json_to({'type': 'leave_seat'})
                await a.receive_from(timeout=2)
                await self._drain(b)
                await a.send_json_to({
                    'type': 'player_position',
                    'x': 3.0, 'y': 4.0, 'activity': 'standing', 'is_moving': True,
                })
                stood = await self._next_position(b)
                return seated, stood
            finally:
                await a.disconnect()
                await b.disconnect()

        seated, stood = async_to_sync(scenario)()
        self.assertIsNotNone(seated, 'other player never received a position_update')
        self.assertEqual(seated['position']['seat'], 'lecture-1-4')
        # And standing up has to reach the wire too, or the chair is never
        # offered to anybody again for as long as the page stays open.
        self.assertIsNotNone(stood)
        self.assertIsNone(stood['position']['seat'])

    def test_a_spoofed_seat_never_reaches_the_wire(self):
        """
        The seat on the wire is read from the row, never from the frame.

        Now that it is broadcast, it looks like something a client could set.
        The row is already guarded — `test_a_position_frame_cannot_claim_a_seat`
        covers that — but the peers' own map of who is sitting where is built
        from these frames, so a seat echoed back off a frame would let a
        modified client take an occupied chair everywhere but the database.
        Same reasoning as the LiveKit grants: the answer comes from what the
        server holds, not from what the client said.
        """
        from asgiref.sync import async_to_sync

        async def scenario():
            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                await self._drain(a, b)
                # B takes the chair honestly.
                await b.send_json_to({'type': 'take_seat', 'seat': 'lecture-1-5'})
                await b.receive_from(timeout=2)
                await self._drain(a)

                # A tries to take it by asserting it in a position frame.
                await a.send_json_to({
                    'type': 'player_position',
                    'x': 1.0, 'y': 2.0, 'activity': 'sitting', 'is_moving': False,
                    'seat': 'lecture-1-5',
                })
                announced = await self._next_position(b)
                return announced, await self._seating(self.lobby.id)
            finally:
                await a.disconnect()
                await b.disconnect()

        announced, seating = async_to_sync(scenario)()
        self.assertIsNotNone(announced)
        self.assertIsNone(announced['position']['seat'])
        self.assertIsNone(seating[self.host.id][0])
        self.assertEqual(seating[self.player.id][0], 'lecture-1-5')

    @staticmethod
    def _props(lobby_id):
        """Where the loose objects are, read while the sockets are still open."""
        from asgiref.sync import sync_to_async
        from .models import CampusProp

        @sync_to_async
        def read():
            return {
                p.prop: (p.x, p.y, p.room)
                for p in CampusProp.objects.filter(lobby_id=lobby_id)
            }

        return read()

    @staticmethod
    def _holding(lobby_id):
        from asgiref.sync import sync_to_async
        from .models import PlayerPosition

        @sync_to_async
        def read():
            return {
                p.user_id: p.holding
                for p in PlayerPosition.objects.filter(lobby_id=lobby_id)
            }

        return read()

    def test_an_object_is_held_by_one_pair_of_hands(self):
        """
        The same rule as a chair, for the same reason.

        A ball two clients each believe they are holding is two balls, and only
        one of them lands where the other expects it to.
        """
        from asgiref.sync import async_to_sync

        async def scenario():
            import json

            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                await self._drain(a, b)
                await a.send_json_to({'type': 'take_prop', 'prop': 'ball-court'})
                await b.send_json_to({'type': 'take_prop', 'prop': 'ball-court'})

                denials = 0
                for socket in (a, b):
                    for _ in range(4):
                        if await socket.receive_nothing(timeout=1):
                            continue
                        payload = json.loads(await socket.receive_from(timeout=2))
                        if payload.get('type') == 'prop_denied':
                            denials += 1
                return denials, await self._holding(self.lobby.id)
            finally:
                await a.disconnect()
                await b.disconnect()

        denials, holding = async_to_sync(scenario)()
        held_by = [user for user, prop in holding.items() if prop == 'ball-court']
        self.assertEqual(len(held_by), 1, 'two people ended up holding one ball')
        self.assertEqual(denials, 1)

    def test_dropping_records_where_the_object_landed(self):
        """
        A prop that is only as real as the broadcast that moved it is not a
        prop. Somebody who joins after the throw has to find the ball where it
        actually is, not back on its shelf.
        """
        from asgiref.sync import async_to_sync

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                await a.send_json_to({
                    'type': 'player_position', 'x': 400.0, 'y': 300.0, 'is_moving': False,
                })
                await self._next_frame(a, 'position_update')
                await a.send_json_to({'type': 'take_prop', 'prop': 'ball-court'})
                await self._next_frame(a, 'prop_update')
                await a.send_json_to({
                    'type': 'drop_prop', 'prop': 'ball-court', 'x': 450.0, 'y': 320.0,
                })
                await self._next_frame(a, 'prop_update')
                return await self._props(self.lobby.id), await self._holding(self.lobby.id)
            finally:
                await a.disconnect()

        props, holding = async_to_sync(scenario)()
        self.assertIn('ball-court', props)
        x, y, _room = props['ball-court']
        self.assertAlmostEqual(x, 450.0)
        self.assertAlmostEqual(y, 320.0)
        # And their hands are empty again, or they can never pick anything up.
        self.assertIsNone(holding[self.host.id])

    def test_a_throw_is_clamped_to_a_throwable_distance(self):
        """
        The landing place comes from the client, which simulated the arc. The
        distance does not: unbounded, "I dropped it here" names any point on
        the campus, and an object becomes something you can post into a room
        you are not standing in.
        """
        from asgiref.sync import async_to_sync

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                await a.send_json_to({
                    'type': 'player_position', 'x': 400.0, 'y': 300.0, 'is_moving': False,
                })
                await self._next_frame(a, 'position_update')
                await a.send_json_to({'type': 'take_prop', 'prop': 'ball-court'})
                await self._next_frame(a, 'prop_update')
                # Half the campus away.
                await a.send_json_to({
                    'type': 'drop_prop', 'prop': 'ball-court', 'x': 5000.0, 'y': 300.0,
                })
                await self._next_frame(a, 'prop_update')
                return await self._props(self.lobby.id)
            finally:
                await a.disconnect()

        props = async_to_sync(scenario)()
        x, y, _room = props['ball-court']
        # Clamped along the same line, so a long throw is a shorter throw in
        # the direction it was aimed rather than a throw that does not happen.
        self.assertAlmostEqual(x, 650.0)
        self.assertAlmostEqual(y, 300.0)

    def test_a_nonsense_landing_place_is_refused(self):
        """NaN reaches a float column and breaks every client that reads it."""
        from asgiref.sync import async_to_sync

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                await a.send_json_to({'type': 'take_prop', 'prop': 'ball-court'})
                await self._next_frame(a, 'prop_update')
                await a.send_json_to({
                    'type': 'drop_prop', 'prop': 'ball-court', 'x': 'over there', 'y': None,
                })
                await self._next_frame(a, 'prop_denied')
                return await self._props(self.lobby.id), await self._holding(self.lobby.id)
            finally:
                await a.disconnect()

        props, holding = async_to_sync(scenario)()
        self.assertEqual(props, {})
        # Still holding it: a refused drop must not quietly empty their hands.
        self.assertEqual(holding[self.host.id], 'ball-court')

    def test_closing_the_tab_puts_the_object_down(self):
        """
        Otherwise it is held forever. The constraint that makes the object
        theirs does not care that they have gone, so nobody can ever pick it
        up again for the life of the lobby.
        """
        from asgiref.sync import async_to_sync

        async def scenario():
            a, _ = await self._connect(self.host)
            await self._drain(a)
            await a.send_json_to({
                'type': 'player_position', 'x': 410.0, 'y': 290.0, 'is_moving': False,
            })
            await self._next_frame(a, 'position_update')
            await a.send_json_to({'type': 'take_prop', 'prop': 'ball-court'})
            await self._next_frame(a, 'prop_update')
            await a.disconnect()
            return await self._props(self.lobby.id), await self._holding(self.lobby.id)

        props, holding = async_to_sync(scenario)()
        self.assertIsNone(holding[self.host.id])
        # Left where they were standing, rather than back on its shelf.
        self.assertIn('ball-court', props)
        self.assertAlmostEqual(props['ball-court'][0], 410.0)

    def test_a_light_switch_reaches_the_rest_of_the_room(self):
        """A switch that dims the room for whoever flicked it is a decoration."""
        from asgiref.sync import async_to_sync

        async def scenario():
            import json

            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                await self._drain(a, b)
                await a.send_json_to({'type': 'set_light', 'room': '3', 'on': False})
                for _ in range(4):
                    if await b.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await b.receive_from(timeout=2))
                    if payload.get('type') == 'light_update':
                        return payload
                return None
            finally:
                await a.disconnect()
                await b.disconnect()

        payload = async_to_sync(scenario)()
        self.assertIsNotNone(payload, 'the other player never heard the switch')
        self.assertEqual(payload['room'], '3')
        self.assertIs(payload['on'], False)

    def test_the_lights_are_still_off_when_the_next_person_arrives(self):
        """
        Which is the whole point of a switch. Broadcast and forgotten, it would
        be lit again for anybody who walked in a minute later.
        """
        from asgiref.sync import async_to_sync

        async def scenario():
            import json

            a, _ = await self._connect(self.host)
            await self._drain(a)
            await a.send_json_to({'type': 'set_light', 'room': '3', 'on': False})
            await self._next_frame(a, 'light_update')
            await a.disconnect()

            b, _ = await self._connect(self.player)
            try:
                for _ in range(4):
                    if await b.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await b.receive_from(timeout=2))
                    if payload.get('type') == 'lobby_state':
                        return payload
                return None
            finally:
                await b.disconnect()

        payload = async_to_sync(scenario)()
        self.assertIsNotNone(payload)
        self.assertEqual(payload['lights'], [{'room': '3', 'on': False}])

    def test_an_empty_seat_string_is_not_a_seat(self):
        """
        The one-per-chair rule excludes NULL, not ''.

        Two players each holding an empty string would be a real conflict in
        one lobby, and `default=None` does not stop a write of ''.
        """
        from django.db.utils import IntegrityError
        from .models import PlayerPosition

        with self.assertRaises(IntegrityError):
            PlayerPosition.objects.create(
                lobby=self.lobby, user=self.host, x=0, y=0, seat='',
            )

    def test_a_position_frame_cannot_claim_a_seat(self):
        """The occupancy check lives in take_seat; nothing may route around it."""
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                await a.send_json_to({
                    'type': 'player_position',
                    'x': 0.0, 'y': 0.0, 'seat': 'lecture-0-0',
                })
                await a.receive_nothing(timeout=0.5)
                return await self._seating(self.lobby.id)
            finally:
                await a.disconnect()

        seating = async_to_sync(scenario)()
        self.assertIsNone(seating[self.host.id][0])

    def test_heading_and_activity_reach_the_other_player(self):
        from asgiref.sync import async_to_sync

        async def scenario():
            import json

            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                await self._drain(a, b)
                await a.send_json_to({
                    'type': 'player_position',
                    'x': 1.0, 'y': 2.0,
                    'heading': 1.25,
                    'activity': 'waving',
                    'is_moving': False,
                })
                for _ in range(5):
                    if await b.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await b.receive_from(timeout=2))
                    if payload.get('type') == 'position_update':
                        return payload
                return None
            finally:
                await a.disconnect()
                await b.disconnect()

        payload = async_to_sync(scenario)()
        self.assertIsNotNone(payload)
        self.assertAlmostEqual(payload['position']['heading'], 1.25, places=5)
        self.assertEqual(payload['position']['activity'], 'waving')

    def test_a_nonsense_heading_does_not_reach_the_database(self):
        """
        The client sends this every frame. A NaN in the column is a row that
        then breaks every serialiser that touches it, and JSON has no NaN, so
        it arrives as a string or a null rather than as a number.
        """
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                for bad in ['not-a-number', None, 'Infinity']:
                    await a.send_json_to({
                        'type': 'player_position', 'x': 0.0, 'y': 0.0, 'heading': bad,
                    })
                    await a.receive_nothing(timeout=0.3)
            finally:
                await a.disconnect()

        async_to_sync(scenario)()
        position = PlayerPosition.objects.get(lobby=self.lobby, user=self.host)
        import math
        self.assertTrue(math.isfinite(position.heading))

    def test_a_position_frame_carries_how_high_the_player_is(self):
        """
        The third axis, which nothing used to send.

        Everybody else drew a remote player at zero, which is right on a flat
        floor and wrong on every tier, bleacher and stair tread on the campus —
        a lecture audience appeared buried in the seating.
        """
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        async def scenario():
            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                await self._drain(a, b)
                await a.send_json_to({
                    'type': 'player_position',
                    'x': 400.0, 'y': 300.0, 'elevation': 3.75,
                })
                import json
                for _ in range(5):
                    if await b.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await b.receive_from(timeout=2))
                    if payload.get('type') == 'position_update':
                        return payload
                return None
            finally:
                await a.disconnect()
                await b.disconnect()

        payload = async_to_sync(scenario)()
        self.assertIsNotNone(payload, 'the other player never got a position_update')
        self.assertEqual(payload['position']['elevation'], 3.75)
        stored = PlayerPosition.objects.get(lobby=self.lobby, user=self.host)
        self.assertEqual(stored.elevation, 3.75)

    def test_the_lobby_snapshot_says_how_high_everybody_is(self):
        """
        Left out of the snapshot, anybody already sitting on a tier when you
        arrive is drawn on the floor until they next move.
        """
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        PlayerPosition.objects.update_or_create(
            lobby=self.lobby, user=self.player,
            defaults={'x': 400.0, 'y': 300.0, 'elevation': 2.8},
        )

        async def scenario():
            import json
            a, _ = await self._connect(self.host)
            try:
                for _ in range(5):
                    payload = json.loads(await a.receive_from(timeout=2))
                    if payload.get('type') == 'lobby_state':
                        return payload
                return None
            finally:
                await a.disconnect()

        state = async_to_sync(scenario)()
        self.assertIsNotNone(state, 'no lobby_state arrived')
        heights = {p['user_id']: p.get('elevation') for p in state['positions']}
        self.assertEqual(heights.get(self.player.id), 2.8)

    def test_an_impossible_elevation_never_reaches_the_column(self):
        """
        Same reasoning as the heading: this is a float column every other
        client reads back, so a NaN or an infinity here breaks everybody's
        scene rather than only the sender's. The campus is twenty-five metres
        tall, so a five-figure height is nonsense whoever sent it.
        """
        from asgiref.sync import async_to_sync, sync_to_async
        from .models import PlayerPosition
        import math

        @sync_to_async
        def stored():
            return PlayerPosition.objects.get(lobby=self.lobby, user=self.host).elevation

        # Read back after *each* one rather than at the end. Every frame
        # overwrites the row, so a single assertion after the loop only ever
        # tests the last value — which is how the first version of this test
        # passed against a bound four hundred times too loose.
        bad_values = ['not-a-number', None, 'Infinity', 5000.0, -5000.0, 1e9]

        async def scenario():
            a, _ = await self._connect(self.host)
            seen = []
            try:
                await self._drain(a)
                for bad in bad_values:
                    await a.send_json_to({
                        'type': 'player_position',
                        'x': 0.0, 'y': 0.0, 'elevation': bad,
                    })
                    await a.receive_nothing(timeout=0.3)
                    seen.append(await stored())
            finally:
                await a.disconnect()
            return seen

        for sent, kept in zip(bad_values, async_to_sync(scenario)()):
            self.assertTrue(math.isfinite(kept), f'{sent!r} stored {kept!r}')
            # 5000 is finite and well-formed, and still four hundred metres
            # above anything on this campus. The generic coordinate bound is a
            # hundred thousand, which would let it through.
            self.assertLessEqual(abs(kept), 200, f'{sent!r} stored {kept!r}')

    def test_calling_the_lift_moves_it_for_everybody(self):
        """
        A car that is only on the third floor for whoever sent it there is a
        decoration. Somebody walking up to the doors has to find it where the
        last person left it.
        """
        from asgiref.sync import async_to_sync
        from .models import LiftCar

        async def scenario():
            import json
            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                await self._drain(a, b)
                await a.send_json_to({'type': 'call_lift', 'floor': 3})
                for _ in range(5):
                    if await b.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await b.receive_from(timeout=2))
                    if payload.get('type') == 'lift_update':
                        return payload
                return None
            finally:
                await a.disconnect()
                await b.disconnect()

        payload = async_to_sync(scenario)()
        self.assertIsNotNone(payload, 'the other player never heard the lift move')
        self.assertEqual(payload['floor'], 3)
        self.assertEqual(LiftCar.objects.get(lobby=self.lobby).floor, 3)

    def test_the_lift_cannot_be_sent_to_a_floor_that_does_not_exist(self):
        """
        The floor indexes four levels. A car at floor nine has its doors at a
        height nobody can reach, so nobody could ever call it back.
        """
        from asgiref.sync import async_to_sync, sync_to_async
        from .models import LiftCar

        @sync_to_async
        def parked():
            car = LiftCar.objects.filter(lobby=self.lobby).first()
            return None if car is None else car.floor

        async def scenario():
            a, _ = await self._connect(self.host)
            seen = []
            try:
                await self._drain(a)
                for bad in [9, -1, 'top', None, 3.7]:
                    await a.send_json_to({'type': 'call_lift', 'floor': bad})
                    await a.receive_nothing(timeout=0.3)
                    seen.append(await parked())
            finally:
                await a.disconnect()
            return seen

        # Read back after each, because every call overwrites the row: asserting
        # once at the end only ever tests the last value.
        for sent, kept in zip([9, -1, 'top', None, 3.7], async_to_sync(scenario)()):
            self.assertIn(kept, (None, 3), f'{sent!r} parked the car at {kept!r}')

    def test_the_lobby_snapshot_says_where_the_lift_is(self):
        """
        Left out and somebody arriving sees the car at the ground floor while
        everybody else is looking at it on the third.
        """
        from asgiref.sync import async_to_sync
        from .models import LiftCar

        LiftCar.objects.update_or_create(lobby=self.lobby, defaults={'floor': 2})

        async def scenario():
            import json
            a, _ = await self._connect(self.host)
            try:
                for _ in range(5):
                    payload = json.loads(await a.receive_from(timeout=2))
                    if payload.get('type') == 'lobby_state':
                        return payload
                return None
            finally:
                await a.disconnect()

        state = async_to_sync(scenario)()
        self.assertIsNotNone(state, 'no lobby_state arrived')
        self.assertEqual(state['lift']['floor'], 2)

    def test_a_lobby_nobody_has_used_the_lift_in_reports_the_ground_floor(self):
        from asgiref.sync import async_to_sync

        async def scenario():
            import json
            a, _ = await self._connect(self.host)
            try:
                for _ in range(5):
                    payload = json.loads(await a.receive_from(timeout=2))
                    if payload.get('type') == 'lobby_state':
                        return payload
                return None
            finally:
                await a.disconnect()

        state = async_to_sync(scenario)()
        self.assertEqual(state['lift']['floor'], 0)
    def test_connecting_marks_you_online_and_leaving_marks_you_off(self):
        """
        `is_online` was set when somebody joined and never set back — nothing
        anywhere wrote False. Since `Lobby.current_players_count` counts
        exactly this, a lobby filled with people who were not in it and then
        refused everybody with "Lobby is full".
        """
        from asgiref.sync import async_to_sync, sync_to_async
        from .models import LobbyMember

        LobbyMember.objects.filter(lobby=self.lobby, user=self.host).update(is_online=False)

        @sync_to_async
        def online():
            return LobbyMember.objects.get(lobby=self.lobby, user=self.host).is_online

        async def scenario():
            a, _ = await self._connect(self.host)
            await self._drain(a)
            during = await online()
            await a.disconnect()
            return during

        during = async_to_sync(scenario)()
        self.assertTrue(during, 'connecting did not mark the member online')
        after = LobbyMember.objects.get(lobby=self.lobby, user=self.host)
        self.assertFalse(after.is_online, 'leaving did not mark the member offline')

    def test_a_lobby_stops_counting_players_who_have_gone(self):
        """The count is what capacity is decided from, so a ghost is a slot."""
        from asgiref.sync import async_to_sync

        async def scenario():
            a, _ = await self._connect(self.host)
            await self._drain(a)
            await a.disconnect()

        async_to_sync(scenario)()
        self.lobby.refresh_from_db()
        self.assertNotIn(
            self.host.id,
            [m.user_id for m in self.lobby.members.filter(is_online=True)],
        )

    def test_a_frame_the_column_cannot_hold_does_not_kill_the_socket(self):
        """
        `receive` catches only `json.JSONDecodeError`, so anything else that
        comes out of the save propagates and Channels closes the connection.
        A non-numeric `x` reached a FloatField and did exactly that.
        """
        from asgiref.sync import async_to_sync

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                for bad in [
                    {'x': 'abc', 'y': 0},
                    {'x': None, 'y': None},
                    {'x': 0, 'y': 0, 'current_room': 'r' * 400},
                    {'x': 0, 'y': 0, 'direction': 'sideways'},
                    {'x': 0, 'y': 0, 'direction': 12},
                ]:
                    await a.send_json_to({'type': 'player_position', **bad})
                    await a.receive_nothing(timeout=0.3)
                # Still usable afterwards, which is the whole point.
                await a.send_json_to({'type': 'ping'})
                reply = await a.receive_from(timeout=2)
                return reply
            finally:
                await a.disconnect()

        reply = async_to_sync(scenario)()
        self.assertIn('Unknown message type', reply, 'the socket did not survive')

    def test_a_direction_the_column_does_not_allow_falls_back(self):
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                await a.send_json_to({
                    'type': 'player_position', 'x': 0.0, 'y': 0.0, 'direction': 'sideways',
                })
                await a.receive_nothing(timeout=0.4)
            finally:
                await a.disconnect()

        async_to_sync(scenario)()
        stored = PlayerPosition.objects.get(lobby=self.lobby, user=self.host)
        self.assertIn(
            stored.direction,
            {value for value, _ in PlayerPosition._meta.get_field('direction').choices},
        )

    def test_a_room_longer_than_the_column_is_refused(self):
        """
        Fifty characters. Longer raised `DataError` on PostgreSQL, which is
        production, and passed silently on the SQLite everybody develops
        against — a bug that could not reproduce in a dev environment.
        """
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                await a.send_json_to({
                    'type': 'player_position', 'x': 0.0, 'y': 0.0, 'current_room': 'r' * 400,
                })
                await a.receive_nothing(timeout=0.4)
            finally:
                await a.disconnect()

        async_to_sync(scenario)()
        stored = PlayerPosition.objects.get(lobby=self.lobby, user=self.host)
        self.assertTrue(
            stored.current_room is None or len(stored.current_room) <= 50,
            f'stored a room of {len(stored.current_room or "")} characters',
        )

    def test_a_chat_message_is_held_to_the_length_the_column_says(self):
        """
        `max_length` on a `TextField` is a form-level hint the database does
        not enforce, and `objects.create` runs no validation. So one frame
        stored 200,000 characters, broadcast them to the whole lobby, and put
        them in the snapshot every later joiner downloads.
        """
        from asgiref.sync import async_to_sync
        from .models import ChatMessage

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                await a.send_json_to({'type': 'chat_message', 'message': 'x' * 200000})
                await a.receive_nothing(timeout=0.6)
            finally:
                await a.disconnect()

        async_to_sync(scenario)()
        longest = max((len(m.message) for m in ChatMessage.objects.all()), default=0)
        self.assertLessEqual(longest, 500, f'stored a {longest}-character message')

    def test_a_chat_message_that_is_not_a_string_does_not_kill_the_socket(self):
        """`.strip()` on a number raises, and took the connection with it."""
        from asgiref.sync import async_to_sync

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                for bad in [12345, None, {'text': 'hi'}, ['hi']]:
                    await a.send_json_to({'type': 'chat_message', 'message': bad})
                    await a.receive_nothing(timeout=0.25)
                await a.send_json_to({'type': 'ping'})
                return await a.receive_from(timeout=2)
            finally:
                await a.disconnect()

        reply = async_to_sync(scenario)()
        self.assertIn('Unknown message type', reply, 'the socket did not survive')

    def test_a_chat_message_keeps_the_channel_it_was_said_on(self):
        """
        The client has always sent `room` and the consumer has always thrown it
        away — never stored, never broadcast — so every message came back
        labelled global whatever tab it was typed in. The chat has a "nearby"
        tab, so people were saying things they believed were going to whoever
        was around them and sending them to the whole lobby.
        """
        from asgiref.sync import async_to_sync
        from .models import ChatMessage

        async def scenario():
            import json
            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                await self._drain(a, b)
                await a.send_json_to({
                    'type': 'chat_message', 'message': 'over here', 'room': 'nearby',
                })
                for _ in range(5):
                    if await b.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await b.receive_from(timeout=2))
                    if payload.get('type') == 'chat_message':
                        return payload
                return None
            finally:
                await a.disconnect()
                await b.disconnect()

        payload = async_to_sync(scenario)()
        self.assertIsNotNone(payload, 'the message never arrived')
        self.assertEqual(payload['room'], 'nearby', 'the channel was dropped on the way out')
        stored = ChatMessage.objects.get(message='over here')
        self.assertEqual(stored.room, 'nearby', 'the channel was never stored')

    def test_a_global_message_has_no_room(self):
        from asgiref.sync import async_to_sync
        from .models import ChatMessage

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                await a.send_json_to({'type': 'chat_message', 'message': 'everyone'})
                await a.receive_nothing(timeout=0.5)
            finally:
                await a.disconnect()

        async_to_sync(scenario)()
        self.assertIsNone(ChatMessage.objects.get(message='everyone').room)

    def test_the_backlog_a_joiner_gets_is_labelled_too(self):
        """Otherwise every message in the history reads as global."""
        from asgiref.sync import async_to_sync
        from .models import ChatMessage

        ChatMessage.objects.create(
            lobby=self.lobby, user=self.player, message='said earlier', room='nearby'
        )

        async def scenario():
            import json
            a, _ = await self._connect(self.host)
            try:
                for _ in range(5):
                    payload = json.loads(await a.receive_from(timeout=2))
                    if payload.get('type') == 'lobby_state':
                        return payload
                return None
            finally:
                await a.disconnect()

        state = async_to_sync(scenario)()
        said = [m for m in state['messages'] if m['message'] == 'said earlier']
        self.assertEqual(len(said), 1)
        self.assertEqual(said[0]['room'], 'nearby')

    def test_an_unknown_activity_falls_back_to_standing(self):
        from asgiref.sync import async_to_sync
        from .models import PlayerPosition

        async def scenario():
            a, _ = await self._connect(self.host)
            try:
                await self._drain(a)
                await a.send_json_to({
                    'type': 'player_position', 'x': 0.0, 'y': 0.0, 'activity': 'sudo',
                })
                await a.receive_nothing(timeout=0.5)
            finally:
                await a.disconnect()

        async_to_sync(scenario)()
        position = PlayerPosition.objects.get(lobby=self.lobby, user=self.host)
        self.assertEqual(position.activity, PlayerPosition.STANDING)

    def test_chat_message_is_broadcast_and_persisted(self):
        from asgiref.sync import async_to_sync

        async def scenario():
            a, _ = await self._connect(self.host)
            b, _ = await self._connect(self.player)
            try:
                while await a.receive_nothing(timeout=0.2) is False:
                    await a.receive_from(timeout=1)
                while await b.receive_nothing(timeout=0.2) is False:
                    await b.receive_from(timeout=1)

                await a.send_json_to({"type": "chat_message", "message": "hello lobby"})

                import json
                for _ in range(5):
                    if await b.receive_nothing(timeout=1):
                        continue
                    payload = json.loads(await b.receive_from(timeout=2))
                    if payload.get("type") == "chat_message":
                        return payload
                return None
            finally:
                await a.disconnect()
                await b.disconnect()

        payload = async_to_sync(scenario)()
        self.assertIsNotNone(payload, "chat message was never broadcast")
        self.assertEqual(payload["message"], "hello lobby")

        from .models import ChatMessage
        self.assertTrue(
            ChatMessage.objects.filter(lobby=self.lobby, message="hello lobby").exists(),
            "chat message was broadcast but not persisted",
        )


LIVEKIT_ENV = {
    "LIVEKIT_API_KEY": "devkey",
    "LIVEKIT_API_SECRET": "devsecret0123456789devsecret0123",
    "LIVEKIT_URL": "wss://example.livekit.cloud",
}


class LiveKitTokenTests(TestCase):
    """Publishing rights come from the token, so they are decided server-side."""

    def setUp(self):
        self.host = User.objects.create_user(
            username="lkhost", email="lkhost@example.com", password="pw"
        )
        self.player = User.objects.create_user(
            username="lkplayer", email="lkplayer@example.com", password="pw"
        )
        self.outsider = User.objects.create_user(
            username="lkout", email="lkout@example.com", password="pw"
        )
        self.lobby = Lobby.objects.create(name="LK Lobby", host=self.host)
        self.host_member = LobbyMember.objects.create(lobby=self.lobby, user=self.host)
        self.player_member = LobbyMember.objects.create(
            lobby=self.lobby, user=self.player
        )

    def _client(self, user):
        api = APIClient()
        api.force_authenticate(user=user)
        return api

    def _token(self, user):
        import os
        from unittest.mock import patch

        with patch.dict(os.environ, LIVEKIT_ENV):
            return self._client(user).post(
                f"/api/game/lobbies/{self.lobby.id}/livekit-token/"
            )

    def test_non_member_cannot_get_a_token(self):
        response = self._token(self.outsider)
        self.assertEqual(response.status_code, 403, response.content[:300])

    def test_member_gets_a_token_scoped_to_this_lobby_room(self):
        response = self._token(self.player)
        self.assertEqual(response.status_code, 200, response.content[:300])
        body = response.json()
        self.assertTrue(body["token"])
        self.assertEqual(body["room"], f"lobby-{self.lobby.id}")
        self.assertEqual(body["identity"], f"user-{self.player.id}")

    def test_host_may_screen_share_without_being_granted(self):
        body = self._token(self.host).json()
        self.assertIn("screen_share", body["can_publish_sources"])
        self.assertTrue(body["is_host"])

    def test_member_may_not_screen_share_by_default(self):
        body = self._token(self.player).json()
        self.assertIn("microphone", body["can_publish_sources"])
        self.assertNotIn("screen_share", body["can_publish_sources"])
        self.assertFalse(body["is_host"])

    def test_granting_screen_share_changes_the_token(self):
        self.player_member.can_share_screen = True
        self.player_member.save()
        body = self._token(self.player).json()
        self.assertIn("screen_share", body["can_publish_sources"])

    def test_muted_member_cannot_publish_microphone(self):
        self.player_member.is_muted = True
        self.player_member.save()
        body = self._token(self.player).json()
        self.assertNotIn("microphone", body["can_publish_sources"])

    def test_token_endpoint_reports_missing_configuration(self):
        import os
        from unittest.mock import patch

        with patch.dict(os.environ, {"LIVEKIT_API_KEY": "", "LIVEKIT_API_SECRET": "", "LIVEKIT_URL": ""}):
            response = self._client(self.player).post(
                f"/api/game/lobbies/{self.lobby.id}/livekit-token/"
            )
        self.assertEqual(response.status_code, 503)


class HostModerationTests(TestCase):
    def setUp(self):
        self.host = User.objects.create_user(
            username="modhost", email="modhost@example.com", password="pw"
        )
        self.player = User.objects.create_user(
            username="modplayer", email="modplayer@example.com", password="pw"
        )
        self.lobby = Lobby.objects.create(name="Mod Lobby", host=self.host)
        LobbyMember.objects.create(lobby=self.lobby, user=self.host)
        self.player_member = LobbyMember.objects.create(
            lobby=self.lobby, user=self.player
        )

    def _client(self, user):
        api = APIClient()
        api.force_authenticate(user=user)
        return api

    def _post(self, user, path, payload=None):
        from unittest.mock import patch

        # Don't reach out to a real LiveKit server from a test.
        with patch("game.livekit_service.sync_participant_permissions", return_value=True):
            return self._client(user).post(path, payload or {}, format="json")

    def test_host_can_mute_a_member(self):
        response = self._post(
            self.host,
            f"/api/game/lobbies/{self.lobby.id}/members/{self.player.id}/mute/",
            {"muted": True},
        )
        self.assertEqual(response.status_code, 200, response.content[:300])
        self.player_member.refresh_from_db()
        self.assertTrue(self.player_member.is_muted)

    def test_member_cannot_mute_anyone(self):
        response = self._post(
            self.player,
            f"/api/game/lobbies/{self.lobby.id}/members/{self.host.id}/mute/",
            {"muted": True},
        )
        self.assertEqual(response.status_code, 403, response.content[:300])

    def test_member_cannot_grant_themselves_screen_share(self):
        response = self._post(
            self.player,
            f"/api/game/lobbies/{self.lobby.id}/members/{self.player.id}/screen-share/",
            {"allowed": True},
        )
        self.assertEqual(response.status_code, 403)
        self.player_member.refresh_from_db()
        self.assertFalse(self.player_member.can_share_screen)

    def test_host_can_grant_and_revoke_screen_share(self):
        path = f"/api/game/lobbies/{self.lobby.id}/members/{self.player.id}/screen-share/"

        self._post(self.host, path, {"allowed": True})
        self.player_member.refresh_from_db()
        self.assertTrue(self.player_member.can_share_screen)

        self._post(self.host, path, {"allowed": False})
        self.player_member.refresh_from_db()
        self.assertFalse(self.player_member.can_share_screen)

    def test_permissions_listing_requires_membership(self):
        outsider = User.objects.create_user(
            username="nope", email="nope@example.com", password="pw"
        )
        response = self._client(outsider).get(
            f"/api/game/lobbies/{self.lobby.id}/permissions/"
        )
        self.assertEqual(response.status_code, 403)

    def test_permissions_listing_marks_the_host(self):
        response = self._client(self.player).get(
            f"/api/game/lobbies/{self.lobby.id}/permissions/"
        )
        self.assertEqual(response.status_code, 200, response.content[:300])
        body = response.json()
        self.assertEqual(body["host_id"], self.host.id)
        host_row = next(m for m in body["members"] if m["user_id"] == self.host.id)
        self.assertTrue(host_row["is_host"])
        self.assertTrue(host_row["can_share_screen"])
