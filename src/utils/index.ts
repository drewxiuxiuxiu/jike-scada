import get from 'lodash.get'

export * from './logging'
export * from './typeGuards'

export function identity(self) { return self }

export function isUndefinedOrEmpty(arr: any[] | undefined | null) {
  return arr === null || arr === undefined || arr.length === 0
}

export function pluck(data: any, projectorOrPath?: ((i: any) => any) | string | undefined) {

  if (typeof projectorOrPath === 'function') {
    return projectorOrPath(data)
  }

  if (typeof projectorOrPath === 'string') {
    return get(data, projectorOrPath)
  }

  return data
}
