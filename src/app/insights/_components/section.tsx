import type { ReactNode } from "react";

type Props = {
  id: string;
  title: string;
  /** The question this section answers, shown as its subtitle. */
  question: string;
  children: ReactNode;
};

/** A titled card. The title and question are static, so they are in the page shell while the body streams in. */
export function InsightSection({ id, title, question, children }: Props) {
  return (
    <section aria-labelledby={`${id}-title`} className="space-y-4 rounded-lg border bg-background p-4 sm:p-5">
      <div className="space-y-0.5">
        <h2 id={`${id}-title`} className="text-base font-semibold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">{question}</p>
      </div>
      {children}
    </section>
  );
}

export function EmptySection({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}
