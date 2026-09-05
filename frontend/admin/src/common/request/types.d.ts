export interface ResponseType<RESPONSE_DATA> {
  code: 'ERROR' | 'SUCCESS' | 'VALIDATION' | 'WARNING'
  data: RESPONSE_DATA
  status: 'error' | 'success'
}

export interface RequestType<PAYLOAD> {
  data?: PAYLOAD
  headers?: Record<string, string>
  method: string
  uri: string
}

export type QueryParam = Record<string, number | string>
