"use client";

export function SendPromoButton({ phone }: { phone: string }) {
  const handleSend = () => {
    // Read the drafted message from the textarea rendered by CampaignUI
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null;
    let message = "";
    if (textarea) {
      message = textarea.value;
    }
    
    if (!message) {
      alert("Please draft a campaign message first.");
      return;
    }

    const text = encodeURIComponent(message);
    const waPhone = phone.replace("+", "");
    window.open(`https://wa.me/${waPhone}?text=${text}`, "_blank");
  };

  return (
    <button 
      onClick={handleSend}
      className="text-orange-600 hover:underline font-medium ml-4"
    >
      Send Promo
    </button>
  );
}
