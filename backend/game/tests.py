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
