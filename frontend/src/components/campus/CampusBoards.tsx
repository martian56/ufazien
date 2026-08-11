import { useEffect, useState } from 'react'
import * as THREE from 'three'

import { boardTexture } from './campusTextures'
import {
  emptyBoard,
  noticeLines,
  scheduleLines,
  siteLines,
  todayKey,
  type BoardLine,
  type PostLike,
  type SiteLike,
} from './boardLines'
import { calendarApi, type CalendarEvent } from '../../services/calendarApi'
import { blogApi } from '../../lib/api/endpoints/blog'
import { api } from '../../lib/api/client'
import type { Vec3 } from './campusLayout'

/**
 * The boards that connect the campus to the rest of Ufazien.
 *
 * The simulator was an island: a platform with a real timetable, a blog and
 * grade calculators sat next door, and every board inside the campus was a
 * blank rectangle. The lecture hall now shows today's schedule and the student
 * centre the latest posts.
 *
 * Both fail quietly. A board that cannot reach the API shows a line saying so
 * rather than an error overlay — you are standing in a room looking at a wall,
 * and a failed fetch is not worth interrupting that for.
 */

/** Refetched on a slow timer: a timetable does not change minute to minute. */
const REFRESH_MS = 5 * 60 * 1000

function useBoardLines(
  load: () => Promise<BoardLine[]>,
  fallback: BoardLine[],
  deps: unknown[] = [],
): BoardLine[] {
  const [lines, setLines] = useState<BoardLine[]>(fallback)

  useEffect(() => {
    let live = true

    const run = () => {
      load()
        .then((next) => {
          if (live) setLines(next.length ? next : fallback)
        })
        .catch(() => {
          // Offline, unauthenticated, or the endpoint moved. The board says so
          // and the room carries on.
          if (live) setLines([{ primary: 'Board offline', secondary: 'Could not reach Ufazien' }])
        })
    }

    run()
    const timer = setInterval(run, REFRESH_MS)
    return () => {
      live = false
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return lines
}

/** A flat lit panel. Unlit, so a board in a dim room is still readable. */
function Board({
  title,
  lines,
  accent,
  position,
  rotation = 0,
  size = [6, 3],
}: {
  title: string
  lines: BoardLine[]
  accent?: string
  position: Vec3
  rotation?: number
  size?: [number, number]
}) {
  const texture = boardTexture(title, lines, accent)

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Frame, a little larger than the panel and sitting behind it */}
      <mesh position={[0, 0, -0.04]} castShadow>
        <boxGeometry args={[size[0] + 0.18, size[1] + 0.18, 0.1]} />
        <meshStandardMaterial color="#0f141a" roughness={0.8} />
      </mesh>
      <mesh>
        <planeGeometry args={size} />
        {texture ? (
          <meshBasicMaterial map={texture} toneMapped={false} side={THREE.FrontSide} />
        ) : (
          <meshStandardMaterial color="#1a212b" roughness={0.9} />
        )}
      </mesh>
    </group>
  )
}

/** Today's timetable, on the wall of the amphitheatre. */
export function ScheduleBoard({ position, rotation }: { position: Vec3; rotation?: number }) {
  const lines = useBoardLines(async () => {
    const day = todayKey()
    const events: CalendarEvent[] = await calendarApi.list({ start: day, end: day })
    return scheduleLines(events, day)
  }, emptyBoard('schedule'))

  return (
    <Board
      title="Today"
      lines={lines}
      accent="#8fd0ff"
      position={position}
      rotation={rotation}
      size={[7, 3.6]}
    />
  )
}

/** The latest blog posts, on the noticeboard in the student centre. */
export function NoticeBoard({ position, rotation }: { position: Vec3; rotation?: number }) {
  const lines = useBoardLines(async () => {
    const response = await blogApi.list({ ordering: '-created_at', page_size: 6 })
    // `api` returns parsed JSON, not an axios envelope. Paginated or bare,
    // both shapes reach here depending on the endpoint's settings.
    const posts: PostLike[] = Array.isArray(response)
      ? response
      : ((response as { results?: PostLike[] })?.results ?? [])
    return noticeLines(posts)
  }, emptyBoard('notices'))

  return (
    <Board
      title="Noticeboard"
      lines={lines}
      accent="#7fe0a8"
      position={position}
      rotation={rotation}
      size={[6.4, 3.4]}
    />
  )
}

/**
 * Student sites, on the screens in the student centre.
 *
 * Read from the public hosting listing, which is the same set of sites the
 * platform already publishes — showing them here is another window onto that
 * list, not a new disclosure. It carries a display name and never an address.
 */
export function SitesBoard({ position, rotation }: { position: Vec3; rotation?: number }) {
  const lines = useBoardLines(async () => {
    // `api` returns parsed JSON, not an axios envelope, and this endpoint is
    // paginated — so the rows are under `results` rather than at the top.
    const response = await api.get<unknown>('/hosting/public/websites/?page_size=6')
    const sites: SiteLike[] = Array.isArray(response)
      ? (response as SiteLike[])
      : ((response as { results?: SiteLike[] })?.results ?? [])
    return siteLines(sites)
  }, emptyBoard('sites'))

  return (
    <Board
      title="Built by students"
      lines={lines}
      accent="#f0b429"
      position={position}
      rotation={rotation}
      size={[6.4, 3.4]}
    />
  )
}

export default Board
