"use client";

import { useState } from "react";
import { adminUpsertPackageAction } from "../actions";
import { useRouter } from "next/navigation";

export function PackageForm({ pkg }: { pkg?: any }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setLoading(true);
    setError(null);

    const formData = new FormData(form);
    console.log("Submitting form data", Object.fromEntries(formData.entries()));
    const data = {
      name: { 
        en: formData.get("nameEn") as string, 
        hi: formData.get("nameHi") as string || undefined 
      },
      description: { 
        en: formData.get("descEn") as string, 
        hi: formData.get("descHi") as string || undefined 
      },
      pricePerPlatePaise: Math.round(Number(formData.get("price")) * 100),
      minGuests: Number(formData.get("minGuests")),
      active: formData.get("active") === "on",
      sortOrder: Number(formData.get("sortOrder")) || 0,
    };

    try {
      await adminUpsertPackageAction(pkg?.id || null, data);
      if (!pkg) form.reset();
      router.refresh();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border border-[var(--color-border)] p-4 rounded-sm bg-surface space-y-4">
      <h3 className="font-bold">{pkg ? `Edit: ${pkg.name.en}` : "New Package"}</h3>
      {error && <div className="text-danger text-sm">{error}</div>}
      
      <div className="grid grid-cols-2 gap-4">
        <input required name="nameEn" defaultValue={pkg?.name?.en} placeholder="Name (EN)" className="px-2 py-1 border border-[var(--color-border)] rounded-sm bg-transparent" />
        <input name="nameHi" defaultValue={pkg?.name?.hi} placeholder="Name (HI)" className="px-2 py-1 border border-[var(--color-border)] rounded-sm bg-transparent" />
        
        <textarea required name="descEn" defaultValue={pkg?.description?.en} placeholder="Description (EN)" className="px-2 py-1 border border-[var(--color-border)] rounded-sm bg-transparent" />
        <textarea name="descHi" defaultValue={pkg?.description?.hi} placeholder="Description (HI)" className="px-2 py-1 border border-[var(--color-border)] rounded-sm bg-transparent" />
        
        <input required name="price" type="number" step="1" min="1" defaultValue={pkg ? pkg.pricePerPlatePaise / 100 : ""} placeholder="Price (₹)" className="px-2 py-1 border border-[var(--color-border)] rounded-sm bg-transparent" />
        <input required name="minGuests" type="number" min="1" defaultValue={pkg?.minGuests} placeholder="Min Guests" className="px-2 py-1 border border-[var(--color-border)] rounded-sm bg-transparent" />
        
        <label className="flex items-center gap-2">
          <input type="checkbox" name="active" defaultChecked={pkg ? pkg.active : true} />
          <span>Active</span>
        </label>
        
        <input name="sortOrder" type="number" defaultValue={pkg?.sortOrder} placeholder="Sort Order" className="px-2 py-1 border border-[var(--color-border)] rounded-sm bg-transparent" />
      </div>

      <button disabled={loading} type="submit" className="px-4 py-2 bg-primary text-primary-contrast rounded-sm font-bold">
        {pkg ? "Save" : "Create"}
      </button>
    </form>
  );
}
