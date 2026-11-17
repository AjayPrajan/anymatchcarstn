import "server-only"
import { readFileSync } from "node:fs"
import path from "node:path"

export type CarListing = {
  listingId: string
  ownerName: string
  ownerType: string
  brand: string
  carName: string
  year: number
  fuel: string
  transmission: string
  km: number
  engineCc: number
  mileage: number
  seats: number
  color: string
  registration: string
  city: string
  state: string
  insurance: string
  serviceHistory: string
  accident: string
  price: number
  listedDate: string
}

export type BuyerRequirements = {
  budgetMin: number
  budgetMax: number
  brand: string
  model: string
  fuel: string
  transmission: string
  minSeats: number
  maxKm: number
  minYear: number
  city: string
  accidentFree: boolean
  insuranceValid: boolean
  notes: string
}

export type PriceSignals = {
  daysListed: number
  comparableMedian: number | null
  comparableCount: number
  priceVsMarketPct: number | null
}

export type Candidate = CarListing & { score: number; signals: PriceSignals }

let cache: CarListing[] | null = null

export function getCars(): CarListing[] {
  if (cache) return cache
  const raw = readFileSync(path.join(process.cwd(), "data", "cars.csv"), "utf8")
  const lines = raw.trim().split(/\r?\n/).slice(1)
  cache = lines.map((line) => {
    const c = line.split(",")
    return {
      listingId: c[0],
      ownerName: c[1],
      ownerType: c[2],
      brand: c[3],
      carName: c[4],
      year: Number(c[5]),
      fuel: c[6],
      transmission: c[7],
      km: Number(c[8]),
      engineCc: Number(c[9]),
      mileage: Number(c[10]),
      seats: Number(c[11]),
      color: c[12],
      registration: c[13],
      city: c[14],
      state: c[15],
      insurance: c[16],
      serviceHistory: c[17],
      accident: c[18],
      price: Number(c[19]),
      listedDate: c[20],
    }
  })
  return cache
}

export function getFilterOptions() {
  const cars = getCars()
  const uniq = (vals: string[]) => [...new Set(vals)].sort()
  const modelsByBrand: Record<string, string[]> = {}
  for (const car of cars) {
    modelsByBrand[car.brand] ??= []
    if (!modelsByBrand[car.brand].includes(car.carName)) modelsByBrand[car.brand].push(car.carName)
  }
  for (const b of Object.keys(modelsByBrand)) modelsByBrand[b].sort()
  const prices = cars.map((c) => c.price)
  return {
    total: cars.length,
    brands: uniq(cars.map((c) => c.brand)),
    modelsByBrand,
    cities: uniq(cars.map((c) => c.city)),
    fuels: uniq(cars.map((c) => c.fuel)),
    transmissions: uniq(cars.map((c) => c.transmission)),
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minYear: Math.min(...cars.map((c) => c.year)),
    maxYear: Math.max(...cars.map((c) => c.year)),
  }
}

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const DAY = 86_400_000

function priceSignals(car: CarListing, all: CarListing[], today: Date): PriceSignals {
  const daysListed = Math.max(0, Math.round((today.getTime() - new Date(car.listedDate).getTime()) / DAY))
  const comps = all.filter(
    (c) => c.listingId !== car.listingId && c.carName === car.carName && c.brand === car.brand && Math.abs(c.year - car.year) <= 1,
  )
  if (comps.length < 2) return { daysListed, comparableMedian: null, comparableCount: comps.length, priceVsMarketPct: null }
  const med = median(comps.map((c) => c.price))
  return {
    daysListed,
    comparableMedian: Math.round(med),
    comparableCount: comps.length,
    priceVsMarketPct: Math.round(((car.price - med) / med) * 1000) / 10,
  }
}

export function findCandidates(req: BuyerRequirements, limit = 15): Candidate[] {
  const all = getCars()
  const today = new Date()
  const eq = (a: string, b: string) => !b || b === "Any" || a.toLowerCase() === b.toLowerCase()

  const filtered = all.filter(
    (c) =>
      c.price <= req.budgetMax * 1.05 &&
      c.price >= req.budgetMin * 0.9 &&
      eq(c.brand, req.brand) &&
      eq(c.carName, req.model) &&
      eq(c.fuel, req.fuel) &&
      eq(c.transmission, req.transmission) &&
      c.seats >= req.minSeats &&
      c.km <= req.maxKm &&
      c.year >= req.minYear &&
      (!req.accidentFree || c.accident === "No") &&
      (!req.insuranceValid || c.insurance === "Valid"),
  )

  return filtered
    .map((c) => {
      let score = 50
      if (c.price <= req.budgetMax) score += 10
      score += Math.min(10, (c.year - req.minYear) * 2)
      score += Math.max(0, 10 - (c.km / Math.max(req.maxKm, 1)) * 10)
      if (c.serviceHistory === "Full") score += 8
      else if (c.serviceHistory === "Partial") score += 3
      if (c.accident === "No") score += 6
      if (c.insurance === "Valid") score += 4
      if (req.city && req.city !== "Any" && c.city === req.city) score += 10
      const signals = priceSignals(c, all, today)
      if (signals.priceVsMarketPct !== null) score += Math.max(-8, Math.min(8, -signals.priceVsMarketPct / 2))
      return { ...c, score: Math.round(Math.min(100, score)), signals }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export type TimingAdvice = {
  decision: "buy_now" | "wait"
  waitDays: number
  expectedPrice: number
  timingReason: string
}

export function heuristicTiming(c: Candidate): TimingAdvice {
  const { daysListed, priceVsMarketPct } = c.signals
  const pct = priceVsMarketPct ?? 0
  if (pct <= -3 || daysListed >= 60) {
    return {
      decision: "buy_now",
      waitDays: 0,
      expectedPrice: c.price,
      timingReason:
        pct <= -3
          ? `Priced ${Math.abs(pct)}% below similar listings - a good deal that may sell quickly.`
          : `Listed for ${daysListed} days, so the seller is likely open to negotiation now.`,
    }
  }
  const waitDays = daysListed < 30 ? 45 - daysListed : 21
  const drop = pct > 5 ? 0.06 : 0.03
  return {
    decision: "wait",
    waitDays,
    expectedPrice: Math.round((c.price * (1 - drop)) / 1000) * 1000,
    timingReason: `Priced ${pct > 0 ? `${pct}% above` : "around"} the market and only listed ${daysListed} days ago; sellers usually reduce prices after 4-6 weeks.`,
  }
}
