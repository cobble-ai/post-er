export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <div className="shell narrow login">
      <form className="card stack" method="post" action="/api/login">
        <h1>Post Calendar</h1>
        <input
          className="field"
          type="password"
          name="password"
          aria-label="Password"
          placeholder="Password"
          autoComplete="current-password"
          autoFocus
          required
        />
        {error && <p className="warn">Wrong password.</p>}
        <button className="btn btn-primary" type="submit">
          Enter
        </button>
      </form>
    </div>
  );
}
