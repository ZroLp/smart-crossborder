'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface UserProfile {
  nickname: string
  email: string
  phone: string
  avatar: string
  bio: string
  joinDate: string
  role: 'admin' | 'operator' | 'viewer'
}

interface LoginRecord {
  id: string
  device: string
  location: string
  time: string
  ip: string
  status: 'success' | 'failed'
}

const MOCK_PROFILE: UserProfile = {
  nickname: '张三',
  email: 'zhangsan@example.com',
  phone: '138****1234',
  avatar: '👤',
  bio: '跨境电商运营专员',
  joinDate: '2025-01-15',
  role: 'admin',
}

const MOCK_LOGIN_RECORDS: LoginRecord[] = [
  { id: 'LR-001', device: 'Chrome / Windows', location: '北京市', time: '2025-05-23 14:30', ip: '192.168.1.*', status: 'success' },
  { id: 'LR-002', device: 'Safari / iPhone', location: '上海市', time: '2025-05-22 09:15', ip: '172.16.0.*', status: 'success' },
  { id: 'LR-003', device: 'Firefox / macOS', location: '广州市', time: '2025-05-20 18:45', ip: '10.0.0.*', status: 'failed' },
]

function InfoItem({ label, value, editIcon = false, onEdit }: { label: string; value: string; editIcon?: boolean; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-[#2A2D35] last:border-b-0">
      <div>
        <span className="text-xs text-[#4E5969] dark:text-[#A0A4AC] block mb-1">{label}</span>
        <span className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">{value}</span>
      </div>
      {editIcon && onEdit && (
        <button onClick={onEdit} className="text-primary text-xs hover:underline">编辑</button>
      )}
    </div>
  )
}

function Modal({ isOpen, onClose, title, children, onConfirm }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; onConfirm?: () => void }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-xl w-full max-w-md p-6 m-4" onClick={e => e.stopPropagation()}>
        <h3 className="text-base font-semibold text-[#1D2129] dark:text-[#E8EAED] mb-4">{title}</h3>
        {children}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="bg-gray-100 dark:bg-[#2A2D35] text-[#1D2129] dark:text-[#E8EAED] px-4 py-2 rounded-lg text-sm hover:opacity-90">取消</button>
          {onConfirm && <button onClick={onConfirm} className="bg-primary text-white px-4 py-2 rounded-lg text-sm hover:opacity-90">确认</button>}
        </div>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile>(MOCK_PROFILE)
  const [loginRecords] = useState<LoginRecord[]>(MOCK_LOGIN_RECORDS)
  const [editingField, setEditingField] = useState<'nickname' | 'email' | 'phone' | 'bio' | null>(null)
  const [editValue, setEditValue] = useState('')
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' })

  const handleEdit = (field: 'nickname' | 'email' | 'phone' | 'bio') => {
    setEditingField(field)
    setEditValue(profile[field])
  }

  const handleSaveEdit = () => {
    if (!editingField || !editValue.trim()) return
    setProfile(prev => ({ ...prev, [editingField]: editValue }))
    setEditingField(null)
    setEditValue('')
  }

  const handleChangePassword = () => {
    if (!passwordForm.current || !passwordForm.new || !passwordForm.confirm) return
    if (passwordForm.new !== passwordForm.confirm) {
      alert('两次输入的新密码不一致')
      return
    }
    setShowPasswordModal(false)
    setPasswordForm({ current: '', new: '', confirm: '' })
    alert('密码修改成功')
  }

  const roleMap = { admin: '管理员', operator: '运营人员', viewer: '查看者' }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">个人中心</h2>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-4xl">
            {profile.avatar}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-[#1D2129] dark:text-[#E8EAED]">{profile.nickname}</h3>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC] mt-1">{profile.bio}</p>
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">
              {roleMap[profile.role]}
            </span>
          </div>
          <button
            onClick={() => handleEdit('bio')}
            className="bg-gray-100 dark:bg-[#2A2D35] text-[#1D2129] dark:text-[#E8EAED] px-4 py-2 rounded-lg text-sm hover:opacity-90"
          >
            编辑资料
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
          <div>
            <InfoItem label="昵称" value={profile.nickname} onEdit={() => handleEdit('nickname')} editIcon />
            <InfoItem label="邮箱" value={profile.email} onEdit={() => handleEdit('email')} editIcon />
            <InfoItem label="手机" value={profile.phone} onEdit={() => handleEdit('phone')} editIcon />
          </div>
          <div>
            <InfoItem label="角色" value={roleMap[profile.role]} />
            <InfoItem label="加入日期" value={profile.joinDate} />
            <InfoItem label="简介" value={profile.bio || '未填写'} onEdit={() => handleEdit('bio')} editIcon />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">🔐 账号安全</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">登录密码</p>
                <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC] mt-1">定期修改密码可提升账号安全性</p>
              </div>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="bg-primary text-white text-xs px-3 py-1.5 rounded-lg hover:opacity-90"
              >
                修改密码
              </button>
            </div>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
            <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">登录设备管理</p>
            <p className="text-xs text-[#4E5969] dark:text-[#A0A4AC] mt-1">当前已登录设备数: 2</p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-[#22252D] rounded-lg">
            <p className="text-sm font-medium text-[#1D2129] dark:text-[#E8EAED]">安全等级</p>
            <p className="text-xs text-success mt-1">中 - 建议开启双因素认证</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#181A20] rounded-xl shadow-sm p-6">
        <h3 className="font-medium text-[#1D2129] dark:text-[#E8EAED] mb-4">📝 登录历史</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#4E5969] dark:text-[#A0A4AC] border-b border-gray-100 dark:border-[#2A2D35]">
                <th className="py-3 pr-4 font-normal">设备</th>
                <th className="py-3 pr-4 font-normal">位置</th>
                <th className="py-3 pr-4 font-normal">IP地址</th>
                <th className="py-3 pr-4 font-normal">登录时间</th>
                <th className="py-3 font-normal">状态</th>
              </tr>
            </thead>
            <tbody>
              {loginRecords.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 dark:border-[#2A2D35] last:border-b-0">
                  <td className="py-3 pr-4 text-[#1D2129] dark:text-[#E8EAED]">{r.device}</td>
                  <td className="py-3 pr-4 text-[#4E5969] dark:text-[#A0A4AC]">{r.location}</td>
                  <td className="py-3 pr-4 text-[#4E5969] dark:text-[#A0A4AC] font-mono">{r.ip}</td>
                  <td className="py-3 pr-4 text-[#4E5969] dark:text-[#A0A4AC]">{r.time}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === 'success' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'
                    }`}>
                      {r.status === 'success' ? '成功' : '失败'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={editingField !== null}
        onClose={() => setEditingField(null)}
        title={`编辑${
          editingField === 'nickname' ? '昵称' :
          editingField === 'email' ? '邮箱' :
          editingField === 'phone' ? '手机' :
          editingField === 'bio' ? '简介' : ''
        }`}
        onConfirm={handleSaveEdit}
      >
        {editingField === 'bio' ? (
          <textarea
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="w-full border border-gray-200 dark:border-[#2A2D35] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
            rows={3}
          />
        ) : (
          <input
            type={editingField === 'email' ? 'email' : 'text'}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            className="w-full border border-gray-200 dark:border-[#2A2D35] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
          />
        )}
      </Modal>

      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="修改密码"
        onConfirm={handleChangePassword}
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC] block mb-1">当前密码</label>
            <input
              type="password"
              value={passwordForm.current}
              onChange={e => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
              className="w-full border border-gray-200 dark:border-[#2A2D35] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
            />
          </div>
          <div>
            <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC] block mb-1">新密码</label>
            <input
              type="password"
              value={passwordForm.new}
              onChange={e => setPasswordForm(prev => ({ ...prev, new: e.target.value }))}
              className="w-full border border-gray-200 dark:border-[#2A2D35] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
            />
          </div>
          <div>
            <label className="text-xs text-[#4E5969] dark:text-[#A0A4AC] block mb-1">确认新密码</label>
            <input
              type="password"
              value={passwordForm.confirm}
              onChange={e => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
              className="w-full border border-gray-200 dark:border-[#2A2D35] rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary dark:bg-[#181A20] dark:text-[#E8EAED]"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}