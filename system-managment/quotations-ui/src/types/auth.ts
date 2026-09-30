export interface User {
    id: string
    user_name: string
    auth_id: string
    role_id: string
    status: string
    email?: string
    mobile_number?: string
    bio_data?: string
    user_dp?: string
    employee_id?: string
    permissions?: string | null
}

export interface AuthState {
    token: string | null
    user: User | null
}
