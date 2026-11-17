"use client"

import { useState, type FormEvent } from "react"
import { Loader2, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MatchResults, type MatchResponse } from "@/components/match-results"

type Options = {
  brands: string[]
  modelsByBrand: Record<string, string[]>
  cities: string[]
  fuels: string[]
  transmissions: string[]
  minYear: number
  maxYear: number
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 [&>option]:bg-popover [&>option]:text-popover-foreground"

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  )
}

function Select({ id, name, options, defaultValue = "Any", anyLabel = "Any", onChange }: {
  id: string
  name: string
  options: (string | number)[]
  defaultValue?: string
  anyLabel?: string
  onChange?: (v: string) => void
}) {
  return (
    <select id={id} name={name} defaultValue={defaultValue} className={selectClass} onChange={(e) => onChange?.(e.target.value)}>
      <option value="Any">{anyLabel}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

export function BuyerForm({ options }: { options: Options }) {
  const [brand, setBrand] = useState("Any")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MatchResponse | null>(null)

  const years = Array.from({ length: options.maxYear - options.minYear + 1 }, (_, i) => options.maxYear - i)
  const models = brand === "Any" ? [] : options.modelsByBrand[brand] ?? []

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const payload = {
      ...Object.fromEntries(fd.entries()),
      accidentFree: fd.get("accidentFree") === "on",
      insuranceValid: fd.get("insuranceValid") === "on",
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Something went wrong")
      setResult(data)
      requestAnimationFrame(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth" }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={onSubmit} className="flex flex-col gap-8 rounded-xl border bg-card p-6 md:p-8">
        <fieldset className="flex flex-col gap-4">
          <legend className="mb-4 flex items-center gap-3 text-lg font-semibold">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">1</span>
            Your details
          </legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Full name" htmlFor="name">
              <Input id="name" name="name" required placeholder="e.g. Karthik Raja" autoComplete="name" />
            </Field>
            <Field label="Phone number" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" required placeholder="98765 43210" autoComplete="tel" />
            </Field>
            <Field label="Email (optional)" htmlFor="email">
              <Input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" />
            </Field>
            <Field label="Your city" htmlFor="buyerCity">
              <Input id="buyerCity" name="buyerCity" placeholder="e.g. Chennai" autoComplete="address-level2" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-4">
          <legend className="mb-4 flex items-center gap-3 text-lg font-semibold">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">2</span>
            Car requirements
          </legend>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Min budget (INR)" htmlFor="budgetMin">
              <Input id="budgetMin" name="budgetMin" type="number" min={0} step={10000} defaultValue={300000} />
            </Field>
            <Field label="Max budget (INR)" htmlFor="budgetMax">
              <Input id="budgetMax" name="budgetMax" type="number" min={0} step={10000} defaultValue={800000} required />
            </Field>
            <Field label="Brand" htmlFor="brand">
              <Select id="brand" name="brand" options={options.brands} onChange={setBrand} />
            </Field>
            <Field label="Model" htmlFor="model">
              <Select key={brand} id="model" name="model" options={models} anyLabel={brand === "Any" ? "Select a brand first" : "Any"} />
            </Field>
            <Field label="Fuel type" htmlFor="fuel">
              <Select id="fuel" name="fuel" options={options.fuels} />
            </Field>
            <Field label="Transmission" htmlFor="transmission">
              <Select id="transmission" name="transmission" options={options.transmissions} />
            </Field>
            <Field label="Minimum seats" htmlFor="minSeats">
              <select id="minSeats" name="minSeats" defaultValue="0" className={selectClass}>
                <option value="0">Any</option>
                <option value="5">5+</option>
                <option value="7">7+</option>
              </select>
            </Field>
            <Field label="Max kilometers driven" htmlFor="maxKm">
              <Input id="maxKm" name="maxKm" type="number" min={0} step={5000} defaultValue={80000} />
            </Field>
            <Field label="Manufactured from year" htmlFor="minYear">
              <select id="minYear" name="minYear" defaultValue={String(options.minYear)} className={selectClass}>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Preferred seller city" htmlFor="city">
              <Select id="city" name="city" options={options.cities} anyLabel="Anywhere in Tamil Nadu" />
            </Field>
            <div className="flex flex-col justify-end gap-3 sm:col-span-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="accidentFree" defaultChecked className="size-4 accent-primary" />
                Accident-free cars only
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="insuranceValid" className="size-4 accent-primary" />
                Valid insurance only
              </label>
            </div>
          </div>
          <Field label="Anything else the AI should know?" htmlFor="notes">
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="e.g. Family of 5, mostly city driving in Chennai, want good mileage and low maintenance."
            />
          </Field>
        </fieldset>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Our AI compares your needs with every seller listing and market prices.</p>
          <Button type="submit" size="lg" disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            {loading ? "AI is analyzing listings (up to a minute)..." : "Find matching cars"}
          </Button>
        </div>
        {error && (
          <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </form>

      <div id="results" aria-live="polite">
        {result && <MatchResults data={result} />}
      </div>
    </div>
  )
}
