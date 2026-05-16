import { useState, type FormEvent, type ReactElement } from 'react';

export function LoginPage(): ReactElement {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setStatus('Auth not implemented yet — Phase 1A Block 014');
  }

  return (
    <main>
      <h1>Sign in</h1>
      <form onSubmit={handleSubmit}>
        <p>
          <label htmlFor="email">Email</label>
          <br />
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            required
          />
        </p>
        <p>
          <label htmlFor="password">Password</label>
          <br />
          <input
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            required
          />
        </p>
        <p>
          <button type="submit">Sign in</button>
        </p>
      </form>
      {status !== null && <p role="status">{status}</p>}
    </main>
  );
}
