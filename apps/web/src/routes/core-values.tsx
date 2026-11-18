import { Card } from "../components/ui";
import { CORE_VALUES, CORE_VALUES_TAGLINE } from "../content/core-values";

export function CoreValuesPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.18em] text-muted uppercase">
          {CORE_VALUES_TAGLINE}
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl">
          Our <span className="fire-text">core values</span>
        </h1>
        <p className="mt-3 max-w-prose text-muted">
          What Blast Robotics 10989 stands for, in the team's own words.
        </p>
      </div>

      {CORE_VALUES.length === 0 ? (
        <Card className="border-dashed border-strong bg-transparent shadow-none">
          <h2 className="text-lg">The team's values will show up here</h2>
          <p className="mt-2 max-w-prose text-sm text-muted">
            We are adding the core values from the team assignment. Check back soon, or ask a
            mentor.
          </p>
        </Card>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2">
          {CORE_VALUES.map((value, index) => (
            <li key={value.title}>
              <Card className="h-full">
                <span
                  aria-hidden="true"
                  className="grid size-8 place-items-center rounded-full bg-ink text-sm font-bold text-white"
                >
                  {index + 1}
                </span>
                <h2 className="mt-3 text-lg">{value.title}</h2>
                <p className="mt-2 text-sm text-muted">{value.meaning}</p>
                {value.example ? (
                  <p className="mt-3 border-t border-subtle pt-3 text-sm">{value.example}</p>
                ) : null}
              </Card>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
