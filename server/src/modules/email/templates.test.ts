import { describe, expect, it } from "vitest";
import { appLink, escapeHtml, passwordResetEmail, verificationEmail } from "./templates";

const link = "http://localhost:5173/verify-email?token=abc";

describe("appLink", () => {
  it("builds a frontend link from APP_URL and URL-encodes the token", () => {
    expect(appLink("/verify-email", "a+b/c")).toBe(
      "http://localhost:5173/verify-email?token=a%2Bb%2Fc",
    );
  });
});

describe("escapeHtml", () => {
  it("escapes characters that have meaning in HTML", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe(
      "&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;",
    );
  });
});

describe.each([
  ["verificationEmail", verificationEmail, "24 hours"],
  ["passwordResetEmail", passwordResetEmail, "1 hour"],
])("%s", (_name, template, expiry) => {
  it("includes the link and expiry in both html and text", () => {
    const email = template("Priya", link);

    expect(email.subject).not.toBe("");
    expect(email.text).toContain(link);
    expect(email.html).toContain(link);
    expect(email.text).toContain(expiry);
    expect(email.html).toContain(expiry);
  });

  it("escapes the user's name in html", () => {
    const email = template("<script>alert(1)</script>", link);

    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});
