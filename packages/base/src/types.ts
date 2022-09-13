export type NAry<N> = N | N[]

export type PermissionAssertion = {
  name: string
  roles: string[]
  account: NAry<{ address: string } | string>
}
