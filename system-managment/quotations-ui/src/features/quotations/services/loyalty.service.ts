import billsApi from '../../../api/bills-api'
import type { LoyaltyAccount, LoyaltyAdjust } from '../../../types/operations'

export const loyalty = {
    list: (client_name?: string) =>
        billsApi
            .get<LoyaltyAccount[]>('/loyalty', { params: { client_name } })
            .then((r: any) => r.data),
    // A client name is user input and may contain '/', '?' or '#'. Unencoded,
    // those terminate the path segment and the lookup 404s against the wrong
    // resource. Every other service in the app encodes its path segments.
    get: (client_name: string) =>
        billsApi
            .get<LoyaltyAccount>(`/loyalty/${encodeURIComponent(client_name)}`)
            .then((r: any) => r.data),
    adjust: (data: LoyaltyAdjust) =>
        billsApi.post<LoyaltyAccount>('/loyalty/adjust', data).then((r: any) => r.data),
}
