import authApi from '../../../api/auth-api'
import type { User } from '../../../types/auth'

interface LoginPayload {
    username: string
    password: string
}

interface LoginResponse {
    access_token: string
    token_type: string
    user: User
}

export const authService = {
    login: (payload: LoginPayload): Promise<LoginResponse> =>
        authApi.post<LoginResponse>('/auth/login', payload).then((r: any) => r.data),

    getStatus: (): Promise<User> =>
        authApi.get<User>('/auth/status').then((r: any) => r.data),
}
