"use server";

import { askMenuAssistant } from "./assistant";
import { getDeviceId } from "@/lib/device";

export async function askMenuAction(params: { question: string; locale: string }) {
  const deviceId = await getDeviceId();
  return await askMenuAssistant({
    question: params.question,
    deviceId,
    locale: params.locale
  });
}
