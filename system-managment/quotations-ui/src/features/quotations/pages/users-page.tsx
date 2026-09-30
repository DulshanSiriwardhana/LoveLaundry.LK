import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    RiUserAddLine, RiCloseLine, RiEyeLine, RiEyeOffLine,
    RiRefreshLine, RiShieldCheckLine, RiEditLine
} from 'react-icons/ri'
import { toast } from 'sonner'
import authApi from '../../../api/auth-api'
import { EmptyState } from '../../../components/ui/empty-state'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { Card, CardContent } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { useEnterFlow } from '../../../hooks/use-enter-flow'
import { useEscape } from '../../../hooks/use-escape'

interface UserForm {
    user_name: string
    auth_id: string
    password: string
    email: string
    mobile_number: string
    employee_id: string
    role_id: string
    status: string
}

const ROLES = ['ADMIN', 'MANAGER', 'STAFF']
const STATUSES = ['active', 'inactive', 'unset']

const emptyForm: UserForm = {
    user_name: '',
    auth_id: '',
    password: '',
    email: '',
    mobile_number: '',
    employee_id: '',
    role_id: 'STAFF',
    status: 'active',
}

interface UserRecord {
    id: string
    user_name: string
    auth_id: string
    email?: string
    mobile_number?: string
    employee_id?: string
    role_id: string
    status: string
    created_at?: string
}

export default function UsersPage() {
    const [users, setUsers] = useState<UserRecord[]>([])
    const [loadingUsers, setLoadingUsers] = useState(true)
    const [showModal, setShowModal] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState<UserForm>(emptyForm)
    const [submitting, setSubmitting] = useState(false)
    const [showPw, setShowPw] = useState(false)
    const flow = useEnterFlow()

    useEscape(showModal, () => setShowModal(false))

    const fetchUsers = async () => {
        setLoadingUsers(true)
        try {
            const res = await authApi.get<UserRecord[]>('/users')
            setUsers(res.data)
        } catch (err: any) {
            toast.error(err.message || 'Failed to load users')
        } finally {
            setLoadingUsers(false)
        }
    }

    useEffect(() => {
        fetchUsers()
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.user_name || !form.auth_id) {
            toast.error('Full name and Username are required')
            return
        }
        if (!editId && !form.password) {
            toast.error('Password is required for new users')
            return
        }
        setSubmitting(true)
        try {
            const payload: any = {
                user_name: form.user_name,
                auth_id: form.auth_id,
                role_id: form.role_id,
                status: form.status,
            }
            if (form.email) payload.email = form.email
            if (form.mobile_number) payload.mobile_number = form.mobile_number
            if (form.employee_id) payload.employee_id = form.employee_id

            if (editId) {
                await authApi.put(`/users/${editId}`, payload)
                if (form.password) {
                    await authApi.patch(`/users/${editId}/password`, { password: form.password })
                }
                toast.success(`User "${form.user_name}" updated successfully`)
            } else {
                await authApi.post('/users', { ...payload, password: form.password })
                toast.success(`User "${form.user_name}" created successfully`)
            }
            setShowModal(false)
            setForm(emptyForm)
            setEditId(null)
            fetchUsers()
        } catch (err: any) {
            toast.error(err.message || `Failed to ${editId ? 'update' : 'create'} user`)
        } finally {
            setSubmitting(false)
        }
    }

    const openModal = () => {
        setForm(emptyForm)
        setEditId(null)
        setShowPw(false)
        setShowModal(true)
    }

    const openEdit = (u: UserRecord) => {
        setForm({
            user_name: u.user_name,
            auth_id: u.auth_id,
            password: '',
            email: u.email || '',
            mobile_number: u.mobile_number || '',
            employee_id: u.employee_id || '',
            role_id: (u.role_id || 'STAFF').toUpperCase(),
            status: (u.status || 'active').toLowerCase(),
        })
        setEditId(u.id)
        setShowPw(false)
        setShowModal(true)
    }

    const inputClass =
        'h-10 w-full rounded-xl border border-[#E4E7EC] bg-white px-3.5 text-[13px] text-[#101828] placeholder:text-[#98A2B3] outline-none focus:border-[#101828] focus:ring-1 focus:ring-[#101828] transition-all duration-150'

    const roleColor: Record<string, string> = {
        ADMIN: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
        MANAGER: 'bg-[#EDE9FE] text-[#5B21B6] border-[#DDD6FE]',
        STAFF: 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]',
    }

    const statusColor: Record<string, string> = {
        active: 'bg-[#F0FDF4] text-[#166534] border-[#BBF7D0]',
        inactive: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
        unset: 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]',
    }

    return (
        <div className="space-y-5 pb-10 select-none">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Users' }]} />
                    <h1 className="text-dashboard-title mt-1">User Management</h1>
                    <p className="text-[13px] text-[#98A2B3] mt-0.5">Create and manage system users</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="secondary"
                        onClick={fetchUsers}
                        disabled={loadingUsers}
                        className="flex items-center gap-1.5"
                    >
                        <RiRefreshLine size={15} className={loadingUsers ? 'animate-spin' : ''} />
                        Refresh
                    </Button>
                    <Button onClick={openModal} className="flex items-center gap-1.5">
                        <RiUserAddLine size={15} />
                        Create User
                    </Button>
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: 'Total Users', value: users.length, color: 'text-[#101828]' },
                    { label: 'Active', value: users.filter(u => u.status === 'active').length, color: 'text-[#16A34A]' },
                    { label: 'Admins', value: users.filter(u => u.role_id?.toUpperCase() === 'ADMIN').length, color: 'text-[#92400E]' },
                ].map(stat => (
                    <Card key={stat.label}>
                        <CardContent className="pt-4 pb-4 text-center">
                            <p className={`text-[24px] font-bold ${stat.color}`}>{loadingUsers ? '—' : stat.value}</p>
                            <p className="text-[12px] text-[#6B7280] mt-0.5">{stat.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* User list */}
            {loadingUsers ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-28 rounded-xl bg-[#F3F4F6] animate-pulse" />
                    ))}
                </div>
            ) : users.length === 0 ? (
                <EmptyState
                    kind="first-run"
                    title="No users found"
                    description="Create the first user to give someone access to this system."
                    action={
                        <Button onClick={openModal}>
                            <RiUserAddLine aria-hidden /> Create first user
                        </Button>
                    }
                />
            ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {users.map((u, idx) => (
                        <motion.div
                            key={u.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: Math.min(idx * 0.04, 0.3) }}
                        >
                            <Card className="hover:border-[#D1D5DB] transition-colors">
                                <CardContent className="pt-4 pb-4">
                                    <div className="flex items-start gap-3">
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#101828] to-[#374151] text-white font-bold text-[15px]">
                                            {u.user_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[14px] font-semibold text-[#101828] truncate">{u.user_name}</p>
                                            <p className="text-[12px] text-[#6B7280] truncate">{u.email || u.auth_id}</p>
                                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${roleColor[u.role_id?.toUpperCase()] || roleColor.STAFF}`}>
                                                    {u.role_id?.toUpperCase()}
                                                </span>
                                                <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold ${statusColor[u.status?.toLowerCase()] || statusColor.unset}`}>
                                                    {u.status}
                                                </span>
                                                {u.employee_id && (
                                                    <span className="inline-flex items-center rounded-md border border-[#E4E7EC] bg-[#F9FAFB] px-2 py-0.5 text-[10px] text-[#6B7280]">
                                                        #{u.employee_id}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => openEdit(u)}
                                            title="Edit user"
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#101828] transition-colors"
                                        >
                                            <RiEditLine size={15} />
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Create User Modal */}
            <AnimatePresence>
                {showModal && (
                    <>
                        <motion.div
                            key="backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
                            onClick={() => setShowModal(false)}
                        />
                        <motion.div
                            key="modal"
                            initial={{ opacity: 0, scale: 0.96, y: 12 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 12 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4"
                        >
                            <div className="w-full max-w-md rounded-2xl border border-[#E4E7EC] bg-white shadow-2xl overflow-hidden">
                                {/* Modal header */}
                                <div className="flex items-center justify-between px-6 py-4 border-b border-[#F2F4F7]">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#101828] text-white">
                                            <RiEditLine size={16} />
                                        </div>
                                        <div>
                                            <p className="text-[14px] font-bold text-[#101828]">{editId ? 'Edit User' : 'Create User'}</p>
                                            <p className="text-[11px] text-[#6B7280]">{editId ? 'Update this system user' : 'Add a new system user'}</p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowModal(false)}
                                        className="flex h-7 w-7 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#101828] transition-colors"
                                    >
                                        <RiCloseLine size={16} />
                                    </button>
                                </div>

                                {/* Form */}
                                <form onSubmit={handleSubmit} ref={flow.ref} onKeyDown={flow.handleKeyDown} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">
                                                Full Name <span className="text-[#DC2626]">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.user_name}
                                                onChange={e => setForm(f => ({ ...f, user_name: e.target.value }))}
                                                className={inputClass}
                                                placeholder="John Silva"
                                                required
                                                autoFocus
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">
                                                Username <span className="text-[#DC2626]">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={form.auth_id}
                                                onChange={e => setForm(f => ({ ...f, auth_id: e.target.value }))}
                                                className={inputClass}
                                                placeholder="john.silva"
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[12px] font-medium text-[#374151] mb-1.5">
                                            {editId ? 'New Password' : 'Password'} {!editId && <span className="text-[#DC2626]">*</span>}
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showPw ? 'text' : 'password'}
                                                value={form.password}
                                                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                                className={`${inputClass} pr-10`}
                                                placeholder={editId ? 'Leave blank to keep current' : 'Secure password'}
                                                required={!editId}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPw(v => !v)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3] hover:text-[#374151] transition-colors"
                                                tabIndex={-1}
                                            >
                                                {showPw ? <RiEyeOffLine size={16} /> : <RiEyeLine size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">Role</label>
                                            <select
                                                value={form.role_id}
                                                onChange={e => setForm(f => ({ ...f, role_id: e.target.value }))}
                                                className={inputClass}
                                            >
                                                {ROLES.map(r => (
                                                    <option key={r} value={r}>{r}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">Status</label>
                                            <select
                                                value={form.status}
                                                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                                                className={inputClass}
                                            >
                                                {STATUSES.map(s => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[12px] font-medium text-[#374151] mb-1.5">Email</label>
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                            className={inputClass}
                                            placeholder="john@lovelaundry.lk"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">Mobile</label>
                                            <input
                                                type="text"
                                                value={form.mobile_number}
                                                onChange={e => setForm(f => ({ ...f, mobile_number: e.target.value }))}
                                                className={inputClass}
                                                placeholder="+94 77 123 4567"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[12px] font-medium text-[#374151] mb-1.5">Employee ID</label>
                                            <input
                                                type="text"
                                                value={form.employee_id}
                                                onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                                                className={inputClass}
                                                placeholder="EMP-001"
                                            />
                                        </div>
                                    </div>

                                    {/* Admin notice */}
                                    <div className="flex items-start gap-2 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0] px-3 py-2.5">
                                        <RiShieldCheckLine size={14} className="text-[#16A34A] mt-0.5 shrink-0" />
                                        <p className="text-[11px] text-[#166534]">
                                            {editId
                                                ? 'Changes are saved immediately. Enter a new password only if you want to reset it.'
                                                : 'User will be created with the selected role. They can log in immediately using their username and password.'}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowModal(false)}
                                            className="flex-1 h-10 rounded-xl border border-[#E4E7EC] bg-white text-[13px] font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="flex-1 h-10 rounded-xl bg-[#101828] text-[13px] font-medium text-white hover:bg-[#1D2939] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            {submitting ? (
                                                <>
                                                    <RiRefreshLine size={14} className="animate-spin" />
                                                    {editId ? 'Saving…' : 'Creating…'}
                                                </>
                                            ) : (
                                                <>
                                                    <RiEditLine size={14} />
                                                    {editId ? 'Save Changes' : 'Create User'}
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
