'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

interface Shop {
  id: number
  user_id: number
  shop_name: string
  domain: string
  access_token: string
  scope: string
  status: string
  created_at: string
  updated_at: string
}

type AuthStatus = 'idle' | 'loading' | 'success' | 'failed'
type AuthMode = 'login' | 'register'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasProcessedCallback = useRef(false)

  const [mode, setMode] = useState<AuthMode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState<number | null>(null)
  const [shops, setShops] = useState<Shop[]>([])
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle')
  const [authError, setAuthError] = useState('')
  const [loginError, setLoginError] = useState('')
  const [registerError, setRegisterError] = useState('')
  const [loading, setLoading] = useState(false)

  const fetchShops = useCallback(async (uid: number) => {
    try {
      const res = await fetch(`/api/shop?userId=${uid}`)
      const data = await res.json()
      if (data.success) {
        setShops(data.data)
      }
    } catch {
      // Network error, shops will remain empty
    }
  }, [])

  useEffect(() => {
    if (hasProcessedCallback.current) return

    const callbackError = searchParams.get('error')
    const callbackShop = searchParams.get('shop')
    const callbackState = searchParams.get('state')
    const callbackCode = searchParams.get('code')

    if (callbackError) {
      hasProcessedCallback.current = true
      setAuthStatus('failed')
      setAuthError('Shopify 授权失败')
    } else if (callbackShop && callbackState) {
      hasProcessedCallback.current = true
      setAuthStatus('loading')
      fetch(`/api/auth/shopify/callback?shop=${encodeURIComponent(callbackShop)}&state=${encodeURIComponent(callbackState)}&code=${encodeURIComponent(callbackCode || '')}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success) {
            setAuthStatus('success')
          } else {
            setAuthStatus('failed')
            setAuthError(data.error || '授权失败')
          }
        })
        .catch(() => {
          setAuthStatus('failed')
          setAuthError('回调请求失败，请重试')
        })
    }
  }, [searchParams])

  useEffect(() => {
    if (userId) {
      fetchShops(userId)
    }
  }, [userId, fetchShops])

  const sanitizeInput = (input: string): string => {
    return input.replace(/[<>&"'/]/g, (char) => {
      const escapeMap: Record<string, string> = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
      }
      return escapeMap[char] || char
    })
  }

  const handleLogin = async () => {
    setLoginError('')
    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) {
      setLoginError('请输入用户名和密码')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', username: trimmedUsername, password }),
      })
      const data = await res.json()
      if (data.success) {
        setUserId(data.userId)
        sessionStorage.setItem('userId', String(data.userId))
        if (data.role) {
          sessionStorage.setItem('userRole', data.role)
        }
        fetchShops(data.userId)
      } else {
        setLoginError(data.error || '登录失败')
      }
    } catch {
      setLoginError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    setRegisterError('')
    const trimmedUsername = username.trim()
    if (!trimmedUsername || !password) {
      setRegisterError('请输入用户名和密码')
      return
    }
    if (password !== confirmPassword) {
      setRegisterError('两次输入的密码不一致')
      return
    }
    if (password.length < 6) {
      setRegisterError('密码长度不能少于6位')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          username: trimmedUsername,
          password,
          email: email.trim() || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setUserId(data.userId)
        sessionStorage.setItem('userId', String(data.userId))
        if (data.role) {
          sessionStorage.setItem('userRole', data.role)
        }
        fetchShops(data.userId)
      } else {
        if (data.error && data.error.toLowerCase().includes('already')) {
          setRegisterError('用户名已存在，请更换')
        } else {
          setRegisterError(data.error || '注册失败')
        }
      }
    } catch {
      setRegisterError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  const handleModeSwitch = (newMode: AuthMode) => {
    setMode(newMode)
    setLoginError('')
    setRegisterError('')
    setPassword('')
    setConfirmPassword('')
    setEmail('')
    setUsername('')
  }

  const handleShopifyAuth = async () => {
    if (!userId) return
    setAuthStatus('loading')
    setAuthError('')
    try {
      const res = await fetch(`/api/auth/shopify?userId=${userId}`)
      const data = await res.json()
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        setAuthStatus('failed')
        setAuthError(data.error || '获取授权链接失败')
      }
    } catch {
      setAuthStatus('failed')
      setAuthError('网络错误，请重试')
    }
  }

  const handleUnbind = async (shopId: number) => {
    try {
      const res = await fetch(`/api/shop?shopId=${shopId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success && userId) {
        fetchShops(userId)
      }
    } catch {
      // Network error, ignore
    }
  }

  const handleRetryAuth = () => {
    setAuthStatus('idle')
    setAuthError('')
  }

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' && !loading) {
      action()
    }
  }

  if (userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-purple">
        <div className="bg-white dark:bg-[#181A20] rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Image src="/logo.svg" alt="跨境智卖" width={48} height={48} priority />
              <h1 className="text-3xl font-bold text-primary">跨境智卖</h1>
            </div>
            <p className="text-sm text-[#4E5969] dark:text-[#A0A4AC]">店铺管理</p>
          </div>

          {shops.length === 0 && authStatus !== 'success' && (
            <div className="space-y-4">
              {authStatus === 'idle' && (
                <>
                  <div className="border border-primary/30 rounded-xl p-6 bg-gradient-to-br from-primary/5 to-purple/5">
                    <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-primary/10 rounded-full">
                      <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.337 3.415c-.073-.453-.482-.47-.817-.47H8.471c-.336 0-.744.017-.818.47L6.1 19.585c-.055.334.073.64.363.826.29.185.64.166.913-.055l2.654-2.16h3.936l2.654 2.16c.133.108.294.166.456.166.153 0 .307-.045.457-.111.29-.185.418-.492.363-.826L15.337 3.415zM12 14.5l-1.5-4-1.5 4h3zm-4.5 2l2.16-9.6h4.68l2.16 9.6H7.5z"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-center text-[#1D2129] dark:text-[#E8EAED] mb-2">绑定你的 Shopify 店铺</h3>
                    <p className="text-sm text-center text-[#86909C] dark:text-[#6B7080] mb-4">授权连接您的 Shopify 店铺，开启智能管理</p>
                    <button
                      onClick={handleShopifyAuth}
                      className="w-full bg-primary text-white py-3 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                        <polyline points="15 3 21 3 21 9"/>
                        <line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      前往授权
                    </button>
                    <button
                      onClick={() => {
                        if (userId) {
                          sessionStorage.setItem('userId', String(userId))
                          router.push('/dashboard')
                        }
                      }}
                      className="w-full mt-2 text-sm text-[#86909C] hover:text-[#4E5969] transition-colors py-2"
                    >
                      跳过，稍后绑定
                    </button>
                  </div>
                </>
              )}

              {authStatus === 'loading' && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-sm text-primary">正在处理授权...</p>
                </div>
              )}

              {authStatus === 'failed' && (
                <>
                  <div className="bg-danger/5 border border-danger/20 rounded-lg p-4">
                    <p className="text-sm text-danger font-medium">授权失败</p>
                    <p className="text-xs text-[#86909C] mt-1">{authError}</p>
                  </div>
                  <button
                    onClick={handleRetryAuth}
                    className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    重试授权
                  </button>
                </>
              )}
            </div>
          )}

          {shops.length > 0 && (
            <div className="space-y-4">
              <div className="bg-success/5 border border-success/20 rounded-lg p-4 text-center">
                <p className="text-sm text-success font-medium">已绑定 {shops.length} 个店铺</p>
              </div>

              <div className="space-y-2">
                {shops.map((shop) => (
                  <div key={shop.id} className="flex items-center justify-between bg-[#F5F7FA] rounded-lg px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-[#1D2129]">{sanitizeInput(shop.shop_name)}</p>
                      <p className="text-xs text-[#86909C]">{sanitizeInput(shop.domain)}</p>
                    </div>
                    <button
                      onClick={() => handleUnbind(shop.id)}
                      className="text-xs text-danger hover:text-danger/80 transition-colors"
                    >
                      解绑
                    </button>
                  </div>
                ))}
              </div>

              {shops.length > 0 && authStatus !== 'loading' && (
                <>
                  <button
                    onClick={handleShopifyAuth}
                    className="w-full bg-[#F5F7FA] text-[#4E5969] py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
                  >
                    绑定新店铺
                  </button>
                  <button
                    onClick={() => {
                      if (userId) {
                        sessionStorage.setItem('userId', String(userId))
                        router.push('/dashboard')
                      }
                    }}
                    className="w-full bg-success text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    跳转到控制台
                  </button>
                </>
              )}

              {authStatus === 'loading' && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
                  <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-sm text-primary">正在处理授权...</p>
                </div>
              )}

              {authStatus === 'failed' && (
                <div className="bg-danger/5 border border-danger/20 rounded-lg p-4">
                  <p className="text-sm text-danger font-medium">授权失败</p>
                  <p className="text-xs text-[#86909C] mt-1">{authError}</p>
                  <button
                    onClick={handleRetryAuth}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    重试授权
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => { setUserId(null); setShops([]); setAuthStatus('idle'); setAuthError('') }}
            className="mt-6 w-full text-sm text-[#86909C] hover:text-[#4E5969] transition-colors"
          >
            切换账号
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-purple">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Image src="/logo.svg" alt="跨境智卖" width={40} height={40} priority />
            <h1 className="text-2xl font-bold text-primary">跨境智卖</h1>
          </div>
          <p className="text-sm text-[#4E5969]">AI驱动的跨境电商全链路平台</p>
        </div>

        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => handleModeSwitch('login')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors relative ${
              mode === 'login'
                ? 'text-primary'
                : 'text-[#86909C] hover:text-[#4E5969]'
            }`}
          >
            登录
            {mode === 'login' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
          <button
            onClick={() => handleModeSwitch('register')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors relative ${
              mode === 'register'
                ? 'text-primary'
                : 'text-[#86909C] hover:text-[#4E5969]'
            }`}
          >
            注册
            {mode === 'register' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {mode === 'login' ? (
          <>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-[#4E5969]">用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                  placeholder="请输入用户名"
                  className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-[#4E5969]">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleLogin)}
                  placeholder="请输入密码"
                  className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {loginError && (
              <div className="mt-4 bg-danger/5 border border-danger/20 rounded-lg p-3">
                <p className="text-xs text-danger">{loginError}</p>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '登录中...' : '登录'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm text-[#4E5969]">用户名</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-[#4E5969]">密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-[#4E5969]">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onKeyDown={(e) => handleKeyDown(e, handleRegister)}
                  placeholder="请再次输入密码"
                  className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-sm text-[#4E5969]">邮箱（可选）</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="请输入邮箱"
                  className="border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {registerError && (
              <div className="mt-4 bg-danger/5 border border-danger/20 rounded-lg p-3">
                <p className="text-xs text-danger">{registerError}</p>
              </div>
            )}

            <div className="mt-6 space-y-3">
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full bg-primary text-white py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '注册中...' : '注册'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-purple">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Image src="/logo.svg" alt="跨境智卖" width={40} height={40} />
              <h1 className="text-2xl font-bold text-primary">跨境智卖</h1>
            </div>
            <p className="text-sm text-[#4E5969]">加载中...</p>
          </div>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
