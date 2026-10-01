import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async () => {
  const value = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale = value === "hi" ? "hi" : "en";
  return {
    locale,
    timeZone: "Asia/Kolkata",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
