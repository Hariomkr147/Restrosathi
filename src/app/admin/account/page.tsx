import { requirePageUser } from "@/lib/auth/session";

export default async function AccountPage() {
  await requirePageUser("OWNER");
  
  return (
    <main className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Account</h1>
      
      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-xl font-bold mb-4">Change Password</h2>
        {/* Form action to change password would go here */}
      </div>
    </main>
  );
}
