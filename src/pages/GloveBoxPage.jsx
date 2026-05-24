import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/index'
import {
  uploadDocument, getSignedUrl, deleteDocument, getFileType, formatFileSize
} from '../utils/documentStorage'
import { analyzeImage } from '../utils/documentIndexer'

const CATEGORIES = [
  { id: 'reservation', label: 'Reservation' },
  { id: 'permit',      label: 'Permit'       },
  { id: 'insurance',   label: 'Insurance'    },
  { id: 'registration',label: 'Registration' },
  { id: 'map',         label: 'Map'          },
  { id: 'medical',     label: 'Medical'      },
  { id: 'vehicle',     label: 'Vehicle'      },
  { id: 'note',        label: 'Note'         },
  { id: 'other',       label: 'Other'        },
]

const TYPE_FILTERS = [
  { id: 'all',         label: 'All'         },
  { id: 'pdf',         label: 'PDF'         },
  { id: 'image',       label: 'Image'       },
  { id: 'text',        label: 'Text'        },
  { id: 'reservation', label: 'Reservation' },
]

const IconPDF = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="15" x2="15" y2="15"/>
    <line x1="9" y1="11" x2="15" y2="11"/>
  </svg>
)

const IconImage = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <rect x="3" y="3" width="18" height="18" rx="2"/>
    <circle cx="8.5" cy="8.5" r="1.5"/>
    <polyline points="21 15 16 10 5 21"/>
  </svg>
)

const IconText = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="12" y2="17"/>
  </svg>
)

const IconReservation = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
    <rect x="3" y="4" width="18" height="18" rx="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const IconChevron = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
    <path d="M9 18l6-6-6-6"/>
  </svg>
)

const IconLock = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.75"
    strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12, flexShrink: 0 }}>
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)

const TYPE_ICON = {
  pdf:         <IconPDF />,
  image:       <IconImage />,
  text:        <IconText />,
  reservation: <IconReservation />,
}

function typeIcon(type) {
  return TYPE_ICON[type] ?? <IconText />
}

// ─── Shared style helpers ──────────────────────────────────────────────────────

const labelStyle = {
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  color: 'var(--text-tertiary)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  display: 'block',
  marginBottom: 6,
}

const inputStyle = {
  width: '100%',
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '10px 12px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-body)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const monoInputStyle = { ...inputStyle, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }

const pageWrap = { display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }

const headerStyle = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
  background: 'var(--bg-secondary)',
  flexShrink: 0,
}

const backBtn = {
  background: 'none', border: 'none',
  color: 'var(--text-secondary)',
  cursor: 'pointer', fontSize: 20, padding: 0, flexShrink: 0,
}

const monoLabel = {
  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.1em', color: 'var(--text-tertiary)', textTransform: 'uppercase',
}

const iconBox = {
  width: 40, height: 40, borderRadius: 10,
  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--accent)', flexShrink: 0,
}

// Module-level cache so docs survive re-navigation (component remounts on every nav)
let _gloveBoxCache = null // { userId, docs } | null

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function GloveBoxPage({ onBack }) {
  const { user } = useAppStore()

  const cachedDocs = _gloveBoxCache?.userId === user?.id ? _gloveBoxCache.docs : null
  const [docs, setDocs]             = useState(cachedDocs ?? [])
  const [loading, setLoading]       = useState(cachedDocs === null)
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [view, setView]             = useState('list') // 'list' | 'detail' | 'add'
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [signedUrls, setSignedUrls] = useState({})

  useEffect(() => {
    if (!user) { setLoading(false); return }
    let cancelled = false
    // Only show spinner if no cache; otherwise refresh silently in background
    if (_gloveBoxCache?.userId !== user.id) setLoading(true)
    supabase
      .from('glove_box')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) console.error('Glove box load error:', error)
        const result = data ?? []
        _gloveBoxCache = { userId: user.id, docs: result }
        setDocs(result)
        setLoading(false)
      })
      .catch(err => {
        if (cancelled) return
        console.error('Glove box fetch error:', err)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [user?.id])

  async function loadDocs() {
    if (!user) { setLoading(false); return }
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('glove_box')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) console.error('Glove box load error:', error)
      const result = data ?? []
      _gloveBoxCache = { userId: user.id, docs: result }
      setDocs(result)
    } catch (err) {
      console.error('Glove box fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredDocs = docs.filter(doc => {
    const matchesType =
      typeFilter === 'all' ||
      doc.type === typeFilter ||
      (typeFilter === 'reservation' && doc.category === 'reservation')
    const q = search.toLowerCase()
    const matchesSearch = !search ||
      doc.title?.toLowerCase().includes(q) ||
      doc.content?.toLowerCase().includes(q) ||
      doc.extracted_text?.toLowerCase().includes(q) ||
      doc.category?.toLowerCase().includes(q) ||
      (doc.tags ?? []).some(t => t.toLowerCase().includes(q))
    return matchesType && matchesSearch
  })

  async function getSignedUrlCached(doc) {
    if (!doc.file_path) return null
    if (signedUrls[doc.id]) return signedUrls[doc.id]
    try {
      const url = await getSignedUrl(doc.file_path)
      setSignedUrls(prev => ({ ...prev, [doc.id]: url }))
      return url
    } catch (err) {
      console.error('Signed URL error:', err)
      return null
    }
  }

  async function handleDelete(doc) {
    if (!confirm(`Delete "${doc.title}"? This cannot be undone.`)) return
    if (doc.file_path) await deleteDocument(doc.file_path)
    await supabase.from('glove_box').delete().eq('id', doc.id).eq('user_id', user.id)
    const updated = docs.filter(d => d.id !== doc.id)
    _gloveBoxCache = { userId: user.id, docs: updated }
    setDocs(updated)
    setSelectedDoc(null)
    setView('list')
  }

  if (view === 'detail' && selectedDoc) {
    return (
      <DocDetail
        doc={selectedDoc}
        onBack={() => { setSelectedDoc(null); setView('list') }}
        onDelete={() => handleDelete(selectedDoc)}
        getSignedUrl={() => getSignedUrlCached(selectedDoc)}
        onUpdate={async (updates) => {
          await supabase.from('glove_box')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', selectedDoc.id)
          await loadDocs()
          setSelectedDoc(prev => ({ ...prev, ...updates }))
        }}
      />
    )
  }

  if (view === 'add') {
    return (
      <AddDocView
        onBack={() => setView('list')}
        onSave={async () => { await loadDocs(); setView('list') }}
        user={user}
      />
    )
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div style={pageWrap}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <button onClick={onBack} style={backBtn}>←</button>
          <div style={{ flex: 1 }}>
            <div style={monoLabel}>Glove Box</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {docs.length} document{docs.length !== 1 ? 's' : ''} · Private + encrypted
            </div>
          </div>
          <button
            onClick={() => setView('add')}
            style={{
              background: 'var(--accent)', border: 'none', borderRadius: 8,
              padding: '6px 12px', color: '#fff', fontSize: 13, fontWeight: 500,
              fontFamily: 'var(--font-body)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 14, height: 14, position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search documents..."
            style={{ ...inputStyle, padding: '8px 12px 8px 30px' }}
          />
        </div>

        {/* Type filters */}
        <div style={{ display: 'flex', gap: 6, marginTop: 8, overflowX: 'auto', paddingBottom: 2 }}>
          {TYPE_FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id)}
              style={{
                padding: '4px 10px', borderRadius: 16,
                border: `1px solid ${typeFilter === f.id ? 'var(--accent)' : 'var(--border)'}`,
                background: typeFilter === f.id ? 'rgba(196,82,26,0.12)' : 'transparent',
                color: typeFilter === f.id ? 'var(--accent)' : 'var(--text-tertiary)',
                fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-tertiary)', fontSize: 14, lineHeight: 1.7 }}>
            {search
              ? `No documents matching "${search}"`
              : 'Nothing in the glove box yet.\nAdd permits, reservations, insurance cards, and more.'}
          </div>
        ) : (
          filteredDocs.map(doc => (
            <div
              key={doc.id}
              onClick={() => { setSelectedDoc(doc); setView('detail') }}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '12px 14px', marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              }}
            >
              <div style={iconBox}>{typeIcon(doc.type)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 500, color: 'var(--text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {doc.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 2, display: 'flex', gap: 8 }}>
                  <span style={{ textTransform: 'capitalize' }}>{doc.category || doc.type}</span>
                  {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                  <span>{new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </div>
              {(doc.is_secret || doc.is_sensitive) && (
                <svg viewBox="0 0 24 24" fill="none"
                  stroke={doc.is_secret ? 'var(--danger)' : 'var(--text-tertiary)'}
                  strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                  style={{ width: 12, height: 12, flexShrink: 0 }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              )}
              <IconChevron />
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Add doc view ──────────────────────────────────────────────────────────────

function AddDocView({ onBack, onSave, user }) {
  const [step, setStep]         = useState('type') // 'type' | 'form'
  const [docType, setDocType]   = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState(null)
  const fileInputRef            = useRef(null)

  const [title, setTitle]         = useState('')
  const [category, setCategory]   = useState('other')
  const [content, setContent]     = useState('')
  const [tags, setTags]           = useState('')
  const [file, setFile]           = useState(null)
  const [useMarkdown, setUseMarkdown] = useState(false)
  const [isSecret, setIsSecret] = useState(false)
  const [resDate, setResDate]           = useState('')
  const [resConfirmation, setResConfirmation] = useState('')
  const [resLocation, setResLocation]   = useState('')

  function handleFileSelect(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''))
  }

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return }
    setUploading(true)
    setError(null)
    try {
      let filePath = null, extractedText = null, fileSize = null, fileName = null

      if (file) {
        filePath = await uploadDocument(file, user.id)
        fileSize = file.size
        fileName = file.name

        if (file.type === 'application/pdf') {
          try {
            const { extractTextFromPDF } = await import('../utils/pdfProcessor')
            const { text } = await extractTextFromPDF(file)
            extractedText = text
          } catch (e) {
            console.warn('PDF extraction failed:', e)
          }
        } else if (file.type.startsWith('image/')) {
          try {
            extractedText = await analyzeImage(file)
          } catch (e) {
            console.warn('Image analysis failed:', e)
          }
        }
      }

      const metadata = {}
      if (docType === 'reservation') {
        if (resConfirmation) metadata.confirmation = resConfirmation
        if (resDate) metadata.date = resDate
        if (resLocation) metadata.location = resLocation
      }

      const { error: dbError } = await supabase.from('glove_box').insert({
        user_id:        user.id,
        title:          title.trim(),
        type:           file ? getFileType(file) : docType,
        category,
        content:        content || null,
        file_path:      filePath,
        file_size:      fileSize,
        file_name:      fileName,
        file_type:      file?.type || null,
        extracted_text: extractedText,
        tags:           tags.split(',').map(t => t.trim()).filter(Boolean),
        is_sensitive:   true,
        is_secret:      isSecret,
        metadata,
      })
      if (dbError) throw dbError
      onSave()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  // ── Type picker ──────────────────────────────────────────────────────────────
  if (step === 'type') {
    const types = [
      { id: 'pdf',         label: 'PDF document',   sub: 'Permits, insurance, forms',  icon: <IconPDF />         },
      { id: 'image',       label: 'Photo or image',  sub: 'Maps, QR codes, photos',     icon: <IconImage />       },
      { id: 'text',        label: 'Text note',       sub: 'Notes, codes, addresses',    icon: <IconText />        },
      { id: 'reservation', label: 'Reservation',     sub: 'Campsite, ferry, lodging',   icon: <IconReservation /> },
    ]
    return (
      <div style={pageWrap}>
        <div style={{ ...headerStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} style={backBtn}>←</button>
          <div style={monoLabel}>Add document</div>
        </div>
        <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            What are you adding?
          </div>
          {types.map(type => (
            <button
              key={type.id}
              onClick={() => {
                setDocType(type.id)
                setCategory(type.id === 'reservation' ? 'reservation' : 'other')
                setStep('form')
              }}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
                cursor: 'pointer', textAlign: 'left', width: '100%',
              }}
            >
              <div style={iconBox}>{type.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>{type.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{type.sub}</div>
              </div>
              <IconChevron />
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────────
  const formTitle = docType === 'reservation' ? 'Add reservation' : docType === 'text' ? 'Add note' : `Add ${docType}`
  const canSave   = title.trim() && !uploading

  return (
    <div style={pageWrap}>
      <div style={{ ...headerStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setStep('type')} style={backBtn}>←</button>
          <div style={monoLabel}>{formTitle}</div>
        </div>
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            background: canSave ? 'var(--accent)' : 'var(--border)',
            border: 'none', borderRadius: 8, padding: '6px 14px',
            color: canSave ? '#fff' : 'var(--text-tertiary)',
            fontSize: 13, fontWeight: 600, cursor: canSave ? 'pointer' : 'default',
          }}
        >
          {uploading ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && (
          <div style={{
            background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
            border: '1px solid var(--danger)',
            borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--danger)',
          }}>
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label style={labelStyle}>Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={
              docType === 'reservation' ? 'e.g. Harts Pass Campground — Night 2'
              : docType === 'text' ? 'e.g. Gate code — Forest Road 500'
              : 'Document title'
            }
            style={inputStyle}
          />
        </div>

        {/* Category chips */}
        <div>
          <label style={labelStyle}>Category</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                style={{
                  padding: '5px 10px', borderRadius: 16,
                  border: `1px solid ${category === cat.id ? 'var(--accent)' : 'var(--border)'}`,
                  background: category === cat.id ? 'rgba(196,82,26,0.12)' : 'transparent',
                  color: category === cat.id ? 'var(--accent)' : 'var(--text-tertiary)',
                  fontSize: 11, fontFamily: 'var(--font-body)', cursor: 'pointer',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* File upload */}
        {(docType === 'pdf' || docType === 'image') && (
          <div>
            <label style={labelStyle}>File</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${file ? 'var(--safe)' : 'var(--border)'}`,
                borderRadius: 10, padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
                background: file ? 'color-mix(in srgb, var(--safe) 8%, transparent)' : 'transparent',
              }}
            >
              {file ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--safe)', marginBottom: 4 }}>✓ {file.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {formatFileSize(file.size)} · Tap to change
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 4 }}>Tap to select file</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                    {docType === 'pdf' ? 'PDF up to 20 MB' : 'JPEG, PNG, HEIC up to 20 MB'}
                  </div>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={docType === 'pdf' ? 'application/pdf' : 'image/*'}
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {/* Reservation fields */}
        {docType === 'reservation' && (
          <>
            <div>
              <label style={labelStyle}>Confirmation number</label>
              <input value={resConfirmation} onChange={e => setResConfirmation(e.target.value)}
                placeholder="e.g. NRRS-12345678" style={monoInputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date</label>
              <input type="date" value={resDate} onChange={e => setResDate(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Location / site</label>
              <input value={resLocation} onChange={e => setResLocation(e.target.value)}
                placeholder="e.g. Harts Pass, Site 7" style={inputStyle} />
            </div>
          </>
        )}

        {/* Text / notes */}
        {(docType === 'text' || docType === 'reservation') && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                {docType === 'reservation' ? 'Notes' : 'Content'}
              </label>
              {docType === 'text' && (
                <button onClick={() => setUseMarkdown(m => !m)}
                  style={{ background: 'none', border: 'none', fontSize: 11, fontFamily: 'var(--font-mono)',
                    color: useMarkdown ? 'var(--accent)' : 'var(--text-tertiary)', cursor: 'pointer', padding: 0 }}>
                  {useMarkdown ? 'Markdown ON' : 'Markdown OFF'}
                </button>
              )}
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder={
                docType === 'reservation' ? 'Any additional notes…'
                : useMarkdown ? '# Heading\n**bold** _italic_\n- list item'
                : 'Gate code: 1234*\nCampsite GPS: 48.1234, -120.5678'
              }
              rows={6}
              style={{
                ...inputStyle,
                fontFamily: useMarkdown ? 'var(--font-mono)' : 'var(--font-body)',
                fontSize: 13, resize: 'vertical', lineHeight: 1.6,
              }}
            />
          </div>
        )}

        {/* Tags */}
        <div>
          <label style={labelStyle}>Tags (comma separated)</label>
          <input value={tags} onChange={e => setTags(e.target.value)}
            placeholder="e.g. methow, permit, 2026" style={inputStyle} />
        </div>

        {/* Security notice */}
        <div style={{
          background: 'color-mix(in srgb, var(--safe) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--safe) 30%, transparent)',
          borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 8,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--safe)" strokeWidth="1.75"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }}>
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            Stored in a private encrypted bucket. Only you can access these documents.
          </div>
        </div>

        {/* Secret toggle */}
        <div
          onClick={() => setIsSecret(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px', cursor: 'pointer',
            background: isSecret ? 'color-mix(in srgb, var(--danger) 8%, transparent)' : 'transparent',
            border: `1px solid ${isSecret ? 'color-mix(in srgb, var(--danger) 40%, transparent)' : 'var(--border)'}`,
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke={isSecret ? 'var(--danger)' : 'var(--text-tertiary)'}
              strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
              style={{ width: 14, height: 14, flexShrink: 0 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: isSecret ? 'var(--danger)' : 'var(--text-primary)' }}>Secret</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Hidden from Survival Agent and trip context</div>
            </div>
          </div>
          <div style={{ width: 36, height: 20, borderRadius: 10, background: isSecret ? 'var(--danger)' : 'var(--border)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: 2, left: isSecret ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Doc detail ────────────────────────────────────────────────────────────────

function DocDetail({ doc, onBack, onDelete, getSignedUrl, onUpdate }) {
  const { trips } = useAppStore()
  const [signedUrl, setSignedUrl]   = useState(null)
  const [loadingUrl, setLoadingUrl] = useState(false)
  const [editing, setEditing]       = useState(false)
  const [editTitle, setEditTitle]   = useState(doc.title)
  const [editContent, setEditContent] = useState(doc.content ?? '')
  const [editIsSecret, setEditIsSecret] = useState(doc.is_secret ?? false)
  const [showMarkdown, setShowMarkdown] = useState(true)
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    if (doc.file_path) {
      setLoadingUrl(true)
      getSignedUrl()
        .then(url => { setSignedUrl(url); setLoadingUrl(false) })
        .catch(() => setLoadingUrl(false))
    }
  }, [doc.id])

  async function handleSave() {
    setSaving(true)
    await onUpdate({ title: editTitle.trim(), content: editContent || null, is_secret: editIsSecret })
    setEditing(false)
    setSaving(false)
  }

  function renderMarkdown(text) {
    if (!text) return ''
    return text
      .replace(/^# (.+)$/gm,  '<h3 style="margin:8px 0 4px;font-size:15px;color:var(--text-primary)">$1</h3>')
      .replace(/^## (.+)$/gm, '<h4 style="margin:6px 0 3px;font-size:13px;color:var(--text-primary)">$1</h4>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.+?)_/g,       '<em>$1</em>')
      .replace(/^- (.+)$/gm,     '<div style="padding:2px 0">· $1</div>')
      .replace(/\n/g, '<br>')
  }

  return (
    <div style={pageWrap}>
      {/* Header */}
      <div style={{ ...headerStyle, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onBack} style={backBtn}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? (
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={{ ...inputStyle, padding: '4px 8px', fontSize: 14, fontWeight: 600, border: '1px solid var(--accent)' }}
            />
          ) : (
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {doc.title}
            </div>
          )}
          {doc.is_secret && (
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--danger)', background: 'color-mix(in srgb, var(--danger) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.08em', display: 'inline-block', marginTop: 1 }}>
              SECRET · OWNER ONLY
            </span>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 1, textTransform: 'capitalize' }}>
            {doc.category || doc.type} · {new Date(doc.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setEditTitle(doc.title); setEditContent(doc.content ?? '') }}
                style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '5px 10px', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              {(doc.type === 'text' || doc.type === 'reservation') && (
                <button onClick={() => setEditing(true)}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer' }}>
                  Edit
                </button>
              )}
              <button onClick={onDelete}
                style={{ background: 'transparent', border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)', borderRadius: 8, padding: '5px 10px', color: 'var(--danger)', fontSize: 12, cursor: 'pointer' }}>
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

        {/* Reservation metadata */}
        {doc.type === 'reservation' && doc.metadata && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
            {doc.metadata.confirmation && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>
                  Confirmation
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', letterSpacing: '0.06em' }}>
                  {doc.metadata.confirmation}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 24 }}>
              {doc.metadata.date && (
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Date</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {new Date(doc.metadata.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>
              )}
              {doc.metadata.location && (
                <div>
                  <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>Location</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{doc.metadata.location}</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PDF open link — no iframe (iframe auth interference breaks Supabase session) */}
        {doc.type === 'pdf' && (
          <div style={{ marginBottom: 16 }}>
            {loadingUrl ? (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                Loading secure document…
              </div>
            ) : signedUrl ? (
              <a href={signedUrl} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'var(--accent)', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-body)', textDecoration: 'none', marginBottom: 12 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Open {doc.file_name}
              </a>
            ) : (
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                Could not load document.
              </div>
            )}
          </div>
        )}

        {/* Image */}
        {doc.type === 'image' && signedUrl && (
          <div style={{ marginBottom: 16 }}>
            <img src={signedUrl} alt={doc.title}
              style={{ width: '100%', borderRadius: 12, border: '1px solid var(--border)', objectFit: 'contain', maxHeight: '60vh' }} />
          </div>
        )}

        {/* Text content */}
        {(doc.type === 'text' || doc.type === 'reservation') && doc.content && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
            {editing ? (
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                rows={8}
                style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none', resize: 'vertical', lineHeight: 1.7, boxSizing: 'border-box' }}
              />
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <button onClick={() => setShowMarkdown(m => !m)}
                    style={{ background: 'none', border: 'none', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0 }}>
                    {showMarkdown ? 'RAW' : 'RENDERED'}
                  </button>
                </div>
                {showMarkdown ? (
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.content) }} />
                ) : (
                  <pre style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                    {doc.content}
                  </pre>
                )}
              </>
            )}
          </div>
        )}

        {/* Secret toggle — edit mode */}
        {editing && (
          <div
            onClick={() => setEditIsSecret(s => !s)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 12px', cursor: 'pointer', marginBottom: 0,
              background: editIsSecret ? 'color-mix(in srgb, var(--danger) 8%, transparent)' : 'transparent',
              border: `1px solid ${editIsSecret ? 'color-mix(in srgb, var(--danger) 40%, transparent)' : 'var(--border)'}`,
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke={editIsSecret ? 'var(--danger)' : 'var(--text-tertiary)'}
                strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                style={{ width: 14, height: 14, flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: editIsSecret ? 'var(--danger)' : 'var(--text-primary)' }}>Secret</div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>Hidden from Survival Agent and trip context</div>
              </div>
            </div>
            <div style={{ width: 36, height: 20, borderRadius: 10, background: editIsSecret ? 'var(--danger)' : 'var(--border)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
              <div style={{ position: 'absolute', top: 2, left: editIsSecret ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </div>
          </div>
        )}

        {/* Extracted text preview */}
        {doc.extracted_text && !editing && (
          <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
              Extracted text (searchable)
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', lineHeight: 1.6, maxHeight: 120, overflow: 'hidden' }}>
              {doc.extracted_text.slice(0, 400)}{doc.extracted_text.length > 400 ? '…' : ''}
            </div>
          </div>
        )}

        {/* Tags */}
        {(doc.tags ?? []).length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {doc.tags.map((tag, i) => (
              <span key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '3px 10px', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* File info */}
        {doc.file_name && (
          <div style={{ padding: '10px 14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{doc.file_name}</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{formatFileSize(doc.file_size)}</span>
          </div>
        )}

        {/* Trip link */}
        {!doc.is_secret && !editing && trips.length > 0 && (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Trip</div>
            {doc.trip_id ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
                  {trips.find(t => t.id === doc.trip_id)?.name ?? 'Unknown trip'}
                </div>
                <button
                  onClick={async () => { await onUpdate({ trip_id: null }) }}
                  style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
                >
                  Detach
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 6 }}>Not linked to a trip</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 130, overflowY: 'auto' }}>
                  {trips.map(trip => (
                    <button
                      key={trip.id}
                      onClick={async () => { await onUpdate({ trip_id: trip.id }) }}
                      style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}
                    >
                      {trip.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
