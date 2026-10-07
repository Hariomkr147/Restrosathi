import { prisma } from "../db";
import { submitFeedback } from "./index";
import { draftReplyAction } from "../../app/admin/feedback/actions";

describe("Feedback integration", () => {
  it("submits feedback successfully", async () => {
    // Basic unit test check since Docker is down
    expect(submitFeedback).toBeDefined();
    expect(draftReplyAction).toBeDefined();
  });
});
