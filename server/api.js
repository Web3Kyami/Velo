import { createCallsApi } from './calls-api.js'
import { createProfileApi } from './profile-api.js'

export function createVeloApi() {
  const profileApi = createProfileApi()
  const callsApi = createCallsApi()
  return (request, response, next) => profileApi(request, response, () => callsApi(request, response, next))
}
