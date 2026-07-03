import React, { useRef, useState } from 'react'
import { TN_DISTRICTS } from './districts'
import { collectInstitutes } from './placesApi'
import { exportToExcel } from './exportExcel'
import './App.css'

const STATUS = {
  IDLE: 'idle',
  RUNNING: 'running',
  STOPPED: 'stopped',
  DONE: 'done',
  ERROR: 'error',
}

export default function App() {
  const [apiKey, setApiKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [keyword, setKeyword] = useState('computer training institute')
  const [desiredCount, setDesiredCount] = useState(30)
  const [status, setStatus] = useState(STATUS.IDLE)
  const [results, setResults] = useState([])
  const [log, setLog] = useState([])
  const [errorMsg, setErrorMsg] = useState('')

  const stopRef = useRef(false)
  const logEndRef = useRef(null)

  function pushLog(entry) {
    setLog((prev) => {
      const next = [...prev, { ...entry, t: Date.now() }]
      return next.slice(-200)
    })
    queueMicrotask(() => {
      logEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }

  async function handleStart() {
    if (!apiKey.trim()) {
      setErrorMsg('Enter a Google Places API key first.')
      return
    }
    if (!keyword.trim()) {
      setErrorMsg('Enter a search keyword.')
      return
    }

    setErrorMsg('')
    setResults([])
    setLog([])
    stopRef.current = false
    setStatus(STATUS.RUNNING)

    try {
      const collected = await collectInstitutes({
        apiKey: apiKey.trim(),
        keyword: keyword.trim(),
        locations: TN_DISTRICTS,
        desiredCount: Number(desiredCount) || 20,
        stopSignal: () => stopRef.current,
        onProgress: (evt) => {
          if (evt.type === 'searching') {
            pushLog({ level: 'info', text: `searching "${keyword}" — ${evt.location}` })
          } else if (evt.type === 'page') {
            pushLog({ level: 'muted', text: `  ↳ page returned ${evt.count} place(s)` })
          } else if (evt.type === 'done-location') {
            pushLog({ level: 'success', text: `  ✓ total unique so far: ${evt.collected}` })
          } else if (evt.type === 'error') {
            pushLog({ level: 'error', text: `  ✗ ${evt.location}: ${evt.message}` })
          }
        },
      })

      setResults(collected)
      setStatus(stopRef.current ? STATUS.STOPPED : STATUS.DONE)
      pushLog({
        level: 'success',
        text: `finished — ${collected.length} institute(s) collected`,
      })
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong while searching.')
      setStatus(STATUS.ERROR)
      pushLog({ level: 'error', text: `stopped: ${err.message}` })
    }
  }

  function handleStop() {
    stopRef.current = true
    pushLog({ level: 'muted', text: 'stop requested — finishing current request…' })
  }

  function handleDownload() {
    if (results.length === 0) return
    const safeKeyword = keyword.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    exportToExcel(results, `tn-${safeKeyword || 'institutes'}.xlsx`)
  }

  const isRunning = status === STATUS.RUNNING

  return (
    <div className="page">
      <header className="hero">
        <div className="eyebrow">TAMIL NADU · PLACES API (NEW) · TEXT SEARCH</div>
        <h1>Computer Institute Finder</h1>
        <p className="hero-sub">
          Sweeps every district in Tamil Nadu with the <code>places:searchText</code> endpoint,
          de-duplicates results by place ID, and exports a clean spreadsheet — name, address,
          phone, website, rating, review count, and Maps link.
        </p>
      </header>

      <main className="layout">
        <section className="card config-card">
          <h2>Search</h2>

          <label className="field">
            <span className="field-label">Google Places API key</span>
            <div className="key-input">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                autoComplete="off"
                spellCheck={false}
                disabled={isRunning}
              />
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setShowKey((s) => !s)}
                tabIndex={-1}
              >
                {showKey ? 'hide' : 'show'}
              </button>
            </div>
            <span className="field-hint">
              Needs <strong>Places API (New)</strong> enabled and billing active on the project.
              Key never leaves your browser — calls go straight to Google.
            </span>
          </label>

          <label className="field">
            <span className="field-label">Search keyword</span>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="computer training institute"
              disabled={isRunning}
            />
            <span className="field-hint">
              Combined with each district, e.g. “{keyword || 'computer institute'} in Coimbatore, Tamil Nadu”.
            </span>
          </label>

          <label className="field">
            <span className="field-label">Number of institutes wanted</span>
            <input
              type="number"
              min={1}
              max={900}
              value={desiredCount}
              onChange={(e) => setDesiredCount(e.target.value)}
              disabled={isRunning}
            />
            <span className="field-hint">
              Up to 60 come from a single district query; larger counts fan out across
              Tamil Nadu's {TN_DISTRICTS.length} districts/towns automatically.
            </span>
          </label>

          <div className="btn-row">
            {!isRunning ? (
              <button className="primary-btn" onClick={handleStart}>
                Start search
              </button>
            ) : (
              <button className="stop-btn" onClick={handleStop}>
                Stop
              </button>
            )}
            <button
              className="secondary-btn"
              onClick={handleDownload}
              disabled={results.length === 0}
            >
              Download Excel ({results.length})
            </button>
          </div>

          {errorMsg && <div className="error-banner">{errorMsg}</div>}

          <div className="status-line">
            <span className={`status-dot status-${status}`} />
            <span className="status-text">
              {status === STATUS.IDLE && 'idle'}
              {status === STATUS.RUNNING && 'searching…'}
              {status === STATUS.STOPPED && 'stopped early'}
              {status === STATUS.DONE && 'complete'}
              {status === STATUS.ERROR && 'error'}
            </span>
          </div>
        </section>

        <section className="card log-card">
          <h2>Query log</h2>
          <div className="terminal">
            {log.length === 0 && (
              <div className="terminal-placeholder">
                Logs from each district query will stream here once you start a search.
              </div>
            )}
            {log.map((entry, i) => (
              <div key={i} className={`term-line term-${entry.level}`}>
                {entry.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>
        </section>
      </main>

      <section className="card results-card">
        <div className="results-header">
          <h2>Results</h2>
          <span className="results-count">{results.length} institute(s)</span>
        </div>

        {results.length === 0 ? (
          <div className="empty-state">
            No results yet. Run a search to see institutes appear here row by row.
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Institute Name</th>
                  <th>Address</th>
                  <th>Phone</th>
                  <th>Website</th>
                  <th>Rating</th>
                  <th>Reviews</th>
                  <th>Maps</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.id || i}>
                    <td className="mono dim">{i + 1}</td>
                    <td>{r.name}</td>
                    <td className="dim">{r.address}</td>
                    <td className="mono">{r.phone || '—'}</td>
                    <td>
                      {r.website ? (
                        <a href={r.website} target="_blank" rel="noreferrer">
                          site ↗
                        </a>
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </td>
                    <td className="mono">
                      {r.rating !== '' ? (
                        <span className="rating">★ {r.rating}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="mono dim">{r.reviewCount || 0}</td>
                    <td>
                      {r.mapsUrl ? (
                        <a href={r.mapsUrl} target="_blank" rel="noreferrer">
                          map ↗
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <footer className="footer">
        Uses the Places API (New) <code>places:searchText</code> endpoint directly from the
        browser. Restrict your API key to your site's domain (HTTP referrer) before shipping
        this anywhere public, and keep an eye on Google Cloud billing — each search request is
        billed by Google regardless of how many rows end up in the spreadsheet.
      </footer>
    </div>
  )
}
