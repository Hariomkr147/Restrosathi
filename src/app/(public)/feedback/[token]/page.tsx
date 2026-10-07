import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { notFound } from "next/navigation";
import { FeedbackForm } from "./FeedbackForm";

export default async function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  
  const fb = await prisma.feedback.findUnique({
    where: { token },
  });

  const settings = await getSettings();

  if (!fb) {
    return (
      <main className="mx-auto w-full max-w-[600px] px-6 py-12">
        <div className="bg-card p-8 rounded-lg shadow-sm border text-center space-y-4">
          <h1 className="text-2xl font-bold">{settings.name}</h1>
          <p className="text-muted-foreground">This feedback link is invalid or has expired.</p>
          {settings.googleReviewUrl && (
            <div className="pt-4 border-t">
              <a 
                href={settings.googleReviewUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full border-2 border-orange-600 text-orange-600 hover:bg-orange-50 font-bold py-3 rounded-lg transition-colors"
              >
                Review us on Google instead
              </a>
            </div>
          )}
        </div>
      </main>
    );
  }

  if (fb.tokenExpiresAt < new Date()) {
    return (
      <main className="mx-auto w-full max-w-[600px] px-6 py-12">
        <div className="bg-card p-8 rounded-lg shadow-sm border text-center space-y-4">
          <h1 className="text-2xl font-bold">{settings.name}</h1>
          <p className="text-muted-foreground">This feedback link has expired.</p>
          {settings.googleReviewUrl && (
            <div className="pt-4 border-t">
              <a 
                href={settings.googleReviewUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full border-2 border-orange-600 text-orange-600 hover:bg-orange-50 font-bold py-3 rounded-lg transition-colors"
              >
                Review us on Google instead
              </a>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[600px] px-6 py-12 space-y-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">{settings.name}</h1>
        <p className="text-muted-foreground">We value your feedback.</p>
      </div>

      {fb.submittedAt ? (
        <div className="bg-green-50 p-6 rounded-lg text-green-800 text-center space-y-4">
          <h2 className="text-xl font-bold mb-2">Thanks, we already have your feedback</h2>
          {settings.googleReviewUrl && (
            <div className="pt-4 border-t border-green-200">
              <a 
                href={settings.googleReviewUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-white border border-green-600 text-green-700 hover:bg-green-50 font-bold py-3 rounded-lg transition-colors"
              >
                Review us on Google
              </a>
            </div>
          )}
        </div>
      ) : (
        <FeedbackForm token={token} googleReviewUrl={settings.googleReviewUrl || undefined} />
      )}
    </main>
  );
}
