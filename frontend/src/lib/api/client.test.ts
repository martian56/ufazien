import { beforeEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, api, request } from './client'
import { ApiError } from './errors'
import { toList } from './types'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('API base URL', () => {
  it('always includes the /api prefix', () => {
    expect(API_BASE_URL.endsWith('/api')).toBe(true)
  })

  it('does not double the prefix', () => {
    expect(API_BASE_URL).not.toMatch(/\/api\/api$/)
  })
})

describe('request', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns the parsed body, not an envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([{ id: 1 }])))
    const result = await api.get<{ id: number }[]>('/community/groups/')
    expect(result).toEqual([{ id: 1 }])
  })

  it('sends the access token when there is one', async () => {
    localStorage.setItem('access', 'token-abc')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await api.get('/auth/user/me/')

    const headers = fetchMock.mock.calls[0][1].headers
    expect(headers.Authorization).toBe('Bearer token-abc')
  })

  it('omits the token for anonymous requests', async () => {
    localStorage.setItem('access', 'token-abc')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    await api.post('/auth/login/', { email: 'a@b.c' }, { anonymous: true })

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined()
  })

  it('builds a query string and drops empty values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    await api.get('/community/posts/', { params: { search: 'graphs', page: 2, forum: null } })

    const url = String(fetchMock.mock.calls[0][0])
    expect(url).toContain('search=graphs')
    expect(url).toContain('page=2')
    expect(url).not.toContain('forum')
  })

  it('leaves FormData alone so the browser sets the boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}))
    vi.stubGlobal('fetch', fetchMock)

    const form = new FormData()
    form.append('file', new Blob(['x']), 'x.txt')
    await api.post('/hosting/upload/', form)

    const init = fetchMock.mock.calls[0][1]
    expect(init.headers['Content-Type']).toBeUndefined()
    expect(init.body).toBe(form)
  })

  it('throws ApiError carrying the status and body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Not found.' }, 404)))

    await expect(api.get('/community/posts/nope/')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
    })
  })

  it('reports a network failure as status 0 rather than hanging', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const error = await api.get('/anything/').catch((e: unknown) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).isNetworkError).toBe(true)
  })

  it('returns null for 204 instead of throwing on an empty body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })))
    await expect(api.delete('/community/posts/1/')).resolves.toBeNull()
  })

  it('surfaces HTML as a body rather than a JSON parse crash', async () => {
    // A relative URL that reaches the SPA returns index.html. Doing this by
    // hand threw "Unexpected token '<'" and shipped twice.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<!doctype html><html></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        }),
      ),
    )
    await expect(request('/auth/user/me/')).resolves.toContain('<!doctype html>')
  })
})

describe('token refresh', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('refreshes once on 401 and retries the request', async () => {
    localStorage.setItem('access', 'stale')
    localStorage.setItem('refresh', 'refresh-token')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ access: 'fresh' }))
      .mockResolvedValueOnce(jsonResponse({ id: 7 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/auth/user/me/')).resolves.toEqual({ id: 7 })
    expect(localStorage.getItem('access')).toBe('fresh')
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/auth/token/refresh/')
  })

  it('refreshes only once for concurrent 401s', async () => {
    localStorage.setItem('access', 'stale')
    localStorage.setItem('refresh', 'refresh-token')

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (String(url).includes('token/refresh')) return Promise.resolve(jsonResponse({ access: 'fresh' }))
      const auth = fetchMock.mock.calls.at(-1)?.[1]?.headers?.Authorization
      if (auth === 'Bearer stale') return Promise.resolve(jsonResponse({ detail: 'expired' }, 401))
      return Promise.resolve(jsonResponse({ ok: true }))
    })
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all([api.get('/a/'), api.get('/b/'), api.get('/c/')])

    const refreshCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('token/refresh'))
    expect(refreshCalls).toHaveLength(1)
  })

  it('clears tokens when the refresh itself fails', async () => {
    localStorage.setItem('access', 'stale')
    localStorage.setItem('refresh', 'bad')

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ detail: 'expired' }, 401))
        .mockResolvedValueOnce(jsonResponse({ detail: 'invalid' }, 401)),
    )

    await expect(api.get('/auth/user/me/')).rejects.toBeInstanceOf(ApiError)
    expect(localStorage.getItem('access')).toBeNull()
    expect(localStorage.getItem('refresh')).toBeNull()
  })
})

describe('ApiError.userMessage', () => {
  it('prefers detail', () => {
    expect(new ApiError('x', 400, '/u', { detail: 'Nope.' }).userMessage).toBe('Nope.')
  })

  it('falls back to the first field error', () => {
    expect(new ApiError('x', 400, '/u', { email: ['This field is required.'] }).userMessage).toBe(
      'This field is required.',
    )
  })

  it('explains a network failure', () => {
    expect(new ApiError('x', 0, '/u', null).userMessage).toMatch(/could not reach/i)
  })
})

describe('toList', () => {
  it('accepts a bare array', () => {
    expect(toList([1, 2])).toEqual([1, 2])
  })

  it('accepts a paginated envelope', () => {
    expect(toList({ count: 2, next: null, previous: null, results: [1, 2] })).toEqual([1, 2])
  })

  it('treats null as empty', () => {
    expect(toList(null)).toEqual([])
  })
})
