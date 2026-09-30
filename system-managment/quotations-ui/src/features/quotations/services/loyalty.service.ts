import billsApi from '../../../api/bills-api'
import type { LoyaltyAccount, LoyaltyAdjust } from '../../../types/operations'

export const loyalty = {
    list: (client_name?: string) =>
        billsApi
            .get<LoyaltyAccount[]>('/loyalty', { params: { client_name } })
            .then((r: any) => r.data),
    get: (client_name: string) =>
        billsApi.get<LoyaltyAccount>(`/loyalty/${client_name}`).then((r: any) => r.data),
    adjust: (data: LoyaltyAdjust) =>
        billsApi.post<LoyaltyAccount>('/loyalty/adjust', data).then((r: any) => r.data),
}
