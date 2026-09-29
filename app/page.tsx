"use client";

import { useState, useEffect } from "react";
import { Sparkles, Users, Play, Upload, Database, DollarSign, CheckCircle2, AlertCircle, RefreshCw, ArrowRight, UserCheck } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  const [pipelineStatus, setPipelineStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Form states
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [consentStatus, setConsentStatus] = useState("opted_in");
  const [adultConfirmed, setAdultConfirmed] = useState(true);
  const [publicConfirmed, setPublicConfirmed] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/pipeline/status");
      if (res.ok) {
        const data = await res.json();
        setPipelineStatus(data);
      }
    } catch {}
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedin_url: linkedinUrl,
          instagram_url: instagramUrl,
          consent_status: consentStatus,
          adult_confirmed: adultConfirmed,
          public_confirmed: publicConfirmed,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage("Candidate added successfully!");
        setLinkedinUrl("");
        setInstagramUrl("");
        fetchStatus();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedReal = async () => {
    setIsLoading(true);
    setMessage("Loading 25 verified real public figures (Satya Nadella, Sundar Pichai, Sam Altman, etc.)...");
    try {
      const res = await fetch("/api/people/seed-real", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || "Loaded 25 real public figures!");
        fetchStatus();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeedDemo = async () => {
    setIsLoading(true);
    setMessage("Loading 25 synthetic candidate fixtures...");
    try {
      const res = await fetch("/api/people/seed-demo", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message || "Loaded demo set!");
        fetchStatus();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunPipeline = async () => {
    setIsLoading(true);
    setMessage("Pipeline execution started in background...");
    try {
      const res = await fetch("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "collect" }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        fetchStatus();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setMessage("Uploading CSV...");
    try {
      const text = await file.text();
      const res = await fetch("/api/people/import", {
        method: "POST",
        body: text,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        fetchStatus();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const stages = [
    { key: "collect", label: "Collect", done: (pipelineStatus?.readyCount || 0) > 0 },
    { key: "read", label: "Read", done: (pipelineStatus?.readyCount || 0) >= (pipelineStatus?.peopleCount || 1) && (pipelineStatus?.peopleCount || 0) > 0 },
    { key: "round1", label: "Round 1 (Speed)", done: (pipelineStatus?.round1Count || 0) > 0 && pipelineStatus?.round1Count === pipelineStatus?.round1Total },
    { key: "reflect", label: "Reflect", done: (pipelineStatus?.round1Count || 0) > 0 },
    { key: "round2", label: "Round 2 (Deep)", done: (pipelineStatus?.round2Count || 0) > 0 && pipelineStatus?.round2Count === pipelineStatus?.round2Total },
    { key: "rank", label: "Rankings", done: (pipelineStatus?.rankedCount || 0) > 0 },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-10">
      {/* Header Banner */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-rose-400 via-pink-300 to-purple-400">
          Agentic Dating
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base leading-relaxed">
          AI agents read real social footprints (LinkedIn + Instagram), construct grounded psychological personas, and date each other to produce verifiable compatibility rankings.
        </p>

        {/* Global Stats Ribbon */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2 text-xs">
          <div className="bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-zinc-300">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>Candidates: <strong>{pipelineStatus?.peopleCount || 0}</strong></span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-zinc-300">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>R1 Dates: <strong>{pipelineStatus?.round1Count || 0} / {pipelineStatus?.round1Total || 0}</strong></span>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 text-zinc-300">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span>LLM Spend: <strong>${pipelineStatus?.totalCostUsd || "0.00"}</strong></span>
          </div>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700 text-sm text-center text-zinc-200 animate-fadeIn">
          {message}
        </div>
      )}

      {/* Pipeline Stepper & Controls */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-rose-500" />
              Autonomous Pipeline Stepper
            </h2>
            <p className="text-xs text-zinc-400 mt-1">
              Current Stage: <span className="font-semibold text-rose-400 uppercase tracking-wide">{pipelineStatus?.currentStage || "idle"}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSeedReal}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-blue-950/70 hover:bg-blue-900/70 text-blue-300 text-xs font-bold flex items-center gap-1.5 transition-colors border border-blue-600/50 shadow-md shadow-blue-950"
            >
              <UserCheck className="w-4 h-4 text-blue-400" />
              Load Real People (25)
            </button>

            <button
              onClick={handleSeedDemo}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-zinc-700"
            >
              <Database className="w-4 h-4 text-amber-400" />
              Load Synthetic Demo (25)
            </button>

            <button
              onClick={handleRunPipeline}
              disabled={isLoading || (pipelineStatus?.peopleCount || 0) < 2}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-bold tracking-wide flex items-center gap-2 transition-all shadow-lg shadow-rose-600/30"
            >
              <Play className="w-4 h-4 fill-white" />
              Run Pipeline
            </button>
          </div>
        </div>

        {/* Stepper Display */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {stages.map((st, i) => (
            <div
              key={st.key}
              className={`p-3 rounded-xl border text-center transition-all ${
                pipelineStatus?.currentStage === st.key
                  ? "bg-rose-950/40 border-rose-500/80 text-rose-300 shadow-md shadow-rose-950"
                  : st.done
                  ? "bg-zinc-950/80 border-emerald-500/40 text-emerald-400"
                  : "bg-zinc-950/40 border-zinc-800/80 text-zinc-500"
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider mb-1">Step 0{i + 1}</div>
              <div className="text-xs font-semibold truncate">{st.label}</div>
              <div className="mt-2 text-[10px] flex items-center justify-center gap-1">
                {st.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : pipelineStatus?.currentStage === st.key ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                ) : (
                  <span>Pending</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add People Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Single Add Form */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-5">
          <h3 className="font-bold text-base text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-400" />
            Add Candidate Links
          </h3>

          <form onSubmit={handleAddPerson} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">LinkedIn Profile URL</label>
              <input
                type="url"
                required
                placeholder="https://www.linkedin.com/in/username"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Public Instagram Profile URL</label>
              <input
                type="text"
                required
                placeholder="https://www.instagram.com/username or @username"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-rose-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1">Provenance / Consent</label>
              <select
                value={consentStatus}
                onChange={(e) => setConsentStatus(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-rose-500"
              >
                <option value="opted_in">Opted In (Authorized)</option>
                <option value="public_figure">Public Figure</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>

            <div className="space-y-2 pt-1 text-xs text-zinc-400">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={adultConfirmed}
                  onChange={(e) => setAdultConfirmed(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-rose-600 focus:ring-0"
                />
                <span>I confirm this person is an adult (18+).</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publicConfirmed}
                  onChange={(e) => setPublicConfirmed(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-rose-600 focus:ring-0"
                />
                <span>I confirm these profiles are public and accessible.</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !adultConfirmed || !publicConfirmed}
              className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold transition-colors disabled:opacity-50"
            >
              Add Candidate
            </button>
          </form>
        </div>

        {/* CSV Import & Quick Links */}
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-purple-400" />
              Batch CSV Import
            </h3>
            <p className="text-xs text-zinc-400">
              Upload a CSV containing <code>linkedin_url</code> and <code>instagram_url</code> columns to queue up multiple people simultaneously.
            </p>

            <label className="block border-2 border-dashed border-zinc-800 hover:border-zinc-700 rounded-xl p-6 text-center cursor-pointer transition-colors">
              <Upload className="w-6 h-6 text-zinc-500 mx-auto mb-2" />
              <span className="text-xs font-semibold text-zinc-300 block">Click to select CSV</span>
              <span className="text-[10px] text-zinc-500">e.g. data/people.csv</span>
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between gap-4">
            <div>
              <h3 className="font-bold text-base text-white mb-1">View Current Pool</h3>
              <p className="text-xs text-zinc-400">
                Explore analyzed profiles, watch live simulated dates, and evaluate compatibility rankings.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/people"
                className="p-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-center text-zinc-200 transition-colors flex items-center justify-center gap-1.5"
              >
                Candidate Grid <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/dates"
                className="p-3 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-semibold text-center text-zinc-200 transition-colors flex items-center justify-center gap-1.5"
              >
                Live Dates Feed <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
