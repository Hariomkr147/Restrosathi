"use client";

import { useState } from "react";
import { createStaffAction, resetStaffPinAction, setStaffActiveAction, changeOwnerPasswordAction } from "./actions";

export function AddStaffForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    
    const fd = new FormData(e.currentTarget);
    const res = await createStaffAction(fd);
    
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
      {success && <p className="text-green-600 text-sm font-medium">Staff added successfully.</p>}
      
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">Name</label>
          <input name="name" type="text" required className="w-full border px-3 py-2 rounded" />
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium mb-1">PIN</label>
          <input name="pin" type="text" pattern="\d{4,6}" required className="w-full border px-3 py-2 rounded" placeholder="4-6 digits" />
        </div>
        <div className="flex items-end">
          <button type="submit" disabled={loading} className="w-full sm:w-auto bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50">
            {loading ? "Adding..." : "Add Staff"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function StaffItemRow({ staff }: { staff: { id: string; name: string; active: boolean } }) {
  const [resetting, setResetting] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });

  async function toggleActive() {
    setLoading(true);
    setMsg({ text: "", type: "" });
    const fd = new FormData();
    fd.append("userId", staff.id);
    fd.append("active", staff.active ? "false" : "true");
    
    const res = await setStaffActiveAction(fd);
    if (res.error) setMsg({ text: res.error, type: "error" });
    else setMsg({ text: `Staff ${staff.active ? "deactivated" : "reactivated"}`, type: "success" });
    setLoading(false);
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg({ text: "", type: "" });
    
    const fd = new FormData();
    fd.append("userId", staff.id);
    fd.append("pin", newPin);
    
    const res = await resetStaffPinAction(fd);
    if (res.error) setMsg({ text: res.error, type: "error" });
    else {
      setMsg({ text: "PIN reset successfully", type: "success" });
      setResetting(false);
      setNewPin("");
    }
    setLoading(false);
  }

  return (
    <div className="flex flex-col py-2 gap-2">
      <div className="flex justify-between items-center">
        <div>
          <p className="font-semibold text-lg">{staff.name}</p>
          <p className={`text-sm ${staff.active ? "text-green-600" : "text-gray-500"}`}>
            {staff.active ? "Active" : "Inactive"}
          </p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setResetting(!resetting)} 
            className="text-sm border px-3 py-1 rounded hover:bg-gray-50"
            disabled={loading}
          >
            Reset PIN
          </button>
          <button 
            onClick={toggleActive} 
            className={`text-sm border px-3 py-1 rounded hover:bg-gray-50 ${staff.active ? "text-red-600" : "text-green-600"}`}
            disabled={loading}
          >
            {staff.active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </div>
      
      {msg.text && (
        <p className={`text-sm font-medium ${msg.type === "error" ? "text-red-600" : "text-green-600"}`}>
          {msg.text}
        </p>
      )}

      {resetting && (
        <form onSubmit={submitReset} className="flex gap-2 items-center bg-gray-50 p-2 rounded">
          <label className="text-sm font-medium">New PIN:</label>
          <input 
            type="text" 
            pattern="\d{4,6}" 
            required 
            value={newPin}
            onChange={e => setNewPin(e.target.value)}
            className="border px-2 py-1 rounded w-24 text-sm" 
            placeholder="4-6 digits" 
          />
          <button type="submit" disabled={loading} className="text-sm bg-primary text-primary-foreground px-3 py-1 rounded disabled:opacity-50">
            Save
          </button>
        </form>
      )}
    </div>
  );
}

export function ChangePasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);
    
    const fd = new FormData(e.currentTarget);
    const res = await changeOwnerPasswordAction(fd);
    
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(true);
      (e.target as HTMLFormElement).reset();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="text-red-600 text-sm font-medium">{error}</p>}
      {success && <p className="text-green-600 text-sm font-medium">Password changed successfully. Other sessions have been revoked.</p>}
      
      <div>
        <label className="block text-sm font-medium mb-1">Current Password</label>
        <input name="current" type="password" required className="w-full border px-3 py-2 rounded max-w-sm" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">New Password</label>
        <input name="next" type="password" minLength={10} required className="w-full border px-3 py-2 rounded max-w-sm" />
        <p className="text-xs text-muted-foreground mt-1">Must be at least 10 characters.</p>
      </div>
      <div>
        <button type="submit" disabled={loading} className="bg-primary text-primary-foreground px-4 py-2 rounded disabled:opacity-50">
          {loading ? "Saving..." : "Change Password"}
        </button>
      </div>
    </form>
  );
}
