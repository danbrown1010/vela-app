import { useState, useEffect, useRef } from 'react'
import { saveGearItem, getGearItems, deleteGearItem } from '../utils/gearStorage'
import { GEAR_CATEGORIES, PRESET_GEAR } from '../data/presetGear'
import { BrandLogo } from '../components/BrandLogo'
import { getVendorLogo, getStoreLogo } from '../utils/brandLogos'
import { ProGate } from '../components/ProGate'
import { IconTool, IconEdit, IconX, IconCheck, IconPlus, IconDownload, IconUpload, IconArrowLeft, IconSearch, IconTrash, IconExternalLink } from '../components/icons'

const CONDITIONS = ['good', 'worn', 'replace']

const CONDITION_COLORS = {
  good:    'var(--safe)',
  worn:    'var(--accent)',
  replace: 'var(--status-offline)',
}

const CONDITION_LABELS = {
  good:    'Good',
  worn:    'Worn',
  replace: 'Replace',
}

export default function GearRegistryPage({ onBack }) {
  const [items, setItems]               = useState([])
  const [activeTab, setActiveTab]       = useState('my-gear')
  const [activeCategory, setActiveCategory] = useState(GEAR_CATEGORIES[0])
  const [editingItem, setEditingItem]   = useState(null)
  const [searchQuery, setSearchQuery]   = useState('')
  const [myGearSearch, setMyGearSearch] = useState('')
  const [bulkMode, setBulkMode]         = useState('paste')
  const [collapsedCategories, setCollapsedCategories] = useState({})

  const [form, setForm] = useState({
    name: '',
    category: GEAR_CATEGORIES[0],
    quantity: 1,
    condition: 'good',
    notes: '',
    vendor: '',
    purchasedFrom: '',
    purchaseLink: '',
    onRig: false,
    includeInChecklist: false,
  })

  const loadItems = async () => {
    const gear = await getGearItems()
    setItems(gear)
  }

  useEffect(() => {
    setCollapsedCategories({})
    loadItems()
    // Retry after sync completes — catches the case where useSyncOnLogin
    // finishes populating IndexedDB after the initial mount render
    const timer = setTimeout(loadItems, 5000)
    return () => clearTimeout(timer)
  }, [])

  const handleSave = async () => {
    if (!form.name.trim()) return
    const item = {
      id: editingItem?.id ?? `gear-${Date.now()}`,
      ...form,
      name: form.name.trim(),
      updatedAt: new Date().toISOString(),
    }
    await saveGearItem(item)
    await loadItems()
    resetForm()
  }

  const handleAddPreset = async (preset, category) => {
    const exists = items.find(i => i.name === preset.name && i.category === category)
    if (exists) {
      await deleteGearItem(exists.id)
      await loadItems()
      return
    }
    const item = {
      id: `gear-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: preset.name,
      category,
      quantity: 1,
      condition: 'good',
      notes: preset.notes ?? '',
      onRig: true,
      includeInChecklist: true,
      updatedAt: new Date().toISOString(),
    }
    await saveGearItem(item)
    await loadItems()
  }

  const handleDelete = async (id) => {
    await deleteGearItem(id)
    await loadItems()
  }

  const handleDeleteCategory = async (category, catItems) => {
    if (!window.confirm(`Delete all ${catItems.length} item${catItems.length !== 1 ? 's' : ''} in ${category}?`)) return
    for (const item of catItems) await deleteGearItem(item.id)
    await loadItems()
  }

  const handleEdit = (item) => {
    setForm({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      condition: item.condition,
      notes: item.notes ?? '',
      vendor: item.vendor ?? '',
      purchasedFrom: item.purchasedFrom ?? '',
      purchaseLink: item.purchaseLink ?? '',
      onRig: item.onRig,
      includeInChecklist: item.includeInChecklist,
    })
    setEditingItem(item)
    setActiveTab('add')
  }

  const resetForm = () => {
    setForm({ name: '', category: GEAR_CATEGORIES[0], quantity: 1, condition: 'good', notes: '', vendor: '', purchasedFrom: '', purchaseLink: '', onRig: false, includeInChecklist: false })
    setEditingItem(null)
    setActiveTab('my-gear')
  }

  const toggleCategory = (category) => {
    setCollapsedCategories(prev => ({ ...prev, [category]: !prev[category] }))
  }

  const gearByCategory = {}
  items.forEach(item => {
    if (!gearByCategory[item.category]) gearByCategory[item.category] = []
    gearByCategory[item.category].push(item)
  })

  const filteredGearByCategory = {}
  Object.entries(gearByCategory).forEach(([category, catItems]) => {
    const filtered = myGearSearch
      ? catItems.filter(item =>
          item.name.toLowerCase().includes(myGearSearch.toLowerCase()) ||
          item.vendor?.toLowerCase().includes(myGearSearch.toLowerCase()) ||
          item.notes?.toLowerCase().includes(myGearSearch.toLowerCase()) ||
          category.toLowerCase().includes(myGearSearch.toLowerCase())
        )
      : catItems
    if (filtered.length > 0) filteredGearByCategory[category] = filtered
  })

  const filteredPresets = searchQuery
    ? Object.entries(PRESET_GEAR).reduce((acc, [cat, presets]) => {
        const matches = presets.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
        if (matches.length > 0) acc[cat] = matches
        return acc
      }, {})
    : { [activeCategory]: PRESET_GEAR[activeCategory] ?? [] }

  const isAdded = (name, category) => items.some(i => i.name === name && i.category === category)

  const totalItems = items.length
  const needsAttention = items.filter(i => i.condition !== 'good').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px 0', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={onBack} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconArrowLeft style={{ width: 20, height: 20 }} />
            </button>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                Gear Registry
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                {totalItems} items{needsAttention > 0 ? ` · ${needsAttention} need attention` : ''}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setBulkMode('paste'); setActiveTab('bulk') }}
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 12px', color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer' }}
            >
              Bulk add
            </button>
            <button
              onClick={() => { setEditingItem(null); setForm({ name: '', category: GEAR_CATEGORIES[0], quantity: 1, condition: 'good', notes: '', vendor: '', purchasedFrom: '', purchaseLink: '', onRig: false, includeInChecklist: false }); setActiveTab('add') }}
              style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '7px 14px', color: '#fff', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 600, cursor: 'pointer' }}
            >
              + Add
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: -1 }}>
          {[{ id: 'my-gear', label: 'My Gear' }, { id: 'browse', label: 'Browse' }, { id: 'bulk', label: 'Bulk add' }].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px', background: 'none', border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-tertiary)',
                fontSize: 13, fontFamily: 'var(--font-body)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MY GEAR TAB */}
      {activeTab === 'my-gear' && (
        <>
          {/* Search bar */}
          <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
              <IconSearch style={{ position: 'absolute', left: 12, width: 14, height: 14, color: 'var(--text-tertiary)' }} />
              <input
                value={myGearSearch}
                onChange={e => {
                  setMyGearSearch(e.target.value)
                  if (e.target.value) setCollapsedCategories({})
                }}
                placeholder="Search your gear..."
                style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 14px 8px 34px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
              {myGearSearch && (
                <button onClick={() => setMyGearSearch('')} style={{ position: 'absolute', right: 10, background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}><IconX size={14} /></button>
              )}
            </div>
            {items.length > 0 && (() => {
              const cats = Object.keys(gearByCategory)
              const allCollapsed = cats.every(c => collapsedCategories[c])
              return (
                <button
                  onClick={() => {
                    if (allCollapsed) {
                      setCollapsedCategories({})
                    } else {
                      const c = {}; cats.forEach(cat => { c[cat] = true }); setCollapsedCategories(c)
                    }
                  }}
                  style={{ marginTop: 8, background: 'none', border: 'none', padding: 0, color: 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', letterSpacing: '0.04em' }}
                >
                  {allCollapsed ? '▸ Expand all' : '▾ Collapse all'}
                </button>
              )
            })()}
          </div>

          {/* Stats bar */}
          {items.length > 0 && (
            <div style={{ display: 'flex', gap: 0, padding: '10px 16px 0', flexShrink: 0 }}>
              {[
                { label: 'Items', value: totalItems },
                { label: 'Categories', value: Object.keys(gearByCategory).length },
                { label: 'On rig', value: items.filter(i => i.onRig).length },
                { label: 'Need attention', value: needsAttention },
              ].map((stat, i, arr) => (
                <div key={stat.label} style={{ flex: 1, textAlign: 'center', padding: '8px 4px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderLeft: i > 0 ? 'none' : '1px solid var(--border)', borderRadius: i === 0 ? '10px 0 0 10px' : i === arr.length - 1 ? '0 10px 10px 0' : 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)', color: stat.label === 'Need attention' && stat.value > 0 ? 'var(--accent)' : 'var(--text-primary)' }}>{stat.value}</div>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
            {items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 24px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.8 }}>
                <div style={{ marginBottom: 12, color: 'var(--text-tertiary)', display: 'flex', justifyContent: 'center' }}><IconTool size={40} /></div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>No gear added yet</div>
                Browse presets or add custom items.<br />
                Your gear feeds into the Survival Agent for better advice.
              </div>
            ) : Object.keys(filteredGearByCategory).length === 0 && myGearSearch ? (
              <div style={{ textAlign: 'center', padding: '40px 24px', color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
                No gear matching "{myGearSearch}"
              </div>
            ) : (
              Object.entries(filteredGearByCategory).map(([category, catItems]) => (
                <div key={category} style={{ marginBottom: collapsedCategories[category] ? 12 : 20 }}>
                  {/* Collapsible category header */}
                  <div
                    onClick={() => toggleCategory(category)}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '4px 2px', marginBottom: collapsedCategories[category] ? 0 : 8, userSelect: 'none' }}
                  >
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {category}
                      <span style={{ marginLeft: 6, color: 'var(--text-tertiary)', fontWeight: 400 }}>{catItems.length}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {catItems.some(i => i.condition === 'replace') && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--danger)' }} />
                      )}
                      {catItems.some(i => i.condition === 'worn') && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteCategory(category, catItems) }}
                        style={{ background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', lineHeight: 1 }}
                      >
                        <IconTrash style={{ width: 12, height: 12 }} />
                      </button>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', transform: collapsedCategories[category] ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>▾</div>
                    </div>
                  </div>

                  {/* Collapsible item list */}
                  {!collapsedCategories[category] && (
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      {catItems.map((item, i) => (
                        <div key={item.id} data-testid="gear-item" style={{ padding: '10px 14px', borderBottom: i < catItems.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: CONDITION_COLORS[item.condition], flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                              {item.name}
                              {item.quantity > 1 && (
                                <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 5, fontFamily: 'var(--font-mono)' }}>×{item.quantity}</span>
                              )}
                            </div>
                            {item.notes ? (
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 1 }}>{item.notes}</div>
                            ) : null}
                            {(item.vendor || item.purchasedFrom || item.purchaseLink) && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                                {item.vendor && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <BrandLogo url={getVendorLogo(item.vendor)} name={item.vendor} size={13} />
                                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>{item.vendor}</span>
                                  </div>
                                )}
                                {item.purchasedFrom && item.purchasedFrom !== 'Other' && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <span style={{ fontSize: 10, color: 'var(--border)', fontFamily: 'var(--font-mono)' }}>·</span>
                                    <BrandLogo url={getStoreLogo(item.purchasedFrom)} name={item.purchasedFrom} size={13} />
                                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)' }}>{item.purchasedFrom}</span>
                                  </div>
                                )}
                                {item.purchaseLink && (
                                  <a href={item.purchaseLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: 'var(--accent)', textDecoration: 'none', fontFamily: 'var(--font-body)' }}>
                                    <IconExternalLink style={{ width: 9, height: 9 }} />
                                    View
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                          {item.condition !== 'good' && (
                            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700, color: CONDITION_COLORS[item.condition], border: `1px solid ${CONDITION_COLORS[item.condition]}`, borderRadius: 8, padding: '2px 6px', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              {CONDITION_LABELS[item.condition]}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <button onClick={() => handleEdit(item)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}><IconEdit size={14} /></button>
                            <button onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', color: 'var(--status-offline)', cursor: 'pointer', padding: '2px 4px', display: 'flex', alignItems: 'center' }}><IconX size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* BROWSE TAB */}
      {activeTab === 'browse' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search gear…"
              style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '8px 14px', color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
            {/* Category sidebar — hidden while searching */}
            {!searchQuery && (
              <div style={{ width: 110, flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
                {GEAR_CATEGORIES.map(cat => {
                  const addedCount = items.filter(i => i.category === cat).length
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      style={{ width: '100%', padding: '10px', background: activeCategory === cat ? 'var(--bg-card)' : 'transparent', border: 'none', borderLeft: activeCategory === cat ? '2px solid var(--accent)' : '2px solid transparent', color: activeCategory === cat ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 11, fontFamily: 'var(--font-body)', fontWeight: activeCategory === cat ? 600 : 400, cursor: 'pointer', textAlign: 'left', lineHeight: 1.3 }}
                    >
                      {cat}
                      {addedCount > 0 && (
                        <span style={{ display: 'block', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--safe)', marginTop: 2 }}>{addedCount} added</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Preset list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 12, paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' }}>
              {Object.entries(filteredPresets).map(([cat, presets]) => (
                <div key={cat}>
                  {searchQuery && (
                    <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, marginTop: 8 }}>{cat}</div>
                  )}
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 8 }}>
                    {presets.map((preset, i) => {
                      const added = isAdded(preset.name, cat)
                      return (
                        <div
                          key={preset.name}
                          onClick={() => handleAddPreset(preset, cat)}
                          style={{ padding: '10px 14px', borderBottom: i < presets.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: added ? 'rgba(74,124,63,0.08)' : 'transparent' }}
                        >
                          <div style={{ width: 22, height: 22, borderRadius: '50%', border: `1.5px solid ${added ? 'var(--safe)' : 'var(--border)'}`, background: added ? 'var(--safe)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12, color: '#fff', fontWeight: 700 }}>
                            {added ? <IconCheck size={12} /> : <IconPlus size={12} style={{ color: 'var(--text-tertiary)' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{preset.name}</div>
                            {preset.notes ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 1 }}>{preset.notes}</div> : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BULK TAB */}
      {activeTab === 'bulk' && (
        <ProGate feature="Bulk gear import">
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Sub-tab switcher */}
          <div style={{ display: 'flex', gap: 0, padding: '8px 16px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
            {[{ id: 'paste', label: 'Paste list' }, { id: 'csv', label: 'Import CSV' }].map(sub => (
              <button
                key={sub.id}
                onClick={() => setBulkMode(sub.id)}
                style={{ padding: '6px 14px', background: 'none', border: 'none', borderBottom: bulkMode === sub.id ? '2px solid var(--accent)' : '2px solid transparent', color: bulkMode === sub.id ? 'var(--accent)' : 'var(--text-tertiary)', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: bulkMode === sub.id ? 600 : 400, cursor: 'pointer' }}
              >
                {sub.label}
              </button>
            ))}
          </div>

          {bulkMode === 'paste' && (
            <PasteListView
              categories={GEAR_CATEGORIES}
              onSave={async (parsed) => {
                for (const item of parsed) await saveGearItem(item)
                await loadItems()
                setActiveTab('my-gear')
              }}
              onCancel={() => setActiveTab('my-gear')}
            />
          )}
          {bulkMode === 'csv' && (
            <CSVImportView
              categories={GEAR_CATEGORIES}
              onSave={async (parsed) => {
                for (const item of parsed) await saveGearItem(item)
                await loadItems()
                setActiveTab('my-gear')
              }}
              onCancel={() => setActiveTab('my-gear')}
            />
          )}
        </div>
        </ProGate>
      )}

      {/* ADD / EDIT FORM */}
      {activeTab === 'add' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', marginBottom: 20 }}>
            {editingItem ? 'Edit item' : 'Add custom item'}
          </div>

          {/* Name */}
          <FormField label="Item name">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Hi-Lift Jack" style={inputStyle} />
          </FormField>

          {/* Category */}
          <FormField label="Category">
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
              {GEAR_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </FormField>

          {/* Quantity */}
          <FormField label="Quantity">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button onClick={() => setForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))} style={stepBtn}>−</button>
              <span style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', minWidth: 28, textAlign: 'center' }}>{form.quantity}</span>
              <button onClick={() => setForm(f => ({ ...f, quantity: f.quantity + 1 }))} style={stepBtn}>+</button>
            </div>
          </FormField>

          {/* Condition */}
          <FormField label="Condition">
            <div style={{ display: 'flex', gap: 8 }}>
              {CONDITIONS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, condition: c }))}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, border: `1px solid ${form.condition === c ? CONDITION_COLORS[c] : 'var(--border)'}`, background: form.condition === c ? `${CONDITION_COLORS[c]}22` : 'var(--bg-card)', color: form.condition === c ? CONDITION_COLORS[c] : 'var(--text-tertiary)', fontSize: 12, fontFamily: 'var(--font-body)', fontWeight: form.condition === c ? 600 : 400, cursor: 'pointer' }}
                >
                  {CONDITION_LABELS[c]}
                </button>
              ))}
            </div>
          </FormField>

          {/* Notes */}
          <FormField label="Notes (optional)">
            <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Location, brand, details…" style={inputStyle} />
          </FormField>

          {/* Vendor */}
          <FormField label="Vendor (optional)">
            <input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="e.g. EcoFlow, Nikon, REI" style={inputStyle} />
          </FormField>

          {/* Purchased from */}
          <FormField label="Purchased from (optional)">
            <input value={form.purchasedFrom} onChange={e => setForm(f => ({ ...f, purchasedFrom: e.target.value }))} placeholder="e.g. REI, Amazon, Costco" style={inputStyle} />
          </FormField>

          {/* Purchase link */}
          <FormField label="Purchase link (optional)">
            <input type="url" value={form.purchaseLink} onChange={e => setForm(f => ({ ...f, purchaseLink: e.target.value }))} placeholder="https://…" style={inputStyle} />
          </FormField>

          {/* Toggles */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
            {[
              { key: 'onRig', label: 'Currently on rig', sub: 'Item is loaded in Chomp' },
              { key: 'includeInChecklist', label: 'Add to pre-trip checklist', sub: 'Remind me to pack this item' },
            ].map((toggle, i) => (
              <div key={toggle.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderBottom: i === 0 ? '1px solid var(--border)' : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>{toggle.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-body)', marginTop: 1 }}>{toggle.sub}</div>
                </div>
                <div onClick={() => setForm(f => ({ ...f, [toggle.key]: !f[toggle.key] }))} style={{ width: 44, height: 26, borderRadius: 13, background: form[toggle.key] ? 'var(--accent)' : 'var(--border)', position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 3, left: form[toggle.key] ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={resetForm} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name.trim()}
              style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: form.name.trim() ? 'var(--accent)' : 'var(--border)', color: form.name.trim() ? '#fff' : 'var(--text-tertiary)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: form.name.trim() ? 'pointer' : 'default' }}
            >
              {editingItem ? 'Save changes' : 'Add to registry'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Shared form primitives ────────────────────────────────────────────────────

function FormField({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '10px 12px', color: 'var(--text-primary)',
  fontFamily: 'var(--font-body)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
}

const stepBtn = {
  width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)',
  background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 18,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
}

// ─── Category guesser ─────────────────────────────────────────────────────────

function guessCategoryFromName(name) {
  const n = name.toLowerCase()
  if (/maxtrax|hi.?lift|kinetic|winch|snatch|shackle|tow.?strap|come.?along|recovery|traction|shovel/.test(n)) return 'Recovery'
  if (/gps|garmin|inreach|compass|map|atlas|navigation|onx|gaia/.test(n)) return 'Navigation'
  if (/radio|gmrs|ham|cb|starlink|satellite|walkie|communication|comms/.test(n)) return 'Communication'
  if (/first.?aid|medical|trauma|tourniquet|splint|bandage|medication|epinephrine|blister/.test(n)) return 'Medical'
  if (/socket|wrench|tire|compressor|jumper|jump.?start|duct.?tape|zip.?tie|fuse|belt|coolant|fluid|multi.?tool|axe|hatchet|saw/.test(n)) return 'Tools & Spares'
  if (/oil|wd.?40|electrical.?tape|bailing.?wire/.test(n)) return 'Tools & Spares'
  if (/sleeping|pillow|chair|table|headlamp|lantern|tarp|awning|bear|ursa/.test(n)) return 'Camp & Sleep'
  if (/water|filter|purif|sawyer|steripen|hydrat/.test(n)) return 'Water'
  if (/ecoflow|solar|inverter|alternator|charger|usb.?hub/.test(n)) return 'Power'
  if (/battery|power.?station/.test(n)) return 'Power'
  if (/stove|propane|cast.?iron|skillet|pot|pan|coffee|cooler|yeti|cutting.?board|utensil|plate|bowl|mug|dish/.test(n)) return 'Cooking'
  if (/camera|nikon|canon|sony|drone|dji|insta360|lens|sd.?card|laptop|tripod|gopro|gorilla.?pod/.test(n)) return 'Camera & Media'
  if (/extinguisher|whistle|flare|poncho|knife|lighter|fire.?start|paracord|glow/.test(n)) return 'Safety'
  if (/rain|jacket|layer|hat|glove|sunscreen|bug|sunglass|boot|shoe|toiletri|trowel/.test(n)) return 'Clothing & Personal'
  return 'Tools & Spares'
}

// ─── ReviewList — shared between paste and CSV ────────────────────────────────

function ReviewList({ parsed, setParsed, categories, onBack, onSave, backLabel = '← Back', saveLabel }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 16, paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', marginBottom: 12 }}>
        {parsed.length} items found. Tap a category to change it.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {parsed.map((item, idx) => (
          <div key={item.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
                {item.name}
                {item.quantity > 1 && <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 5, fontFamily: 'var(--font-mono)' }}>×{item.quantity}</span>}
              </div>
              {item.notes ? <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{item.notes}</div> : null}
            </div>
            <select
              value={item.category}
              onChange={e => { const u = [...parsed]; u[idx] = { ...item, category: e.target.value }; setParsed(u) }}
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, padding: '3px 6px', color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 11, outline: 'none', maxWidth: 110 }}
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <button onClick={() => setParsed(parsed.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px', flexShrink: 0, display: 'flex', alignItems: 'center' }}><IconX size={16} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onBack} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>{backLabel}</button>
        <button onClick={() => onSave(parsed)} disabled={parsed.length === 0} style={{ flex: 2, padding: '12px', borderRadius: 10, border: 'none', background: parsed.length > 0 ? 'var(--accent)' : 'var(--border)', color: parsed.length > 0 ? '#fff' : 'var(--text-tertiary)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: parsed.length > 0 ? 'pointer' : 'default' }}>
          {saveLabel ?? `Add ${parsed.length} items →`}
        </button>
      </div>
    </div>
  )
}

// ─── PasteListView ────────────────────────────────────────────────────────────

function PasteListView({ categories, onSave, onCancel }) {
  const [text, setText]   = useState('')
  const [parsed, setParsed] = useState([])
  const [step, setStep]   = useState('input')

  const parseLine = (line) => {
    let name = line.trim()
    let quantity = 1
    let notes = ''
    let vendor = ''
    let purchasedFrom = ''

    // 1. Extract purchasedFrom: "- purchased REI" or "· purchased Amazon" at end
    const purchasedMatch = name.match(/\s*[-·]\s*purchased\s+(.+)$/i)
    if (purchasedMatch) {
      purchasedFrom = purchasedMatch[1].trim()
      name = name.slice(0, purchasedMatch.index).trim()
    }

    // 2. Extract notes after " - " (not purchased)
    const notesMatch = name.match(/\s+-\s+(?!purchased)(.+)$/)
    if (notesMatch) {
      notes = notesMatch[1].trim()
      name = name.slice(0, notesMatch.index).trim()
    }

    // 3. Extract vendor in [brackets]
    const vendorMatch = name.match(/\s*\[([^\]]+)\]/)
    if (vendorMatch) {
      vendor = vendorMatch[1].trim()
      name = name.replace(vendorMatch[0], '').trim()
    }

    // 4. Extract quantity "x2" or "(x2)" at END — after vendor/notes stripped
    const qtyEndMatch = name.match(/\s+x(\d+)$|\s+\(x(\d+)\)$/i)
    if (qtyEndMatch) {
      quantity = parseInt(qtyEndMatch[1] || qtyEndMatch[2])
      name = name.slice(0, qtyEndMatch.index).trim()
    }

    // 5. Extract quantity "2x " at START
    const qtyStartMatch = name.match(/^(\d+)x\s+/i)
    if (qtyStartMatch) {
      quantity = parseInt(qtyStartMatch[1])
      name = name.slice(qtyStartMatch[0].length).trim()
    }

    return {
      id: `gear-bulk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name,
      quantity,
      category: guessCategoryFromName(name),
      condition: 'good',
      notes,
      vendor,
      purchasedFrom,
      purchaseLink: '',
      onRig: false,
      includeInChecklist: false,
      updatedAt: new Date().toISOString(),
    }
  }

  const parseText = () => {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
    const result = lines.map(parseLine)
    setParsed(result)
    setStep('review')
  }

  if (step === 'review') {
    return (
      <ReviewList
        parsed={parsed}
        setParsed={setParsed}
        categories={categories}
        onBack={() => setStep('input')}
        onSave={onSave}
      />
    )
  }

  return (
    <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
        One item per line. Supports quantities and notes:
      </div>
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 2 }}>
        <div>MaxTrax MKII x2</div>
        <div>Hi-Lift Jack 48" - rear bumper</div>
        <div>2x Kinetic rope</div>
        <div>ARB air compressor · under hood</div>
        <div>First aid kit</div>
      </div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={'Paste your gear list here…\n\nMaxTrax MKII x2\nHi-Lift Jack 48"\nKinetic rope 30ft\nARB compressor'}
        rows={10}
        style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.7 }}
      />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Cancel</button>
        <button onClick={parseText} disabled={!text.trim()} style={{ flex: 2, padding: '13px', borderRadius: 10, border: 'none', background: text.trim() ? 'var(--accent)' : 'var(--border)', color: text.trim() ? '#fff' : 'var(--text-tertiary)', fontSize: 14, fontWeight: 600, fontFamily: 'var(--font-body)', cursor: text.trim() ? 'pointer' : 'default' }}>
          Parse list →
        </button>
      </div>
    </div>
  )
}

// ─── CSVImportView ────────────────────────────────────────────────────────────

function CSVImportView({ categories, onSave, onCancel }) {
  const [parsed, setParsed] = useState([])
  const [step, setStep]     = useState('upload')
  const [error, setError]   = useState(null)
  const fileRef = useRef(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const lines = evt.target.result.split('\n').map(l => l.trim()).filter(Boolean)
        const firstLine = lines[0].toLowerCase()
        const hasHeader = firstLine.includes('name') || firstLine.includes('item') || firstLine.includes('gear')
        const dataLines = hasHeader ? lines.slice(1) : lines

        const result = dataLines.map(line => {
          const cols = (line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g) ?? []).map(c => c.replace(/^"|"$/g, '').trim())
          const name = cols[0] ?? ''
          const category = categories.includes(cols[1]) ? cols[1] : guessCategoryFromName(name)
          const quantity = parseInt(cols[2]) || 1
          const condition = ['good', 'worn', 'replace'].includes((cols[3] ?? '').toLowerCase()) ? cols[3].toLowerCase() : 'good'
          const notes = cols[4] ?? ''
          const vendor = cols[5] ?? ''
          const purchasedFrom = cols[6] ?? ''
          const purchaseLink = cols[7] ?? ''
          return { id: `gear-csv-${Date.now()}-${Math.random().toString(36).slice(2)}`, name, category, quantity, condition, notes, vendor, purchasedFrom, purchaseLink, onRig: false, includeInChecklist: false, updatedAt: new Date().toISOString() }
        }).filter(i => i.name.length > 0)

        setParsed(result)
        setStep('review')
      } catch (err) {
        setError(`Failed to parse CSV: ${err.message}`)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const downloadTemplate = () => {
    const csv = ['name,category,quantity,condition,notes,vendor,purchasedFrom,purchaseLink', 'MaxTrax MKII,Recovery,2,good,rear door,MaxTrax,Amazon,', 'Hi-Lift Jack,Recovery,1,good,48 inch,Hi-Lift,REI,', 'Kinetic rope,Recovery,1,good,30ft,Bubba Rope,,', 'Garmin inReach Mini,Navigation,1,good,,Garmin,REI,', 'First Aid Kit,Medical,1,good,Adventure Medical,Adventure Medical,Amazon,'].join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'vela-gear-template.csv' })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (step === 'review') {
    return (
      <ReviewList
        parsed={parsed}
        setParsed={setParsed}
        categories={categories}
        onBack={() => { setStep('upload'); setParsed([]) }}
        onSave={onSave}
        saveLabel={`Import ${parsed.length} items →`}
      />
    )
  }

  return (
    <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', lineHeight: 1.6 }}>
        Upload a CSV file. Columns: <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>name, category, quantity, condition, notes, vendor, purchasedFrom, purchaseLink</span>. Header row optional.
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 2, overflowX: 'auto' }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: 2 }}>name,category,qty,condition,notes,vendor,purchasedFrom,link</div>
        <div>MaxTrax MKII,Recovery,2,good,rear door,MaxTrax,Amazon,</div>
        <div>Hi-Lift Jack,Recovery,1,worn,48 inch,Hi-Lift,REI,</div>
        <div>Garmin inReach,Navigation,1,good,,Garmin,REI,</div>
      </div>

      <button onClick={downloadTemplate} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 13, fontFamily: 'var(--font-body)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
        <IconDownload size={16} /> Download CSV template
      </button>

      <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '14px', borderRadius: 10, border: '2px dashed var(--border)', background: 'transparent', color: 'var(--accent)', fontSize: 14, fontFamily: 'var(--font-body)', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <IconUpload size={18} />
        Upload CSV file
      </button>
      <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ display: 'none' }} />

      {error && (
        <div style={{ fontSize: 13, color: '#ef4444', fontFamily: 'var(--font-body)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 12px' }}>{error}</div>
      )}

      <button onClick={onCancel} style={{ padding: '12px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, fontFamily: 'var(--font-body)', cursor: 'pointer' }}>Cancel</button>
    </div>
  )
}
