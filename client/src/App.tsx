import { useEffect, useState } from "react";
import { API_PREFIX, healthResponseSchema } from "@nexora/shared";

type Status = "checking" | "ok" | "error";

// Walking skeleton: proves the path browser → /api proxy → API works.
// Replaced by the real app shell (router, providers) in the next steps.
export default function App() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    fetch(`${API_PREFIX}/health`)
      .then((res) => res.json())
      .then((body) => setStatus(healthResponseSchema.safeParse(body).success ? "ok" : "error"))
      .catch(() => setStatus("error"));
  }, []);

  const label = {
    checking: "Checking API…",
    ok: "API connected",
    error: "API unreachable",
  }[status];

  const color = {
    checking: "bg-gray-400",
    ok: "bg-green-500",
    error: "bg-red-500",
  }[status];

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6">
      <h1 className="text-4xl font-bold text-slate-900">Nexora</h1>
      <p className="text-slate-600">Multi-tenant project management</p>
      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
        <span className={`h-3 w-3 rounded-full ${color}`} />
        <span className="text-sm text-slate-700">{label}</span>
      </div>
    </main>
  );
}
