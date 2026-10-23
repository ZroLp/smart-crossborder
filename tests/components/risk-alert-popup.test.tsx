/**
 * @jest-environment jsdom
 */
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import RiskAlertPopup from '@/components/RiskAlertPopup'

const mockAlerts = [
  {
    id: 'alert-1',
    type: 'roas_drop',
    title: '广告ROAS异常下降',
    message: '广告ROAS降至3.2，低于阈值4.0',
    link: '/dashboard/ads',
  },
  {
    id: 'alert-2',
    type: 'inventory_low',
    title: '库存预警',
    message: '热销商品库存不足50件',
    link: '/dashboard/inventory',
  },
]

const alertWithoutLink = {
  id: 'alert-3',
  type: 'system',
  title: '系统通知',
  message: '系统将于今晚维护',
}

describe('RiskAlertPopup', () => {
  test('renders alert cards with correct titles and messages', () => {
    render(
      <RiskAlertPopup alerts={mockAlerts} onClose={jest.fn()} onJump={jest.fn()} />
    )

    expect(screen.getByText('广告ROAS异常下降')).toBeInTheDocument()
    expect(screen.getByText('广告ROAS降至3.2，低于阈值4.0')).toBeInTheDocument()
    expect(screen.getByText('库存预警')).toBeInTheDocument()
    expect(screen.getByText('热销商品库存不足50件')).toBeInTheDocument()
  })

  test('close button calls onClose with correct id', () => {
    const onClose = jest.fn()
    render(
      <RiskAlertPopup alerts={mockAlerts} onClose={onClose} onJump={jest.fn()} />
    )

    const closeButtons = screen.getAllByText('关闭')
    fireEvent.click(closeButtons[0])

    expect(onClose).toHaveBeenCalledWith('alert-1')
  })

  test('jump button calls onJump with correct link', () => {
    const onJump = jest.fn()
    render(
      <RiskAlertPopup alerts={mockAlerts} onClose={jest.fn()} onJump={onJump} />
    )

    const jumpButtons = screen.getAllByText('查看详情')
    fireEvent.click(jumpButtons[0])

    expect(onJump).toHaveBeenCalledWith('/dashboard/ads')
    fireEvent.click(jumpButtons[1])
    expect(onJump).toHaveBeenCalledWith('/dashboard/inventory')
  })

  test('multiple alerts render correctly', () => {
    render(
      <RiskAlertPopup alerts={mockAlerts} onClose={jest.fn()} onJump={jest.fn()} />
    )

    expect(screen.getByText('2 条预警')).toBeInTheDocument()
    expect(screen.getAllByText('⚠️').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('关闭').length).toBe(2)
    expect(screen.getAllByText('查看详情').length).toBe(2)
  })

  test('empty alerts array renders nothing', () => {
    const { container } = render(
      <RiskAlertPopup alerts={[]} onClose={jest.fn()} onJump={jest.fn()} />
    )

    expect(container.firstChild).toBeNull()
  })

  test('alert without link does not render jump button', () => {
    render(
      <RiskAlertPopup alerts={[alertWithoutLink]} onClose={jest.fn()} onJump={jest.fn()} />
    )

    expect(screen.getByText('系统通知')).toBeInTheDocument()
    expect(screen.queryByText('查看详情')).not.toBeInTheDocument()
    expect(screen.getByText('关闭')).toBeInTheDocument()
  })
})
