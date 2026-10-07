"use client";

import { useState } from "react";
import { submitFeedbackAction } from "./actions";

export function FeedbackForm({ token, googleReviewUrl }: { token: string, googleReviewUrl?: string }) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"IDLE" | "SUBMITTING" | "SUCCESS" | "ERROR">("IDLE");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) return;
    setStatus("SUBMITTING");
    const res = await submitFeedbackAction(token, rating, comment);
    if (res.ok) {
      setStatus("SUCCESS");
    } else {
      setStatus("ERROR");
      if (res.error === "ALREADY_SUBMITTED") setErrorMsg("Thanks, we already have your feedback");
      else setErrorMsg(res.error || "Failed to submit feedback");
    }
  };

  const ratings = [
    { value: 1, label: "1 - Poor" },
    { value: 2, label: "2 - Fair" },
    { value: 3, label: "3 - Good" },
    { value: 4, label: "4 - Very Good" },
    { value: 5, label: "5 - Excellent" },
  ];

  return (
    <div className="space-y-6">
      {status === "SUCCESS" ? (
        <div className="p-6 bg-green-50 text-green-800 rounded-lg text-center">
          <h2 className="text-xl font-bold mb-2">Thank you!</h2>
          <p>Your feedback has been submitted successfully.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6 bg-card p-6 rounded-lg border shadow-sm">
          <div>
            <label className="block font-semibold mb-3">How was your experience?</label>
            <div className="flex flex-col gap-2">
              {ratings.map(r => (
                <label key={r.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${rating === r.value ? 'bg-orange-50 border-orange-200' : 'hover:bg-accent'}`}>
                  <input 
                    type="radio" 
                    name="rating" 
                    value={r.value} 
                    checked={rating === r.value}
                    onChange={() => setRating(r.value)}
                    className="w-5 h-5 text-orange-600 focus:ring-orange-500"
                  />
                  <span className="text-lg">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-2" htmlFor="comment">Additional comments (optional)</label>
            <textarea
              id="comment"
              maxLength={500}
              rows={4}
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="w-full p-3 border rounded-md focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none"
              placeholder="Tell us what you liked or how we can improve..."
            />
          </div>

          {status === "ERROR" && (
            <div className="text-red-600 text-sm p-3 bg-red-50 rounded-md">
              {errorMsg}
            </div>
          )}

          <button 
            type="submit" 
            disabled={!rating || status === "SUBMITTING"}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {status === "SUBMITTING" ? "Submitting..." : "Submit Feedback"}
          </button>
        </form>
      )}

      {googleReviewUrl && (
        <div className="pt-4 border-t">
          <a 
            href={googleReviewUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full border-2 border-orange-600 text-orange-600 hover:bg-orange-50 font-bold py-3 rounded-lg transition-colors"
          >
            Review us on Google
          </a>
        </div>
      )}
    </div>
  );
}
