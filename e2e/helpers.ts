import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const HARNESS = "http://localhost:4100/__e2e";
export const DEMO_PASSWORD = "Demo1234";
export const OWNER = { email: "owner@nexora.test", password: "Owner1234" };

export const resetData = async (request: APIRequestContext) => {
  const res = await request.post(`${HARNESS}/reset`);
  expect(res.status()).toBe(204);
};

// The last email sent to an address; retried because emails go out after the response.
export const lastEmailTo = async (request: APIRequestContext, to: string) => {
  let body: { subject: string; token?: string } | undefined;
  await expect
    .poll(async () => {
      const res = await request.get(`${HARNESS}/emails?to=${encodeURIComponent(to)}`);
      body = res.ok() ? await res.json() : undefined;
      return Boolean(body?.token);
    })
    .toBe(true);
  return body!;
};

export const logIn = async (page: Page, email: string, password = DEMO_PASSWORD) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
};

export const logOut = async (page: Page) => {
  await page.getByRole("button", { name: "Log out" }).click();
  await page.waitForURL(/\/(login)?$/);
};
