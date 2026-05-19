import { useState, useEffect, useCallback } from 'react'
import CryptoJS from 'crypto-js'

const ACCESS_KEY = import.meta.env.VITE_ECOFLOW_ACCESS_KEY
const SECRET_KEY = import.meta.env.VITE_ECOFLOW_SECRET_KEY
const BASE_URL   = 'https://api.ecoflow.com/iot-open/sign/device/quota/all'

function generateSignature(sn, accessKey, nonce, timestamp, secretKey) {
  // Query params first, then auth headers — EcoFlow Open API signing format
  const str = `sn=${sn}&accessKey=${accessKey}&nonce=${nonce}&timestamp=${timestamp}`
  return CryptoJS.HmacSHA256(str, secretKey).toString(CryptoJS.enc.Hex)
}

export function useEcoFlow(serialNumber) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchData = useCallback(async () => {
    if (!serialNumber) return
    try {
      const timestamp = Date.now().toString()
      const nonce     = Math.random().toString(36).substring(2, 15)
      const sign      = generateSignature(serialNumber, ACCESS_KEY, nonce, timestamp, SECRET_KEY)

      const response = await fetch(`${BASE_URL}?sn=${serialNumber}`, {
        headers: { accessKey: ACCESS_KEY, timestamp, nonce, sign },
      })

      const result = await response.json()

      if (result.code === '0' && result.data) {
        const d = result.data

        const usb1  = d['pd.usb1Watts']    ?? 0
        const usb2  = d['pd.usb2Watts']    ?? 0
        const qc1   = d['pd.qcUsb1Watts']  ?? 0
        const qc2   = d['pd.qcUsb2Watts']  ?? 0
        const tc1   = d['pd.typec1Watts']  ?? 0
        const tc2   = d['pd.typec2Watts']  ?? 0

        setData({
          // Core
          soc:             d['pd.soc']              ?? d['bms_bmsStatus.soc'],
          remainTime:      d['pd.remainTime']        ?? d['bms_bmsStatus.remainTime'],
          temp:            d['bms_bmsStatus.temp'],
          cycles:          d['bms_bmsStatus.cycles'],
          totalCapacity:   d['bms_bmsStatus.fullCap'],

          // Input breakdown
          acInputWatts:    d['inv.acInWatts']        ?? d['inv.inputWatts']  ?? 0,
          dcInputWatts:    d['mppt.inWatts']         ?? d['pd.carWatts']     ?? 0,
          solarWatts:      d['mppt.inWatts']         ?? 0,
          alternatorWatts: 0, // mppt.dcChgCurrent is milliamps, not watts — no reliable watts field yet
          totalInputWatts: d['pd.wattsInSum']        ?? 0,

          // Output breakdown
          acOutputWatts:   d['inv.outputWatts']      ?? 0,
          dcOutputWatts:   d['mppt.outWatts']        ?? d['pd.carWatts']     ?? 0,
          usbOutputWatts:  usb1 + usb2 + qc1 + qc2 + tc1 + tc2,
          totalOutputWatts: d['pd.wattsOutSum']      ?? 0,

          // Port states
          acEnabled:       d['inv.cfgAcEnabled']     === 1,
          dcEnabled:       (d['pd.carState']         ?? d['mppt.carState'])  === 1,
          usbEnabled:      d['pd.dcOutState']        === 1,
        })
        setLastUpdated(new Date())
        setError(null)
      } else {
        setError(result.message ?? 'No data')
      }
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }, [serialNumber])

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [fetchData])

  useEffect(() => {
    const handler = () => fetchData()
    window.addEventListener('ecoflow:refresh-all', handler)
    return () => window.removeEventListener('ecoflow:refresh-all', handler)
  }, [fetchData])

  return { data, loading, error, lastUpdated, refetch: fetchData }
}
