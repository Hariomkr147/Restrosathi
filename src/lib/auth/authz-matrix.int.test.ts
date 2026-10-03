// Add every new server action/route here; document explicit public exceptions.
import { afterEach, expect, it, vi } from "vitest";
import { asAnonymous, asOwner, asStaff, cookieJar } from "../../../tests/helpers/auth";
import { AuthError, destroySession, getCurrentUser } from "./session";
import * as menu from "../../app/admin/menu/actions";
import { updateSettings } from "../../app/admin/settings/actions";
import { logout } from "../../app/login/actions";
import { setLocale } from "../../app/actions/locale";
import { POST } from "../../app/api/menu-photo/route";
import * as tables from "../../app/admin/tables/actions";
import { placeOrderAction, serviceRequestAction } from "../../app/t/[code]/actions";
import * as orders from "../../app/admin/orders/actions";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const roles = [
  { role: "anonymous", signIn: asAnonymous },
  { role: "staff", signIn: asStaff },
  { role: "owner", signIn: asOwner },
];
afterEach(async () => { await destroySession(); asAnonymous(); });

const ownerActions = [
  { name: "upsertCategory", run: () => menu.upsertCategory({}), error: "INVALID_INPUT" },
  { name: "deleteCategory", run: () => menu.deleteCategory("starters"), error: "CATEGORY_NOT_EMPTY" },
  { name: "upsertItem", run: () => menu.upsertItem({}), error: "INVALID_INPUT" },
  { name: "deleteItem", run: () => menu.deleteItem("__matrix_absent"), error: "NOT_FOUND" },
  { name: "reorderMenu", run: () => menu.reorderMenu("category", "__matrix_absent", "up"), error: "NOT_FOUND" },
  { name: "uploadMenuPhoto", run: () => menu.uploadMenuPhoto(new FormData()), error: "UNSUPPORTED_TYPE" },
];
for (const { role, signIn } of roles) {
  it(`${role}: serviceRequestAction is explicitly public and validates input`, async () => {
    await signIn(); expect(await serviceRequestAction("", "CALL_WAITER")).toEqual({ ok: false, error: "INVALID_INPUT" });
  });
  for (const action of [
    { name: "acceptOrder", run: () => orders.acceptOrder("__absent") },
    { name: "rejectOrder", run: () => orders.rejectOrder("__absent", "Kitchen closed") },
    { name: "markReady", run: () => orders.markReady("__absent") },
    { name: "markServed", run: () => orders.markServed("__absent") },
    { name: "voidLine", run: () => orders.voidLine("__absent", "Made twice") },
  ]) {
    it(`${role}: ${action.name} requires a signed-in user`, async () => {
      await signIn(); expect(await action.run()).toEqual({ ok: false, error: role === "anonymous" ? "FORBIDDEN" : "NOT_FOUND" });
    });
  }
  // Public: QR ordering does not require a diner to log in.
  it(`${role}: placeOrderAction is explicitly public and validates input`, async () => {
    await signIn();
    expect(await placeOrderAction({})).toEqual({ ok: false, error: "INVALID_INPUT" });
  });
  for (const action of [
    { name: "createTable", run: () => tables.createTable(""), error: "INVALID_LABEL" },
    { name: "renameTable", run: () => tables.renameTable("__absent", ""), error: "INVALID_LABEL" },
    { name: "setTableActive", run: () => tables.setTableActive("__absent", false), error: "NOT_FOUND" },
    { name: "regenerateTableCode", run: () => tables.regenerateTableCode("__absent"), error: "NOT_FOUND" },
  ]) {
    it(`${role}: ${action.name} requires owner permission`, async () => {
      await signIn();
      expect(await action.run()).toMatchObject({ ok: false, error: role === "owner" ? action.error : "FORBIDDEN" });
    });
  }
  for (const action of ownerActions) {
    it(`${role}: ${action.name} requires owner permission before validation/work`, async () => {
      await signIn();
      expect(await action.run()).toMatchObject({ ok: false, error: role === "owner" ? action.error : "FORBIDDEN" });
    });
  }
  it(`${role}: updateSettings requires owner permission`, async () => {
    await signIn();
    if (role === "owner") expect(await updateSettings({})).toMatchObject({ ok: false, fieldErrors: expect.any(Object) });
    else await expect(updateSettings({})).rejects.toBeInstanceOf(AuthError);
  });
  it(`${role}: availability allows staff and owner`, async () => {
    await signIn();
    expect(await menu.setItemAvailability("dal-makhani", true)).toMatchObject(role === "anonymous"
      ? { ok: false, error: "FORBIDDEN" } : { ok: true });
  });
  it(`${role}: menu-photo POST requires owner permission`, async () => {
    await signIn();
    const response = await POST(new Request("http://localhost:3000/api/menu-photo", {
      method: "POST", headers: { origin: "http://localhost:3000" },
    }));
    expect(response.status).toBe(role === "owner" ? 415 : 403);
  });
  it(`${role}: logout requires a signed-in user`, async () => {
    await signIn();
    if (role === "anonymous") await expect(logout()).rejects.toBeInstanceOf(AuthError);
    else {
      await expect(logout()).rejects.toMatchObject({ digest: expect.stringContaining("NEXT_REDIRECT") });
      expect(await getCurrentUser()).toBeNull();
    }
  });
  // Public: a bounded locale preference must work before login.
  it(`${role}: setLocale is explicitly public`, async () => {
    await signIn(); await setLocale("hi");
    expect(cookieJar.get("NEXT_LOCALE")?.value).toBe("hi");
  });
}
// Public: password/PIN login establishes authentication (auth.int.test.ts).
// Public: GET /uploads serves validated menu images to diners (routes.int.test.ts).
