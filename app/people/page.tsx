"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, ExternalLink, ShieldCheck, AlertTriangle, ArrowRight, UserCheck, Trash2 } from "lucide-react";

export default function PeoplePage() {
  const [people, setPeople] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "real" | "synthetic">("all");
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadPeople = async () => {
    try {
      const res = await fetch("/api/people");
      const data = await res.json();
      setPeople(data.people || []);
    } catch {} finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPeople();
  }, []);

  const handleLoadReal = async () => {
    setIsLoading(true);
    setActionMessage("Loading 25 verified public figures into candidate pool...");
    try {
      const res = await fetch("/api/people/seed-real", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMessage(data.message || "Loaded 25 real public figures!");
        loadPeople();
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this person, including media and memory?")) return;
    try {
      await fetch(`/api/people/${id}`, { method: "DELETE" });
      loadPeople();
    } catch {}
  };

  const realPeople = people.filter((p) => !p.name?.includes("SYNTHETIC"));
  const syntheticPeople = people.filter((p) => p.name?.includes("SYNTHETIC"));
  const displayedPeople =
    filter === "real" ? realPeople : filter === "synthetic" ? syntheticPeople : people;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-2.5">
            <Users className="w-7 h-7 text-blue-400" />
            Candidate Pool
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            All registered candidates represented by autonomous dating agents.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleLoadReal}
            disabled={isLoading}
            className="px-3.5 py-1.5 rounded-xl bg-blue-950/70 hover:bg-blue-900/70 text-blue-300 text-xs font-bold border border-blue-600/50 flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <UserCheck className="w-3.5 h-3.5 text-blue-400" />
            Load Real Figures (25)
          </button>

          <div className="text-xs text-zinc-500 font-medium bg-zinc-900 px-3 py-1.5 rounded-xl border border-zinc-800">
            Total: <span className="text-white font-bold">{people.length}</span>
          </div>
        </div>
      </div>

      {actionMessage && (
        <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/60 text-xs text-center text-blue-200">
          {actionMessage}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "all" ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          All Candidates ({people.length})
        </button>
        <button
          onClick={() => setFilter("real")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            filter === "real" ? "bg-blue-950 text-blue-300 border border-blue-800/60" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <UserCheck className="w-3.5 h-3.5 text-blue-400" />
          Real People ({realPeople.length})
        </button>
        <button
          onClick={() => setFilter("synthetic")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            filter === "synthetic" ? "bg-amber-950 text-amber-300 border border-amber-800/60" : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          Synthetic Demo ({syntheticPeople.length})
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-zinc-500 text-sm">Loading candidates...</div>
      ) : displayedPeople.length === 0 ? (
        <div className="text-center py-20 bg-zinc-900/30 border border-zinc-800 rounded-2xl space-y-3">
          <p className="text-zinc-400 text-sm">No {filter !== "all" ? filter : ""} candidates found.</p>
          <button
            onClick={handleLoadReal}
            className="inline-block px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
          >
            Load 25 Real Public Figures
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedPeople.map((p) => {
            const isSynthetic = p.name?.includes("SYNTHETIC");
            const isLowMatch = (p.identity_match ?? 1) < 0.5;

            return (
              <div
                key={p.id}
                className="bg-zinc-900/40 hover:bg-zinc-900/70 border border-zinc-800/80 hover:border-zinc-700/80 rounded-2xl p-5 transition-all flex flex-col justify-between space-y-4 group"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-white group-hover:text-rose-400 transition-colors">
                        {p.name || "Candidate"}
                      </h3>
                      <p className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
                        {p.headline || "Awaiting profile analysis"}
                      </p>
                    </div>

                    <button
                      onClick={(e) => handleDelete(p.id, e)}
                      title="Delete Candidate"
                      className="text-zinc-600 hover:text-red-400 p-1 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 uppercase tracking-wider">
                      {p.status}
                    </span>

                    {isSynthetic ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        SYNTHETIC
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> REAL FIGURE
                      </span>
                    )}

                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {p.consent_status}
                    </span>

                    {isLowMatch ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Unverified Match
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Verified Link
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-zinc-500">
                    <a
                      href={p.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-400 flex items-center gap-1"
                    >
                      LinkedIn <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href={p.instagram_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-pink-400 flex items-center gap-1"
                    >
                      Instagram <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <Link
                    href={`/people/${p.id}`}
                    className="text-rose-400 hover:text-rose-300 font-semibold flex items-center gap-1"
                  >
                    Profile <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
