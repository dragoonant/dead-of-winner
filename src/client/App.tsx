// Placeholder title screen so the Pages deploy has something to show before M3.
const style: React.CSSProperties = {
  minHeight: '100vh', margin: 0, display: 'grid', placeItems: 'center',
  background: '#14161a', color: '#e8e6e1', fontFamily: 'Georgia, serif', textAlign: 'center',
}

export function App() {
  return (
    <div style={style}>
      <div>
        <h1 style={{ color: '#c9a227', fontSize: '3rem', margin: 0 }}>Dead of Winner</h1>
        <p style={{ color: '#7fb2d6' }}>A colony of AI survivors, one human at the table. Coming soon.</p>
        <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>
          An unofficial fan project. Not affiliated with Plaid Hat Games, Fantasy Flight Games or Asmodee.
        </p>
      </div>
    </div>
  )
}
