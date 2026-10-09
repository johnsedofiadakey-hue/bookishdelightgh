"use server";

import type { ActionState } from "@/lib/admin/action-state";
import { bool, idempotencyKey, list, optionalText, runAction, text } from "@/lib/admin/actions";
import { getHomepage, publishHomepage, saveHomepageDraft } from "@/lib/admin/ops/content";
import type { HomepageContent } from "@/lib/admin/types";

export async function saveHomepageAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("content.edit", async ({ store, ctx }) => {
    const current = await getHomepage(store, ctx);
    const shelfIds = list(form, "shelfId");
    const draft: HomepageContent = {
      hero: {
        eyebrow: text(form, "heroEyebrow").trim(),
        heading: text(form, "heroHeading").trim(),
        intro: text(form, "heroIntro").trim(),
        ctaLabel: text(form, "heroCtaLabel").trim() || "Explore the shelves",
        ctaHref: text(form, "heroCtaHref").trim() || "/shop",
        image: current.draft.hero.image,
      },
      announcement: { text: text(form, "announcementText").trim(), enabled: bool(form, "announcementEnabled") },
      featuredShelves: shelfIds.map((id) => ({ id, title: text(form, `shelfTitle:${id}`).trim(), bookIds: list(form, `shelfBooks:${id}`) })).filter((shelf) => shelf.title),
      ghanaianPicks: list(form, "ghanaianPicks"),
      trustPoints: text(form, "trustPoints").split("\n").map((point) => point.trim()).filter(Boolean).slice(0, 6),
      deliveryCopy: text(form, "deliveryCopy").trim(),
    };
    const newShelfTitle = optionalText(form, "newShelfTitle");
    if (newShelfTitle) draft.featuredShelves.push({ id: `shelf-${Date.now().toString(36)}`, title: newShelfTitle, bookIds: [] });
    await saveHomepageDraft(store, ctx, draft, idempotencyKey(form));
    return { message: "Draft saved. Publish when you’re ready for it to go live." };
  });
}

export async function publishHomepageAction(_state: ActionState, form: FormData): Promise<ActionState> {
  return runAction("content.publish", async ({ store, ctx }) => {
    await publishHomepage(store, ctx, idempotencyKey(form));
    return { message: "Homepage published." };
  });
}
