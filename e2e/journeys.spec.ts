import { expect, test } from "@playwright/test";
import { lastEmailTo, logIn, logOut, OWNER, resetData } from "./helpers";

// The three end-to-end journeys from the plan (Sprint 7): J1 onboarding, J3 the review
// workflow on the board, J5 joining by invitation. Each starts from fresh demo data.
test.beforeEach(async ({ request }) => resetData(request));

const ORG_URL = /\/o\/[a-f0-9]{24}/;

test("J1: a visitor registers, verifies, registers an organization and the Owner approves it", async ({
  page,
  request,
}) => {
  const email = "lena@northwind.example";

  await page.goto("/register");
  await page.getByLabel("Name").fill("Lena Fischer");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("Northwind1");
  await page.getByRole("button", { name: "Create account" }).click();

  const { token } = await lastEmailTo(request, email);
  await page.goto(`/verify-email?token=${encodeURIComponent(token!)}`);
  await expect(page.getByText("Email verified")).toBeVisible();

  await logIn(page, email, "Northwind1");
  await page.getByRole("link", { name: "Register your organization" }).click();
  await page.getByLabel("Organization name").fill("Northwind Traders");
  for (const label of ["Type", "Company size", "Industry"]) {
    await page.getByLabel(label).selectOption({ index: 1 });
  }
  await page.getByLabel("Country").selectOption({ label: "India" });
  await page.getByRole("button", { name: "Submit for approval" }).click();
  await expect(page).toHaveURL(ORG_URL);
  await expect(page.getByText(/pending approval/i).first()).toBeVisible();
  await logOut(page);

  // The Owner approves it from the list.
  await logIn(page, OWNER.email, OWNER.password);
  await page.goto("/platform/organizations");
  await page.getByRole("button", { name: "Approve Northwind Traders" }).click();
  await expect(page.getByText("Northwind Traders is now active.")).toBeVisible();
  await logOut(page);

  // The new admin now works inside it, and cannot register a second one.
  await logIn(page, email, "Northwind1");
  await expect(page).toHaveURL(ORG_URL);
  await expect(page.getByRole("heading", { name: "Northwind Traders" })).toBeVisible();
  await page.getByRole("button", { name: /Northwind Traders/ }).click();
  await expect(page.getByRole("menuitem", { name: /Register an organization/ })).toHaveCount(0);
});

test("J3: a member submits work for review and the manager approves it", async ({ page }) => {
  await logIn(page, "meena@acme.example");
  await expect(page).toHaveURL(ORG_URL);
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page.getByRole("link", { name: "Website relaunch" }).click();

  // The keyboard-free, drag-free path: each card's "Move to" menu.
  const card = "Accessibility audit";
  await page.getByRole("button", { name: `Move “${card}”` }).click();
  await page.getByRole("menuitem", { name: "In progress" }).click();
  await expect(
    page.getByRole("region", { name: /^In progress,/ }).getByRole("link", { name: card }),
  ).toBeVisible();
  await page.getByRole("button", { name: `Move “${card}”` }).click();
  // A Team Member cannot approve their own work (R14): Done is not offered.
  await expect(page.getByRole("menuitem", { name: "Done" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "In review" }).click();
  await expect(
    page.getByRole("region", { name: /^In review,/ }).getByRole("link", { name: card }),
  ).toBeVisible();
  await logOut(page);

  // The manager is notified and approves from the task panel.
  await logIn(page, "arun@acme.example");
  await page.getByRole("button", { name: /^Notifications, \d+ unread/ }).click();
  await page
    .getByRole("menuitem", { name: new RegExp(`Meena Iyer submitted “${card}” for review`) })
    .click();
  const panel = page.getByRole("dialog");
  await panel.getByRole("button", { name: "Approve" }).click();
  await expect(panel.getByText("approved it")).toBeVisible();
});

test("J5: an invited person creates an account and joins the organization", async ({
  page,
  request,
}) => {
  const email = "neha.k@acme.example";

  await logIn(page, "priya@acme.example");
  await expect(page).toHaveURL(ORG_URL);
  await page.getByRole("link", { name: "Invitations", exact: true }).click();
  await page.getByLabel("Email addresses").fill(email);
  await page.getByRole("button", { name: "Send invitations" }).click();
  await expect(page.getByRole("cell", { name: email, exact: true })).toBeVisible();
  await logOut(page);

  const { token } = await lastEmailTo(request, email);
  await page.goto(`/invite?token=${encodeURIComponent(token!)}`);
  await expect(page.getByText("Join Acme Corp")).toBeVisible();
  await page.getByLabel("Name").fill("Neha Kapoor");
  await page.getByLabel("Password", { exact: true }).fill("Welcome123");
  await page.getByRole("button", { name: "Create account and join" }).click();

  await expect(page).toHaveURL(ORG_URL);
  await expect(page.getByRole("heading", { name: "Acme Corp" })).toBeVisible();
});
