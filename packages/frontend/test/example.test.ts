import { test } from "vitest";
import { page, userEvent, server } from "vitest/browser";

test("example", async () => {
  const el = page.getByRole("button");
  await userEvent.click(el);
  console.log(server.provider);
});
