import { getTranslations } from "next-intl/server";
export default async function TableLoading() { const text = await getTranslations("table"); return <main id="main" className="mx-auto max-w-content px-6 py-8"><p role="status">{text("loading")}</p></main>; }
