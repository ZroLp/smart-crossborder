'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const shopList = [
  { name: 'Shopee', icon: '🛒', connected: true },
  { name: 'Amazon', icon: '📦', connected: true },
  { name: 'TikTok Shop', icon: '🎵', connected: false },
]

export default function MobileLoginPage() {
  const [phone, setPhone] = useState('')
  const [smsCode, setSmsCode] = useState('')
  const [camera, setCamera] = useState(false)
  const [notification, setNotification] = useState(false)
  const [location, setLocation] = useState(false)
  const [codeCountdown, setCodeCountdown] = useState(0)

  return (
    <div className="min-h-screen bg-white dark:bg-[#181A20]">
      <div className="px-6 pt-16 pb-12">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Image src="/logo.svg" alt="跨境智卖" width={36} height={36} priority />
            <h1 className="text-2xl font-bold text-primary">跨境智卖</h1>
          </div>
          <p className="text-sm text-gray-400 dark:text-[#6B7080]">AI驱动的跨境电商全链路平台</p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-center border border-gray-100 dark:border-[#2A2D35] rounded-xl px-4 h-14">
            <span className="text-gray-400 dark:text-[#6B7080] mr-3 text-sm">+86</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入手机号"
              className="flex-1 text-sm text-gray-600 outline-none bg-transparent"
            />
          </div>
          <div className="flex items-center border border-gray-100 dark:border-[#2A2D35] rounded-xl px-4 h-14">
            <input
              type="text"
              value={smsCode}
              onChange={(e) => setSmsCode(e.target.value)}
              placeholder="请输入验证码"
              className="flex-1 text-sm text-gray-600 outline-none bg-transparent"
            />
            <button
                  onClick={() => {
                    if (codeCountdown > 0) return;
                    setCodeCountdown(60);
                    const timer = setInterval(() => {
                      setCodeCountdown(prev => {
                        if (prev <= 1) { clearInterval(timer); return 0; }
                        return prev - 1;
                      });
                    }, 1000);
                  }}
              className="text-primary text-sm font-medium whitespace-nowrap"
            >
              {codeCountdown > 0 ? `${codeCountdown}s 后重试` : '获取验证码'}
            </button>
          </div>
        </div>

        <Link href="/mobile">
          <button className="w-full bg-primary text-white h-12 rounded-xl text-sm font-semibold mb-4">
            登录 / 注册
          </button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gray-100 dark:bg-[#22252D]"></div>
            <span className="text-xs text-gray-300">店铺授权</span>
            <div className="h-px flex-1 bg-gray-100 dark:bg-[#22252D]"></div>
          </div>
          <div className="space-y-3">
            {shopList.map((shop) => (
              <div key={shop.name} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#22252D] rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{shop.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{shop.name}</p>
                    <p className="text-xs text-gray-300">
                      {shop.connected ? '已授权' : '未授权'}
                    </p>
                  </div>
                </div>
                {shop.connected ? (
                  <span className="text-xs bg-success/10 text-success px-3 py-1 rounded-full">
                    已绑定
                  </span>
                ) : (
                  <button
                    disabled
                    className="text-xs bg-gray-100 dark:bg-[#2A2D35] text-gray-400 dark:text-[#6B7080] px-3 py-1 rounded-full font-medium cursor-not-allowed"
                  >
                    请先登录
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="h-px flex-1 bg-gray-100 dark:bg-[#22252D]"></div>
            <span className="text-xs text-gray-300">设备权限</span>
            <div className="h-px flex-1 bg-gray-100 dark:bg-[#22252D]"></div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#22252D] rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-xl">📷</span>
                <span className="text-sm text-gray-600">相机权限</span>
              </div>
              <button
                onClick={() => setCamera(!camera)}
                className={`w-12 h-7 rounded-full transition-colors ${
                  camera ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white dark:bg-[#181A20] rounded-full shadow-sm transform transition-transform ${
                    camera ? 'translate-x-6' : 'translate-x-1'
                  }`}
                ></div>
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#22252D] rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔔</span>
                <span className="text-sm text-gray-600">通知权限</span>
              </div>
              <button
                onClick={() => setNotification(!notification)}
                className={`w-12 h-7 rounded-full transition-colors ${
                  notification ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white dark:bg-[#181A20] rounded-full shadow-sm transform transition-transform ${
                    notification ? 'translate-x-6' : 'translate-x-1'
                  }`}
                ></div>
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-[#22252D] rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-xl">📍</span>
                <span className="text-sm text-gray-600">定位权限</span>
              </div>
              <button
                onClick={() => setLocation(!location)}
                className={`w-12 h-7 rounded-full transition-colors ${
                  location ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white dark:bg-[#181A20] rounded-full shadow-sm transform transition-transform ${
                    location ? 'translate-x-6' : 'translate-x-1'
                  }`}
                ></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
