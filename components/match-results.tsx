import { CalendarClock, CheckCircle2, Gauge, Fuel, MapPin, Phone, ShieldCheck, Sparkles, User, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type Car = {
  listingId: string
  ownerName: string
  brand: string
  carName: string
  year: number
  fuel: string
  transmission: string
  km: number
  seats: number
  color: string
  registration: string
  city: string
  insurance: string
  serviceHistory: string
  accident: string
  price: number
  listedDate: string
  signals: { daysListed: number; comparableMedian: number | null; priceVsMarketPct: number | null }
}

export type Match = {
  car: Car
  matchScore: number
  matchReason: string
  decision: "buy_now" | "wait"
  waitDays: number
  expectedPrice: number
  timingReason: string
}

export type MatchResponse = {
  buyer: { name: string }
  source: "ai" | "heuristic" | "none"
  summary: string
  matches: Match[]
}

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

function formatWait(days: number) {
  if (days < 30) return `${days} days`
  const months = Math.round((days / 30) * 2) / 2
  return `${days} days (~${months} month${months === 1 ? "" : "s"})`
}

function MatchCard({ match, rank }: { match: Match; rank: number }) {
  const { car } = match
  const isWait = match.decision === "wait"
  const savings = car.price - match.expectedPrice
  const pct = car.signals.priceVsMarketPct

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              #{rank} &middot; {car.listingId}
            </span>
            <h3 className="text-lg font-semibold text-balance">
              {car.year} {car.brand} {car.carName}
            </h3>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold text-primary">{match.matchScore}</span>
            <span className="text-xs text-muted-foreground">match</span>
          </div>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-2xl font-bold">{inr(car.price)}</p>
            {pct !== null && (
              <p className={pct <= 0 ? "text-xs text-success" : "text-xs text-warning"}>
                {pct <= 0 ? `${Math.abs(pct)}% below` : `${pct}% above`} similar cars
              </p>
            )}
          </div>
          <span className="text-xs text-muted-foreground">Listed {car.signals.daysListed} days ago</span>
        </div>

        <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2"><Gauge className="size-4" aria-hidden />{car.km.toLocaleString("en-IN")} km</li>
          <li className="flex items-center gap-2"><Fuel className="size-4" aria-hidden />{car.fuel} &middot; {car.transmission}</li>
          <li className="flex items-center gap-2"><MapPin className="size-4" aria-hidden />{car.city}</li>
          <li className="flex items-center gap-2"><User className="size-4" aria-hidden />{car.seats} seats &middot; {car.color}</li>
          <li className="flex items-center gap-2"><ShieldCheck className="size-4" aria-hidden />Insurance {car.insurance}</li>
          <li className="flex items-center gap-2"><Wrench className="size-4" aria-hidden />{car.serviceHistory} service</li>
        </ul>

        <p className="text-sm leading-relaxed text-pretty">{match.matchReason}</p>

        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground" aria-hidden />
            <span>
              Seller: <strong className="font-semibold">{car.ownerName}</strong>
            </span>
          </span>
          <span className="font-mono text-xs text-muted-foreground">{car.registration}</span>
        </div>
      </div>

      <div className={isWait ? "mt-auto flex flex-col gap-2 border-t bg-warning/10 p-5" : "mt-auto flex flex-col gap-2 border-t bg-success/10 p-5"}>
        <div className="flex items-center gap-2">
          {isWait ? <CalendarClock className="size-5 text-warning" aria-hidden /> : <CheckCircle2 className="size-5 text-success" aria-hidden />}
          <span className={isWait ? "font-semibold text-warning" : "font-semibold text-success"}>
            {isWait ? `Wait ${formatWait(match.waitDays)}` : "Buy now"}
          </span>
        </div>
        {isWait && savings > 0 && (
          <p className="text-sm">
            Expected price: <strong>{inr(match.expectedPrice)}</strong>{" "}
            <span className="text-muted-foreground">(save ~{inr(savings)})</span>
          </p>
        )}
        <p className="text-sm text-muted-foreground text-pretty">{match.timingReason}</p>
      </div>
    </article>
  )
}

export function MatchResults({ data }: { data: MatchResponse }) {
  return (
    <section aria-labelledby="results-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="results-heading" className="text-2xl font-semibold">
            {data.matches.length > 0 ? `${data.matches.length} cars matched for ${data.buyer.name}` : `No matches yet, ${data.buyer.name}`}
          </h2>
          {data.source === "ai" && (
            <Badge variant="secondary" className="gap-1"><Sparkles className="size-3" aria-hidden />AI recommended</Badge>
          )}
          {data.source === "heuristic" && <Badge variant="outline">Market analysis</Badge>}
        </div>
        {data.summary && <p className="max-w-3xl leading-relaxed text-muted-foreground text-pretty">{data.summary}</p>}
      </div>

      {data.matches.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {data.matches.map((m, i) => (
            <MatchCard key={m.car.listingId} match={m} rank={i + 1} />
          ))}
        </div>
      )}

      {data.matches.length > 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Phone className="size-4" aria-hidden />
          Our team will share your details with the selected sellers so they can contact you.
        </p>
      )}
    </section>
  )
}
