import { useState, useRef } from 'react'
import { RiUserLine, RiCameraLine, RiSaveLine, RiMailLine, RiPhoneLine, RiIdCardLine, RiUser3Line } from 'react-icons/ri'
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Breadcrumb } from '../../../components/ui/breadcrumb'
import { useAuth } from '../../../context/AuthContext'
import { toast } from 'sonner'
import authApi from '../../../api/auth-api'

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  
  const [form, setForm] = useState({
    user_name: user?.user_name || '',
    bio_data: user?.bio_data || '',
    email: user?.email || '',
    mobile_number: user?.mobile_number || '',
  })

  const handleAvatarClick = () => {
    if (isEditing) {
      fileInputRef.current?.click()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large (max 5MB)')
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    setSelectedFile(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!user?.id) return

    setIsSaving(true)
    try {
      const formData = new FormData()
      
      if (form.user_name !== user.user_name) formData.append('user_name', form.user_name)
      if (form.bio_data !== user.bio_data) formData.append('bio_data', form.bio_data || '')
      if (form.email !== user.email) formData.append('email', form.email || '')
      if (form.mobile_number !== user.mobile_number) formData.append('mobile_number', form.mobile_number || '')
      if (selectedFile) formData.append('avatar', selectedFile)

      const response = await authApi.patch(`/users/${user.id}/profile`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setUser(response.data)
      setIsEditing(false)
      setAvatarPreview(null)
      setSelectedFile(null)
      toast.success('Profile updated successfully')
    } catch (error: any) {
      console.error('Profile update failed:', error)
      toast.error(error.response?.data?.detail || 'Failed to update profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setForm({
      user_name: user?.user_name || '',
      bio_data: user?.bio_data || '',
      email: user?.email || '',
      mobile_number: user?.mobile_number || '',
    })
    setIsEditing(false)
    setAvatarPreview(null)
    setSelectedFile(null)
  }

  const avatarUrl = avatarPreview || user?.user_dp
  const initials = user?.user_name?.slice(0, 2).toUpperCase() || 'U'

  return (
    <div className="space-y-6 pb-10 select-none">
      <div>
        <Breadcrumb items={[{ label: 'Dashboard', href: '/' }, { label: 'Profile' }]} />
        <div className="flex items-center gap-3 mt-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
            <RiUserLine className="h-4 w-4 text-[var(--text-primary)]" />
          </div>
          <div>
            <h1 className="text-dashboard-title">My Profile</h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              Manage your personal information and preferences
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Avatar Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center">
              <div className="relative group">
                <button
                  type="button"
                  onClick={handleAvatarClick}
                  disabled={!isEditing}
                  className={`relative flex h-32 w-32 items-center justify-center rounded-full overflow-hidden border-4 border-white shadow-lg transition-all ${
                    isEditing ? 'cursor-pointer hover:opacity-90' : ''
                  }`}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={user?.user_name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-[var(--success-text)] to-[var(--success)] flex items-center justify-center text-white text-4xl font-bold">
                      {initials}
                    </div>
                  )}
                </button>
                {isEditing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <RiCameraLine className="h-8 w-8 text-white" />
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <h2 className="text-xl font-bold text-[var(--text-primary)] mt-4">{user?.user_name}</h2>
              <p className="text-[13px] mt-1 px-3 py-1 rounded-full bg-[var(--surface-2)] text-[var(--text-primary)] font-medium capitalize">
                {user?.role_id?.toLowerCase()}
              </p>

              <div className="w-full mt-6 space-y-2">
                <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  <RiIdCardLine className="h-4 w-4" />
                  <span>{user?.auth_id}</span>
                </div>
                {user?.employee_id && (
                  <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                    <RiUser3Line className="h-4 w-4" />
                    <span>Employee ID: {user.employee_id}</span>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="flex gap-2 w-full mt-6">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--surface-2)] transition-colors text-[13px] font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 px-4 py-2 rounded-lg bg-[var(--success-text)] text-white hover:bg-[var(--success)] transition-colors text-[13px] font-medium flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <RiSaveLine className="h-4 w-4" />
                        Save
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="w-full mt-6 px-4 py-2 rounded-lg border-2 border-[var(--success-text)] text-[var(--success-text)] hover:bg-[var(--surface-2)] transition-colors text-[13px] font-semibold"
                >
                  Edit Profile
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details Card */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b border-[var(--border)]">
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-5">
              {/* Full Name */}
              <div>
                <label className="block text-[13px] font-semibold text-[var(--brand-deep)] mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={form.user_name}
                  onChange={(e) => setForm({ ...form, user_name: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--success-text)] focus:border-transparent disabled:bg-[var(--surface-2)] disabled:text-[var(--brand-text)] transition-all"
                  placeholder="Enter your full name"
                />
              </div>

              {/* Bio */}
              <div>
                <label className="block text-[13px] font-semibold text-[var(--brand-deep)] mb-2">
                  Bio / About
                </label>
                <textarea
                  value={form.bio_data}
                  onChange={(e) => setForm({ ...form, bio_data: e.target.value })}
                  disabled={!isEditing}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--success-text)] focus:border-transparent disabled:bg-[var(--surface-2)] disabled:text-[var(--brand-text)] transition-all resize-none"
                  placeholder="Tell us about yourself"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-[13px] font-semibold text-[var(--brand-deep)] mb-2 flex items-center gap-2">
                  <RiMailLine className="h-4 w-4" />
                  Email Address
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--success-text)] focus:border-transparent disabled:bg-[var(--surface-2)] disabled:text-[var(--brand-text)] transition-all"
                  placeholder="your.email@example.com"
                />
              </div>

              {/* Mobile */}
              <div>
                <label className="block text-[13px] font-semibold text-[var(--brand-deep)] mb-2 flex items-center gap-2">
                  <RiPhoneLine className="h-4 w-4" />
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={form.mobile_number}
                  onChange={(e) => setForm({ ...form, mobile_number: e.target.value })}
                  disabled={!isEditing}
                  className="w-full px-4 py-2.5 rounded-lg border border-[var(--border)] bg-white text-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--success-text)] focus:border-transparent disabled:bg-[var(--surface-2)] disabled:text-[var(--brand-text)] transition-all"
                  placeholder="+94 XX XXX XXXX"
                />
              </div>
            </div>

            {isEditing && (
              <div className="mt-6 p-4 rounded-lg bg-[var(--surface-2)] border border-[var(--success-border)]">
                <p className="text-[12px] text-[var(--success-text)]">
                  <strong>Note:</strong> Changes will be saved to your account and reflected across all services.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
