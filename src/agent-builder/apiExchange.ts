/** A Send API Request step's request and the reply it got; secret header values are already masked. */
export type ApiExchange = {
  method: string
  /** The address called, without any password in it; through a saved connection, the request's path. */
  url: string
  /** The saved connection the request went through. */
  via?: string
  headers: readonly { name: string; value: string }[]
  body: string
  status: number
  /** The reply's body as the API sent it. */
  reply: string
  /** False when the builder answered with a pretend reply instead of calling the API. */
  sent: boolean
}

const STATUS_TEXT: Readonly<Record<number, string>> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  422: 'Unprocessable Content',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

/** "404 Not Found", or just the number for a code without a standard name. */
export const statusLine = (status: number) => (STATUS_TEXT[status] ? `${status} ${STATUS_TEXT[status]}` : String(status))

/** Redirects count as answered, like the worker, which follows them. */
export const answered = (status: number) => status >= 200 && status < 400

/** Header names whose values are credentials, shown masked once saved and in every run record. */
const SECRET_HEADER = /authorization|api[-_]?key|token|secret|password|cookie|credential/i
export const isSecretHeader = (name: string) => SECRET_HEADER.test(name)
export const SECRET_MASK = '••••••••'

/** Where the request went: the saved connection, or the URL's host. */
export function destinationOf(api: ApiExchange) {
  if (api.via) return api.via
  try {
    return new URL(api.url).host
  } catch {
    return api.url
  }
}

/** A URL with its `user:password@` part dropped. */
export const withoutPassword = (url: string) => url.replace(/^([a-z][a-z\d+.-]*:\/\/)[^/@]*@/i, '$1')
