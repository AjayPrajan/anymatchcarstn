import { Car } from "lucide-react"
import { BuyerForm } from "@/components/buyer-form"
import { getFilterOptions } from "@/lib/cars"

const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n)

export default function Page() {
  const options = getFilterOptions()
  const stats = [
    { label: "First-owner listings", value: options.total.toLocaleString("en-IN") },
    { label: "Brands", value: options.brands.length },
    { label: "Cities in Tamil Nadu", value: options.cities.length },
    { label: "Price range", value: `${inr(options.minPrice)} - ${inr(options.maxPrice)}` },
  ]

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-4">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Car className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold">AutoMatch TN</span>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 md:py-14">
        <section className="flex flex-col gap-6">
          <div className="flex max-w-3xl flex-col gap-4">
            <p className="text-sm font-medium text-primary">AI-powered second hand car matching</p>
            <h1 className="text-4xl font-bold tracking-tight text-balance md:text-5xl">
              Tell us what you need. We&apos;ll find the right car and the right time to buy.
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
              Share your requirements and our AI matches you with first-owner sellers across Tamil Nadu, then tells you
              whether to buy now or wait for a better price.
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-1 rounded-lg border bg-card p-4">
                <dt className="text-sm text-muted-foreground">{s.label}</dt>
                <dd className="text-lg font-semibold">{s.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <BuyerForm options={options} />
      </main>
    </div>
  )
}
