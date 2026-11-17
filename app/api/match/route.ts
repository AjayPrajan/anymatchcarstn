import { NextResponse } from "next/server"
import { findCandidates, heuristicTiming, type BuyerRequirements, type Candidate } from "@/lib/cars"

export const maxDuration = 120

const MODEL = "cohere/north-mini-code:free"

type AiMatch = {
  listing_id: string
  match_score: number
  match_reason: string
  decision: "buy_now" | "wait"
  wait_days: number
  expected_price: number
  timing_reason: string
}

const str = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "")
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

function parseBody(body: Record<string, unknown>) {
  const buyer = {
    name: str(body.name),
    phone: str(body.phone, 20),
    email: str(body.email, 120),
    city: str(body.buyerCity),
  }
  const req: BuyerRequirements = {
    budgetMin: num(body.budgetMin, 0, 0, 1e8),
    budgetMax: num(body.budgetMax, 1e7, 0, 1e8),
    brand: str(body.brand) || "Any",
    model: str(body.model) || "Any",
    fuel: str(body.fuel) || "Any",
    transmission: str(body.transmission) || "Any",
    minSeats: num(body.minSeats, 0, 0, 10),
    maxKm: num(body.maxKm, 1e7, 0, 1e7),
    minYear: num(body.minYear, 1990, 1990, 2100),
    city: str(body.city) || "Any",
    accidentFree: body.accidentFree === true,
    insuranceValid: body.insuranceValid === true,
    notes: str(body.notes, 600),
  }
  return { buyer, req }
}

function extractJson(text: string) {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim()
  const start = cleaned.indexOf("{")
  const end = cleaned.lastIndexOf("}")
  if (start === -1 || end <= start) throw new Error("No JSON in AI response")
  const candidate = cleaned.slice(start, end + 1)
  try {
    return JSON.parse(candidate)
  } catch {
    return JSON.parse(candidate.replace(/\\"/g, '"'))
  }
}

async function askAi(buyerName: string, req: BuyerRequirements, candidates: Candidate[]) {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set")

  const listings = candidates
    .map(
      (c) =>
        `${c.listingId}|${c.ownerName}|${c.year} ${c.brand} ${c.carName}|${c.fuel}|${c.transmission}|${c.km}km|${c.seats}seats|${c.city}|ins:${c.insurance}|svc:${c.serviceHistory}|acc:${c.accident}|price:${c.price}|listed:${c.signals.daysListed}d|vsMarket:${c.signals.priceVsMarketPct}%`,
    )
    .join("\n")

  const wants = Object.entries(req)
    .filter(([, v]) => v !== "Any" && v !== "" && v !== false)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ")

  const prompt = `Used-car advisor, Tamil Nadu. Buyer ${buyerName} wants: ${wants}.
Listings (id|seller|car|fuel|gear|km|seats|city|insurance|service|accident|price INR|days listed|price vs similar cars):
${listings}

Pick up to 4 best matches, best first. For each decide "buy_now" or "wait". Rule of thumb: below market or listed <30d -> buy_now; above market and listed 30+ days -> wait 15-90 days, sellers usually cut 3-8%.
Return ONLY valid JSON with no markdown, using the exact keys below. Include only real listing IDs from the list, never placeholders or ellipses. Keep reasons under 15 words. Use the asking price for expected_price when decision is buy_now.
{"summary":"Matching cars found for this buyer.","matches":[{"listing_id":"FO00001","match_score":85,"match_reason":"Fits budget and fuel needs.","decision":"buy_now","wait_days":0,"expected_price":423000,"timing_reason":"Priced below comparable listings."}]}`

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "AutoMatch TN",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      max_tokens: 8000,
      reasoning: { effort: "low" },
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You output strict JSON only." },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(110_000),
  })
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  const choice = data?.choices?.[0]
  const content: string = choice?.message?.content || ""
  return extractJson(content || choice?.message?.reasoning || "") as { summary?: string; matches?: AiMatch[] }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { buyer, req } = parseBody(body)
  if (!buyer.name || !buyer.phone) {
    return NextResponse.json({ error: "Name and phone number are required" }, { status: 400 })
  }
  if (req.budgetMax < req.budgetMin) {
    return NextResponse.json({ error: "Maximum budget must be greater than minimum budget" }, { status: 400 })
  }

  const candidates = findCandidates(req, 7)
  if (candidates.length === 0) {
    return NextResponse.json({
      buyer,
      source: "none",
      summary: "No listings match these requirements. Try increasing your budget, allowing more kilometers, or choosing 'Any' for brand, fuel, or transmission.",
      matches: [],
    })
  }

  const byId = new Map(candidates.map((c) => [c.listingId, c]))
  const toResult = (c: Candidate, ai?: AiMatch) => {
    const fallback = heuristicTiming(c)
    const decision = ai?.decision === "wait" || ai?.decision === "buy_now" ? ai.decision : fallback.decision
    return {
      car: c,
      matchScore: num(ai?.match_score, c.score, 0, 100),
      matchReason: str(ai?.match_reason, 300) || `Fits your budget and requirements with a match score of ${c.score}.`,
      decision,
      waitDays: decision === "wait" ? num(ai?.wait_days, fallback.waitDays || 30, 1, 365) : 0,
      expectedPrice: num(ai?.expected_price, decision === "wait" ? fallback.expectedPrice : c.price, 0, 1e8),
      timingReason: str(ai?.timing_reason, 300) || fallback.timingReason,
    }
  }

  try {
    const ai = await askAi(buyer.name, req, candidates)
    const idDigits = (id: unknown) => Number(String(id ?? "").replace(/\D/g, ""))
    const byDigits = new Map(candidates.map((c) => [idDigits(c.listingId), c]))
    const seen = new Set<string>()
    const matches = (Array.isArray(ai.matches) ? ai.matches : [])
      .map((m) => ({ m, c: byId.get(String(m?.listing_id ?? "").trim().toUpperCase()) ?? byDigits.get(idDigits(m?.listing_id)) }))
      .filter((x): x is { m: AiMatch; c: Candidate } => !!x.c && !seen.has(x.c.listingId) && !!seen.add(x.c.listingId))
      .slice(0, 6)
      .map(({ m, c }) => toResult(c, m))
    if (matches.length === 0) throw new Error("AI returned no valid listings")
    return NextResponse.json({ buyer, source: "ai", summary: str(ai.summary, 800), matches })
  } catch (error) {
    console.error("[match] AI failed, using heuristic:", error instanceof Error ? error.message : error)
    return NextResponse.json({
      buyer,
      source: "heuristic",
      summary: "The AI advisor is busy right now, so these matches were ranked using market price analysis of the dataset.",
      matches: candidates.slice(0, 6).map((c) => toResult(c)),
    })
  }
}
