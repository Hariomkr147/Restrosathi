"use client";

import { useState } from "react";
import { generateVariantsAction, createCampaignAction } from "../actions";
import { useRouter } from "next/navigation";

export default function NewCampaignPage() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [locale, setLocale] = useState("en");
  const [segment, setSegment] = useState("ALL");
  const [variants, setVariants] = useState<string[]>([]);
  const [selectedVariant, setSelectedVariant] = useState(-1);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("goal", goal);
      fd.append("locale", locale);
      const vars = await generateVariantsAction(fd);
      setVariants(vars);
      setSelectedVariant(-1);
      setMessage("");
    } catch (err: any) {
      setError(err.message || "Failed to generate");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("goal", goal);
      fd.append("locale", locale);
      fd.append("segment", segment);
      fd.append("message", message);
      const id = await createCampaignAction(fd);
      router.push(`/admin/marketing/${id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">New Marketing Campaign</h1>

      {error && <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>}

      <form onSubmit={handleGenerate} className="space-y-4 p-4 bg-white rounded border">
        <h2 className="font-bold">1. Define Goal</h2>
        <div>
          <label className="block text-sm font-medium mb-1">Goal (10-400 chars)</label>
          <textarea 
            value={goal} onChange={e => setGoal(e.target.value)}
            className="w-full border rounded p-2" rows={3} required minLength={10} maxLength={400}
            placeholder="e.g. 20% off all dine-in orders this weekend. Show this msg."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Language</label>
          <select value={locale} onChange={e => setLocale(e.target.value)} className="border rounded p-2">
            <option value="en">English</option>
            <option value="hi">Hindi</option>
          </select>
        </div>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded">
          {loading ? "Generating..." : "Generate Variants"}
        </button>
      </form>

      {variants.length > 0 && (
        <div className="space-y-4 p-4 bg-white rounded border">
          <h2 className="font-bold">2. Select & Edit Variant</h2>
          <div className="grid gap-4">
            {variants.map((v, i) => (
              <label key={i} className={`p-4 border rounded cursor-pointer ${selectedVariant === i ? "border-blue-500 bg-blue-50" : ""}`}>
                <div className="flex gap-2">
                  <input type="radio" name="variant" checked={selectedVariant === i} onChange={() => {
                    setSelectedVariant(i);
                    setMessage(v);
                  }} />
                  <pre className="whitespace-pre-wrap font-sans text-sm">{v}</pre>
                </div>
              </label>
            ))}
          </div>

          {selectedVariant !== -1 && (
            <div className="pt-4 border-t">
              <label className="block text-sm font-medium mb-1">Edit Message</label>
              <textarea 
                value={message} onChange={e => setMessage(e.target.value)}
                className="w-full border rounded p-2" rows={5} required maxLength={300}
              />
              <p className="text-xs text-gray-500">{message.length}/300 chars</p>
            </div>
          )}
        </div>
      )}

      {selectedVariant !== -1 && (
        <form onSubmit={handleCreate} className="space-y-4 p-4 bg-white rounded border">
          <h2 className="font-bold">3. Choose Audience</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Segment</label>
            <select value={segment} onChange={e => setSegment(e.target.value)} className="w-full border rounded p-2">
              <option value="ALL">All Consented Customers</option>
              <option value="VISITED_30_DAYS">Visited in Last 30 Days</option>
              <option value="INACTIVE_60_DAYS">Inactive for 60 Days</option>
              <option value="BIRTHDAYS_THIS_MONTH">Birthdays This Month</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded font-medium">
            {loading ? "Creating..." : "Create Campaign"}
          </button>
        </form>
      )}
    </div>
  );
}
