'use client'
import { FormEvent, useState } from 'react'

export default function JoinForm({
  busy,
  error,
  onJoin,
}: {
  busy: boolean
  error: string
  onJoin: (name: string, phone: string) => void
}) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    onJoin(name, phone)
  }

  return (
    <>
      <div className="hero">
        <p>Welcome to CafeFlow</p>
        <h1>What should we call you?</h1>
        <p>We&apos;ll use this to bring your order to the right table. No password or OTP needed.</p>
      </div>
      <form className="panel" onSubmit={submit}>
        <label>Your name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Aanya Sharma"
          required
          minLength={2}
          maxLength={100}
        />
        <label>Phone number</label>
        <input
          className="input"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="e.g. +91 98765 43210"
          required
          minLength={7}
          maxLength={32}
        />
        {error && <div className="error">{error}</div>}
        <button className="primary" disabled={busy}>
          {busy ? 'Opening menu...' : 'Continue to menu'}
        </button>
      </form>
    </>
  )
}
