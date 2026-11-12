import { Link } from "react-router";
import { ArrowRightIcon, Building2Icon, SquareKanbanIcon, UserPlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";

// Public home for visitors (UI-6: hero + features, minimal and flat — no gradients or glows).

const features = [
  {
    Icon: Building2Icon,
    title: "A workspace per organization",
    text: "Each company gets its own isolated space. Admins, project managers and members see exactly what their role allows.",
  },
  {
    Icon: SquareKanbanIcon,
    title: "Boards with a review step",
    text: "Move tasks across a Kanban board. Finished work is reviewed and approved before it counts as done.",
  },
  {
    Icon: UserPlusIcon,
    title: "Invite your team",
    text: "Invite teammates by email and add them to the right projects in a single step.",
  },
];

const columns = [
  {
    name: "To do",
    dot: "bg-muted-foreground",
    tasks: [
      { title: "Write API documentation", who: "AK" },
      { title: "Plan sprint 4", who: "MS" },
    ],
  },
  {
    name: "In progress",
    dot: "bg-primary",
    tasks: [
      { title: "Design onboarding flow", who: "PR" },
      { title: "Set up CI pipeline", who: "AK" },
    ],
  },
  {
    name: "In review",
    dot: "bg-chart-3",
    tasks: [{ title: "Fix login redirect", who: "MS" }],
  },
];

// Static, decorative picture of the product (hidden from screen readers).
function BoardPreview() {
  return (
    <div aria-hidden className="mx-auto max-w-4xl rounded-xl border bg-muted/40 p-3">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="text-sm font-medium">Website relaunch</span>
        <span className="text-xs text-muted-foreground">Acme Corp</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {columns.map((column) => (
          <div key={column.name} className="grid content-start gap-2">
            <div className="flex items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
              <span className={cn("size-2 rounded-full", column.dot)} />
              {column.name}
              <span className="ml-auto">{column.tasks.length}</span>
            </div>
            {column.tasks.map((task) => (
              <div key={task.title} className="rounded-lg border bg-card p-3 text-left">
                <p className="text-sm">{task.title}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="h-1.5 w-10 rounded-full bg-muted" />
                  <span className="flex size-6 items-center justify-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
                    {task.who}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
          <Logo />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Link to="/login" className={buttonVariants({ variant: "ghost" })}>
              Log in
            </Link>
            <Link to="/register" className={buttonVariants()}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 pt-16 pb-14 text-center sm:pt-24">
          <p className="text-sm font-medium text-primary">Project management for growing teams</p>
          <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Plan, track and approve work in one place.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-pretty text-muted-foreground">
            Nexora gives your organization its own workspace with roles, Kanban boards and review
            steps, so everyone knows what to work on next.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/register" className={cn(buttonVariants({ size: "lg" }), "px-4")}>
              Get started <ArrowRightIcon aria-hidden />
            </Link>
            <Link
              to="/login"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "px-4")}
            >
              Log in
            </Link>
          </div>
        </section>

        <section className="hidden px-4 pb-20 sm:block">
          <BoardPreview />
        </section>

        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything your team needs, nothing it doesn&apos;t.
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {features.map(({ Icon, title, text }) => (
                <div key={title} className="rounded-xl border bg-card p-6">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-medium">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 text-sm text-muted-foreground">
          <span>© {new Date().getFullYear()} Nexora</span>
          <Link to="/login" className="hover:text-foreground">
            Log in
          </Link>
        </div>
      </footer>
    </div>
  );
}
