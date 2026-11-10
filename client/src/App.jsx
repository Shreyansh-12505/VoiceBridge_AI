import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioLines, ArrowDown, ArrowRight, Check, ChevronDown, CircleHelp, FileAudio2, Globe2, Headphones, LogOut, Mic, MicOff, Radio, RotateCcw, ShieldCheck, Sparkles, Upload, X } from 'lucide-react'

const LANGUAGES = [
  ['hi-IN', 'Hindi'], ['en-IN', 'English (India)'], ['ta-IN', 'Tamil'], ['te-IN', 'Telugu'],
  ['kn-IN', 'Kannada'], ['ml-IN', 'Malayalam'], ['mr-IN', 'Marathi'], ['pa-IN', 'Punjabi'],
  ['bn-IN', 'Bengali'], ['gu-IN', 'Gujarati'],
]
const ACCEPTED = ['.wav', '.mp3', '.ogg', '.flac', '.aac', '.m4a']
const MAX_FILE = 10 * 1024 * 1024

function IconMark() { return <div className="brand-mark"><AudioLines size={19} strokeWidth={2.2} /></div> }
function Spinner() { return <span className="spinner" aria-label="Loading" /> }

function useToast() {
  const [toast, setToast] = useState(null)
  const timer = useRef()
  const show = useCallback((message, kind = 'error') => {
    setToast({ message, kind })
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setToast(null), 4300)
  }, [])
  useEffect(() => () => clearTimeout(timer.current), [])
  return [toast, show, () => setToast(null)]
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://voicebridge-ai-3zos.onrender.com').replace(/\/+$/, '')
const WS_BASE_URL = (import.meta.env.VITE_WS_BASE_URL || API_BASE_URL.replace(/^http/, 'ws')).replace(/\/+$/, '')

async function api(path, options = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`
  const response = await fetch(url, { credentials: 'include', ...options })
  const type = response.headers.get('content-type') || ''
  const payload = type.includes('application/json') ? await response.json() : null
  if (!response.ok) {
    const detail = payload?.message || payload?.error || payload?.details
    throw new Error(typeof detail === 'string' ? detail : response.status === 403 ? 'You do not have enough credits to run this translation.' : `Request failed (${response.status}).`)
  }
  return { response, payload }
}

function AuthGate({ onLogin, toast }) {
  const [mode, setMode] = useState('login')
  const [busy, setBusy] = useState(false)
  const [fields, setFields] = useState({ username: '', email: '', password: '' })
  
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    try {
      const payloadData = mode === 'register' 
        ? fields 
        : { email: fields.email, password: fields.password }

      const { payload } = await api(`/auth/${mode}`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(payloadData) 
      })
      const userData = payload?.user ? (payload.token ? { ...payload.user, token: payload.token } : payload.user) : payload
      onLogin(userData)
    } catch (error) { 
      toast(error.message) 
    } finally { 
      setBusy(false) 
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <IconMark />
        <div className="eyebrow">VOICEBRIDGE AI</div>
        <h1>{mode === 'login' ? 'Your voice, everywhere.' : 'Make room for every voice.'}</h1>
        <p className="muted">{mode === 'login' ? 'Sign in to continue to your translation studio.' : 'Create an account to start translating speech.'}</p>
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && (
            <label>Your name
              <input 
                autoComplete="username" 
                required 
                minLength={2} 
                value={fields.username} 
                onChange={e => setFields({ ...fields, username: e.target.value })} 
                placeholder="Alex Morgan" 
              />
            </label>
          )}
          <label>Email address
            <input 
              type="email" 
              autoComplete="email" 
              required 
              value={fields.email} 
              onChange={e => setFields({ ...fields, email: e.target.value })} 
              placeholder="you@example.com" 
            />
          </label>
          <label>Password
            <input 
              type="password" 
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} 
              required 
              minLength={mode === 'register' ? 8 : 1} 
              value={fields.password} 
              onChange={e => setFields({ ...fields, password: e.target.value })} 
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} 
            />
          </label>
          <button className="button button-primary auth-submit" disabled={busy}>
            {busy ? <Spinner /> : <>{mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight size={16} /></>}
          </button>
        </form>
        <p className="auth-switch">
          {mode === 'login' ? 'New to VoiceBridge?' : 'Already have an account?'} {' '}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
        <div className="auth-foot"><ShieldCheck size={14} /> Your audio is processed securely</div>
      </div>
    </main>
  )
}

function DropArea({ file, setFile, toast }) {
  const [drag, setDrag] = useState(false)
  const input = useRef()
  const accept = candidate => {
    if (!candidate) return
    const extension = `.${candidate.name.split('.').pop()?.toLowerCase()}`
    if (!ACCEPTED.includes(extension)) return toast('Choose a WAV, MP3, OGG, FLAC, AAC, or M4A audio file.')
    if (candidate.size > MAX_FILE) return toast('Audio files must be 10 MB or smaller.')
    setFile(candidate)
  }
  return (
    <div 
      className={`drop-area ${drag ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`} 
      onDragOver={e => { e.preventDefault(); setDrag(true) }} 
      onDragLeave={() => setDrag(false)} 
      onDrop={e => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files?.[0]) }}
    >
      <input ref={input} type="file" accept={ACCEPTED.join(',')} hidden onChange={e => { accept(e.target.files?.[0]); e.target.value = '' }} />
      {file ? (
        <>
          <div className="file-icon"><FileAudio2 size={20} /></div>
          <div className="file-copy">
            <strong>{file.name}</strong>
            <span>{(file.size / (1024 * 1024)).toFixed(file.size < 100000 ? 3 : 1)} MB · ready to translate</span>
          </div>
          <button className="icon-button remove-file" onClick={() => setFile(null)} aria-label="Remove audio file">
            <X size={17} />
          </button>
        </>
      ) : (
        <>
          <div className="upload-icon"><Upload size={20} /></div>
          <div className="drop-copy">
            <strong>Drop your audio here</strong>
            <span>or <button type="button" className="text-button" onClick={() => input.current?.click()}>browse files</button></span>
            <small>WAV, MP3, OGG, FLAC, AAC or M4A · up to 10 MB</small>
          </div>
        </>
      )}
    </div>
  )
}

function FullCycle({ voices, voicesLoading, toast, onCredits }) {
  const [file, setFile] = useState(null)
  const [language, setLanguage] = useState('hi-IN')
  const [voice, setVoice] = useState('')
  const [busy, setBusy] = useState(false)
  const [audioUrl, setAudioUrl] = useState('')
  const [transcript, setTranscript] = useState('')
  const [downloadType, setDownloadType] = useState('audio/wav')
  const audioRef = useRef()

  const currentVoice = voices.find(item => item.name === voice)

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  useEffect(() => { 
    if (voices.length > 0 && !voices.some(item => item.name === voice)) {
      setVoice(voices[0]?.name || '')
    } 
  }, [voices, voice])

  const run = async e => {
    e.preventDefault()
    if (!file) return toast('Add an audio file to get started.')
    if (!voice) return toast('Choose a target voice before translating.')
    setBusy(true); setTranscript('')
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioUrl('')
    try {
      const data = new FormData()
      data.append('audio', file)
      data.append('target_language', language)
      data.append('target_voice', voice)

      const { response } = await api('/speech/translate_voice', { method: 'POST', body: data })
      const blob = await response.blob()
      if (!blob.size) throw new Error('The translation returned an empty audio file.')
      
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      setDownloadType(response.headers.get('content-type') || blob.type || 'audio/wav')
      
      const encoded = response.headers.get('x-transcribed-text')
      if (encoded) { 
        try { 
          setTranscript(decodeURIComponent(escape(atob(encoded)))) 
        } catch { 
          try { setTranscript(atob(encoded)) } catch {} 
        } 
      }
      
      onCredits(2)
      toast('Your translated audio is ready.', 'success')
      requestAnimationFrame(() => audioRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    } catch (error) { 
      toast(error.message) 
    } finally { 
      setBusy(false) 
    }
  }

  return (
    <div className="workspace-grid">
      <section className="card translate-card">
        <div className="card-heading">
          <div>
            <div className="section-kicker">FILE TRANSLATION</div>
            <h2>Take speech further.</h2>
            <p>Translate a recording and hear it in another language.</p>
          </div>
          <div className="heading-icon"><Sparkles size={18} /></div>
        </div>
        <form onSubmit={run}>
          <div className="form-section">
            <div className="field-title"><span>01</span><div><strong>Add your recording</strong><small>Choose a clear audio clip for better results</small></div></div>
            <DropArea file={file} setFile={setFile} toast={toast} />
          </div>
          <div className="form-section">
            <div className="field-title"><span>02</span><div><strong>Choose the output</strong><small>Select the language and voice you’d like to hear</small></div></div>
            <div className="select-grid">
              <label>Target language
                <div className="select-wrap">
                  <Globe2 size={16} />
                  <select value={language} onChange={e => setLanguage(e.target.value)}>
                    {LANGUAGES.map(([code, name]) => <option value={code} key={code}>{name}</option>)}
                  </select>
                  <ChevronDown size={15} />
                </div>
              </label>
              <label>Target voice
                <div className="select-wrap">
                  <AudioLines size={16} />
                  {voicesLoading ? (
                    <div className="select-loading"><Spinner /> Loading voices</div>
                  ) : (
                    <select value={voice} onChange={e => setVoice(e.target.value)} disabled={!voices.length}>
                      {voices.length ? voices.map(item => (
                        <option value={item.name} key={item.name}>
                          {item.name}{item.gender ? ` · ${item.gender}` : ''}
                        </option>
                      )) : <option value="">No voices available</option>}
                    </select>
                  )}
                  <ChevronDown size={15} />
                </div>
              </label>
            </div>
            {currentVoice && (
              <div className="voice-note">
                <span className="voice-avatar">{currentVoice.name.slice(0, 1)}</span>
                <span>
                  <strong>{currentVoice.name}</strong>
                  <small>{currentVoice.gender || 'Voice'} · {LANGUAGES.find(([code]) => code === language)?.[1] || language}</small>
                </span>
                <span className="live-dot" />
              </div>
            )}
          </div>
          <button className="button button-primary translate-submit" disabled={busy || voicesLoading || !voice}>
            {busy ? <><Spinner /> Translating your audio…</> : <>Translate recording <ArrowRight size={16} /></>}
          </button>
          <div className="credit-hint"><ShieldCheck size={14} /> Each completed translation uses 2 credits</div>
        </form>
      </section>
      
      <aside className="side-column">
        <section className="card process-card">
          <div className="section-kicker">THE PROCESS</div>
          <h3>Words in. Meaning out.</h3>
          <div className="process-steps">
            <div className="process-step">
              <div className="step-symbol"><AudioLines size={17} /></div>
              <div><strong>We listen</strong><span>Speech is transcribed in its original language.</span></div>
            </div>
            <div className="step-connector" />
            <div className="process-step">
              <div className="step-symbol translate-symbol"><Globe2 size={17} /></div>
              <div><strong>We translate</strong><span>Your words are voiced naturally in your chosen language.</span></div>
            </div>
            <div className="step-connector" />
            <div className="process-step">
              <div className="step-symbol play-symbol"><Headphones size={17} /></div>
              <div><strong>You listen</strong><span>Preview and download your finished audio.</span></div>
            </div>
          </div>
        </section>
        
        <section className="note-card">
          <div className="note-mark"><CircleHelp size={17} /></div>
          <div>
            <strong>A little prep goes a long way</strong>
            <p>Use a short recording with clear speech and little background noise for the most natural translation.</p>
          </div>
        </section>

        {audioUrl && (
          <section className="card result-card" ref={audioRef}>
            <div className="result-top">
              <div className="result-icon"><Check size={18} /></div>
              <div><span className="section-kicker">TRANSLATION COMPLETE</span><h3>Your audio is ready</h3></div>
              <button className="icon-button" aria-label="Clear result" onClick={() => { URL.revokeObjectURL(audioUrl); setAudioUrl(''); setTranscript('') }}>
                <X size={17} />
              </button>
            </div>
            {transcript && (
              <div className="transcript-preview">
                <span>ORIGINAL TRANSCRIPT</span>
                <p>{transcript}</p>
              </div>
            )}
            <audio controls src={audioUrl} className="audio-player" aria-label="Translated audio playback" />
            <a className="download-link" href={audioUrl} download={`voicebridge-${language}.${downloadType.includes('mpeg') ? 'mp3' : 'wav'}`}>
              Download translated audio <ArrowDown size={15} />
            </a>
          </section>
        )}
      </aside>
    </div>
  )
}

function downsample(input, inputRate, outputRate) {
  if (outputRate >= inputRate) return input
  const ratio = inputRate / outputRate
  const length = Math.floor(input.length / ratio)
  const output = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(Math.floor((i + 1) * ratio), input.length)
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    output[i] = sum / (end - start || 1)
  }
  return output
}

function pcmFrame(samples) {
  const frame = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-1, Math.min(1, samples[i]))
    frame[i] = value < 0 ? value * 32768 : value * 32767
  }
  return frame.buffer
}

function Realtime({ toast, user }) {
  const [status, setStatus] = useState('disconnected')
  const [transcript, setTranscript] = useState([])
  const [language, setLanguage] = useState('hi-IN')
  const [model, setModel] = useState('prisma-v2.5')
  const [format, setFormat] = useState('verbatim')
  const [elapsed, setElapsed] = useState(0)
  const [muted, setMuted] = useState(false)

  const scrollRef = useRef()
  const socketRef = useRef(null)
  const audioContextRef = useRef(null)
  const sourceRef = useRef(null)
  const processorRef = useRef(null)
  const streamRef = useRef(null)
  const frameQueue = useRef(new Float32Array(0))
  const activeRef = useRef(false)
  const startTime = useRef(0)
  const streamReadyAt = useRef(0)

  const connected = status === 'connected'

  useEffect(() => { 
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }) 
  }, [transcript])

  useEffect(() => { 
    if (!connected) return
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000)
    return () => clearInterval(id) 
  }, [connected])

  const cleanup = useCallback(async (closeSocket = true) => {
    activeRef.current = false
    if (processorRef.current) { 
      processorRef.current.onaudioprocess = null
      try { processorRef.current.disconnect() } catch {}
      processorRef.current = null 
    }
    if (sourceRef.current) { 
      try { sourceRef.current.disconnect() } catch {}
      sourceRef.current = null 
    }
    if (streamRef.current) { 
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null 
    }
    if (closeSocket && socketRef.current) { 
      const ws = socketRef.current
      socketRef.current = null
      if (ws.readyState < WebSocket.CLOSING) ws.close(1000, 'Recording stopped') 
    }
    if (audioContextRef.current) { 
      const ctx = audioContextRef.current
      audioContextRef.current = null
      try { await ctx.close() } catch {} 
    }
    frameQueue.current = new Float32Array(0)
    setMuted(false)
  }, [])

  useEffect(() => () => { void cleanup() }, [cleanup])

  const stop = useCallback(async () => { 
    await cleanup()
    setStatus('disconnected') 
  }, [cleanup])

  const begin = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return toast('Microphone access requires HTTPS or localhost and a supported browser.')
    
    activeRef.current = true
    setStatus('connecting')
    setTranscript([])
    setElapsed(0)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } 
      })

      if (!activeRef.current) { 
        stream.getTracks().forEach(track => track.stop())
        return 
      }
      streamRef.current = stream

      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const context = new AudioCtx()
      audioContextRef.current = context
      await context.resume()

      const token = user?.token || user?.accessToken
      const params = new URLSearchParams({ model, language_code: language, sample_rate: '16000', format })
      if (token) params.append('token', token)

      const ws = new WebSocket(`${WS_BASE_URL}/speech/realtime?${params.toString()}`)
      socketRef.current = ws
      ws.binaryType = 'arraybuffer'

      ws.onmessage = event => {
        let data
        try { 
          data = typeof event.data === 'string' ? JSON.parse(event.data) : JSON.parse(new TextDecoder().decode(event.data)) 
        } catch { return }

        const text = data.transcript || data.text || data.result?.transcript || data.result?.text || data.data?.transcript || data.data?.text
        if (!text) return

        const isFinal = data.is_final ?? data.final ?? data.result?.is_final ?? true
        setTranscript(items => { 
          const next = [...items]
          if (!isFinal && next.length && !next.at(-1).final) {
            next[next.length - 1] = { text: String(text), final: false }
          } else { 
            next.push({ text: String(text), final: Boolean(isFinal) })
          } 
          return next.slice(-100) 
        })
      }

      ws.onerror = () => { 
        toast('Could not connect to live transcription. Check your connection and sign-in.')
        void cleanup()
        setStatus('disconnected') 
      }

      ws.onclose = event => {
        if (socketRef.current === ws) { 
          socketRef.current = null
          void cleanup(false)
          setStatus('disconnected')
          if (event.code !== 1000 && event.code !== 1001) {
            toast(event.reason || (event.code === 401 ? 'Please sign in again to use live transcription.' : 'Live transcription disconnected. Check your connection.')) 
          }
        }
      }

      ws.onopen = () => {
        if (!activeRef.current) { ws.close(1000); return }
        startTime.current = Date.now()
        streamReadyAt.current = Date.now() + 700

        const source = context.createMediaStreamSource(stream)
        sourceRef.current = source

        const processor = context.createScriptProcessor(4096, 1, 1)
        processorRef.current = processor

        processor.onaudioprocess = event => {
          event.outputBuffer.getChannelData(0).fill(0)
          if (!activeRef.current || muted || ws.readyState !== WebSocket.OPEN || Date.now() < streamReadyAt.current) return

          const input = event.inputBuffer.getChannelData(0)
          const next = downsample(input, context.sampleRate, 16000)
          const queued = frameQueue.current
          const merged = new Float32Array(queued.length + next.length)
          merged.set(queued)
          merged.set(next, queued.length)

          let offset = 0
          while (merged.length - offset >= 512) { 
            ws.send(pcmFrame(merged.subarray(offset, offset + 512)))
            offset += 512 
          }
          frameQueue.current = merged.slice(offset)
        }

        source.connect(processor)
        processor.connect(context.destination)
        setStatus('connected')
      }
    } catch (error) {
      await cleanup()
      setStatus('disconnected')
      if (error.name === 'NotAllowedError') toast('Microphone access was blocked. Allow it in your browser settings to continue.')
      else if (error.name === 'NotFoundError') toast('No microphone was found. Connect a microphone and try again.')
      else toast(error.message || 'Could not start the microphone.')
    }
  }

  const toggle = () => { 
    if (status === 'connected') void stop()
    else if (status === 'disconnected') { void begin() } 
    else { activeRef.current = false; void cleanup(); setStatus('disconnected') } 
  }

  const displayTime = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

  return (
    <div className="realtime-grid">
      <section className="card mic-card">
        <div className="section-kicker">LIVE CONVERSATION</div>
        <h2>Speak. We’re listening.</h2>
        <p>Words appear as you speak. Your browser keeps the microphone session in your control.</p>
        <div className={`mic-scene ${connected ? 'recording' : ''}`}>
          <div className="sound-wave wave-left"><i /><i /><i /><i /><i /></div>
          <div className="speech-bubble">
            <div className="bubble-facet facet-one"/>
            <div className="bubble-facet facet-two"/>
            <div className="bubble-facet facet-three"/>
            <button 
              className={`mic-button ${connected ? 'active' : ''}`} 
              onClick={toggle} 
              aria-label={connected ? 'Stop recording' : 'Start recording'} 
              disabled={status === 'connecting'}
            >
              {status === 'connecting' ? <Spinner /> : connected ? <MicOff size={29} /> : <Mic size={31} strokeWidth={2.1} />}
            </button>
          </div>
          <div className="sound-wave wave-right"><i /><i /><i /><i /><i /></div>
        </div>
        <div className={`recording-state ${connected ? 'is-live' : ''}`}>
          <span className="status-indicator" />
          {status === 'connecting' ? 'Connecting to live transcription…' : connected ? <>Listening now <span className="recording-time">{displayTime}</span></> : 'Ready when you are'}
        </div>
        <button 
          className={`button ${connected ? 'button-stop' : 'button-primary'} mic-action`} 
          onClick={toggle} 
          disabled={status === 'connecting'}
        >
          {status === 'connecting' ? <><Spinner /> Connecting…</> : connected ? 'Stop listening' : <><Mic size={16} /> Start speaking</>}
        </button>
        <div className="mic-footnote"><ShieldCheck size={14} /> Microphone turns off when you stop</div>
      </section>

      <section className="card transcript-card">
        <div className="transcript-head">
          <div><div className="section-kicker">LIVE TRANSCRIPT</div><h3>Your words, as they happen</h3></div>
          <span className={`transcript-badge ${connected ? 'active' : ''}`}><i />{connected ? 'LIVE' : 'READY'}</span>
        </div>
        <div className="transcript-scroll" ref={scrollRef} aria-live="polite" aria-label="Live speech transcript">
          {transcript.length ? (
            <div className="transcript-lines">
              {transcript.map((line, index) => (
                <p className={line.final ? 'final-line' : 'partial-line'} key={`${index}-${line.text}`}>
                  {line.text}{!line.final && <span className="cursor-blink">▍</span>}
                </p>
              ))}
            </div>
          ) : (
            <div className="transcript-empty">
              <div className="empty-wave"><AudioLines size={20} /></div>
              <strong>{connected ? 'Listening for your first words' : 'A little quiet in here'}</strong>
              <span>{connected ? 'Start talking and your transcript will appear.' : 'Press the microphone when you’re ready to speak.'}</span>
            </div>
          )}
        </div>
        <div className="transcript-bottom">
          <span><span className={`status-indicator ${connected ? 'green' : ''}`} />{connected ? 'Transcription is active' : 'Transcript will appear here'}</span>
          <button className="clear-button" onClick={() => setTranscript([])} disabled={!transcript.length}>
            <RotateCcw size={13} /> Clear
          </button>
        </div>
      </section>

      <section className="card settings-card">
        <div className="settings-heading">
          <div><div className="section-kicker">SESSION SETTINGS</div><h3>Make it yours</h3></div>
          <Radio size={18} />
        </div>
        <div className="settings-fields">
          <label>Transcription language
            <div className="select-wrap">
              <Globe2 size={15} />
              <select value={language} onChange={e => setLanguage(e.target.value)} disabled={connected || status === 'connecting'}>
                {LANGUAGES.map(([code, name]) => <option value={code} key={code}>{name}</option>)}
              </select>
              <ChevronDown size={15} />
            </div>
          </label>
          <label>Recognition model
            <div className="select-wrap">
              <AudioLines size={15} />
              <select value={model} onChange={e => { const next = e.target.value; setModel(next); if (next === 'prisma-v2.5' && format !== 'verbatim' && format !== 'transcribe') setFormat('verbatim') }} disabled={connected || status === 'connecting'}>
                <option value="prisma-v2.5">Prisma v2.5 · standard</option>
                <option value="prisma-v3.0">Prisma v3.0 · multilingual</option>
              </select>
              <ChevronDown size={15} />
            </div>
          </label>
          <label>Transcript style
            <div className="select-wrap">
              <select value={format} onChange={e => setFormat(e.target.value)} disabled={connected || status === 'connecting'}>
                <option value="verbatim">Verbatim</option>
                <option value="transcribe">Clean transcription</option>
                {model === 'prisma-v3.0' && (
                  <>
                    <option value="codemix">Code-mixed</option>
                    <option value="transliterate">Transliteration</option>
                  </>
                )}
              </select>
              <ChevronDown size={15} />
            </div>
          </label>
        </div>
        <div className="settings-note"><span className="settings-note-icon"><Check size={13} /></span> Language and model settings are locked while listening.</div>
      </section>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [voices, setVoices] = useState([])
  const [voicesLoading, setVoicesLoading] = useState(false)
  const [tab, setTab] = useState('translate')
  const [sessionCredits, setSessionCredits] = useState(0)
  const [toast, showToast, dismissToast] = useToast()

  useEffect(() => {
    let active = true
    api('/auth/me')
      .then(({ payload }) => {
        if (active) {
          const userData = payload?.user ? (payload.token ? { ...payload.user, token: payload.token } : payload.user) : payload
          setUser(userData)
        }
      })
      .catch(() => {})
      .finally(() => { if (active) setAuthLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    setVoicesLoading(true)
    api('/speech/voices?model=timbre-v3.0')
      .then(({ payload }) => { if (active) setVoices(Array.isArray(payload?.voices) ? payload.voices : []) })
      .catch(error => { if (active) showToast(error.message || 'Could not load available voices.') })
      .finally(() => { if (active) setVoicesLoading(false) })
    return () => { active = false }
  }, [user, showToast])

  const logout = async () => { 
    try { await api('/auth/logout', { method: 'POST' }) } catch {} 
    setUser(null); setVoices([]); setSessionCredits(0) 
  }

  if (authLoading) return <main className="loading-screen"><IconMark /><Spinner /><span>Getting your studio ready</span></main>

  return (
    <>
      {!user ? (
        <AuthGate onLogin={setUser} toast={showToast} />
      ) : (
        <div className="app-shell">
          <header className="topbar">
            <div className="brand">
              <IconMark />
              <div>
                <span className="brand-name">voicebridge<span className="brand-period">.</span></span>
                <span className="brand-caption">YOUR VOICE, UNDERSTOOD</span>
              </div>
            </div>
            <div className="topbar-right">
              <div className="credits-badge" title="Session estimate based on completed translations">
                <Sparkles size={14} />
                <span>
                  <strong>{sessionCredits}</strong>
                  <span className="credit-separator">/</span>
                  {user.creditTotal ?? '—'} <span className="credit-label">credits used this session</span>
                </span>
              </div>
              <div className="connection-badge"><span className="connection-dot" /><span>Ready</span></div>
              <div className="user-menu">
                <div className="user-avatar">{(user.username || user.email || 'U').slice(0, 1).toUpperCase()}</div>
                <span className="user-name">{user.username || user.email}</span>
                <button className="icon-button logout-button" aria-label="Sign out" onClick={logout} title="Sign out"><LogOut size={16} /></button>
              </div>
            </div>
          </header>

          <main className="main-content">
            <div className="page-intro">
              <div>
                <div className="eyebrow"><span className="eyebrow-line" /> YOUR PERSONAL TRANSLATION STUDIO</div>
                <h1>Every conversation,<br className="mobile-break" /> <span>within reach.</span></h1>
                <p>Move naturally between languages, one voice at a time.</p>
              </div>
              <div className="intro-decoration" aria-hidden="true"><span /><span /><span /><span /><span /></div>
            </div>
            <div className="mode-tabs" role="tablist" aria-label="Translation mode">
              <button role="tab" aria-selected={tab === 'translate'} className={tab === 'translate' ? 'selected' : ''} onClick={() => setTab('translate')}>
                <span className="tab-icon"><Sparkles size={16} /></span>
                <span><strong>Translate audio</strong><small>Full-cycle · upload a recording</small></span>
              </button>
              <button role="tab" aria-selected={tab === 'live'} className={tab === 'live' ? 'selected' : ''} onClick={() => setTab('live')}>
                <span className="tab-icon"><Radio size={16} /></span>
                <span><strong>Live transcription</strong><small>Real-time · speak naturally</small></span>
                <span className="live-tab-dot" />
              </button>
            </div>
            {tab === 'translate' ? (
              <FullCycle voices={voices} voicesLoading={voicesLoading} toast={showToast} onCredits={n => setSessionCredits(value => value + n)} />
            ) : (
              <Realtime toast={showToast} user={user} />
            )}
            <footer className="page-footer">
              <span>Made for voices without borders.</span>
              <span>Audio is processed securely <ShieldCheck size={13} /></span>
            </footer>
          </main>
        </div>
      )}
      {toast && (
        <div className={`toast ${toast.kind}`} role="status">
          <span className="toast-symbol">{toast.kind === 'success' ? <Check size={15} /> : <X size={15} />}</span>
          <span>{toast.message}</span>
          <button onClick={dismissToast} aria-label="Dismiss notification"><X size={15} /></button>
        </div>
      )}
    </>
  )
}