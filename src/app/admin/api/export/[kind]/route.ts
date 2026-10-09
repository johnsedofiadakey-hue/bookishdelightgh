import { NextResponse, type NextRequest } from "next/server";
import { recordAudit } from "@/lib/admin/audit";
import { requireStaff } from "@/lib/admin/auth/guard";
import { can, type StaffContext } from "@/lib/admin/context";
import { toCsv } from "@/lib/admin/csv";
import { httpStatusFor, isAdminError } from "@/lib/admin/errors";
import { pesewasToDecimal } from "@/lib/admin/format";
import { exportCatalogueCsv, importTemplateCsv } from "@/lib/admin/ops/catalogue-import";
import { listInventory } from "@/lib/admin/ops/inventory";
import { listOrders } from "@/lib/admin/ops/orders";
import { defaultWindow, listAudit, lowStockReport, salesReport, stockMovementReport, type DateWindow } from "@/lib/admin/ops/reports";
import type { Permission } from "@/lib/admin/permissions";
import { getAdminStore } from "@/lib/admin/store";

/** CSV exports. Each kind checks its own permission server-side. Exports are audited. */

const PERMISSION: Record<string, Permission> = {
  catalogue: "catalogue.view",
  "import-template": "catalogue.import",
  inventory: "inventory.view",
  "low-stock": "inventory.view",
  orders: "orders.view",
  sales: "reports.view",
  movements: "reports.view",
  audit: "audit.view",
};

function windowFrom(request: NextRequest): DateWindow {
  const fallback = defaultWindow(30);
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const valid = (value: string | null) => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
  return { from: valid(from) ? from! : fallback.from, to: valid(to) ? to! : fallback.to };
}

async function build(kind: string, ctx: StaffContext, request: NextRequest): Promise<string> {
  const store = getAdminStore();
  switch (kind) {
    case "catalogue":
      return exportCatalogueCsv(store, ctx);
    case "import-template":
      return importTemplateCsv();
    case "inventory": {
      const rows = await listInventory(store, ctx);
      const showCost = can(ctx, "finance.view");
      return toCsv(
        ["sku", "title", "format", "isbn", "on_hand", "reserved", "available", "low_stock_threshold", "state", "price_ghs", ...(showCost ? ["cost_ghs"] : []), "active", "book_status"],
        rows.map((row) => [row.sku, row.title, row.format, row.isbn ?? "", row.onHand, row.reserved, row.available, row.lowStockThreshold, row.state, pesewasToDecimal(row.pricePesewas), ...(showCost ? [row.costPesewas !== undefined ? pesewasToDecimal(row.costPesewas) : ""] : []), row.active ? "yes" : "no", row.bookStatus]),
      );
    }
    case "low-stock": {
      const rows = await lowStockReport(store, ctx);
      return toCsv(["sku", "title", "format", "on_hand", "reserved", "available", "threshold", "state", "published"], rows.map((row) => [row.sku, row.title, row.format, row.onHand, row.reserved, row.available, row.threshold, row.state, row.published ? "yes" : "no"]));
    }
    case "orders": {
      const params = request.nextUrl.searchParams;
      const rows = await listOrders(store, ctx, { payment: (params.get("payment") as never) ?? "all", fulfilment: (params.get("fulfilment") as never) ?? "all", channel: (params.get("channel") as never) ?? "all", q: params.get("q") ?? undefined });
      return toCsv(["ref", "created_at", "channel", "customer", "contact", "region", "city", "items", "total_ghs", "payment_status", "fulfilment_status", "courier"], rows.map((row) => [row.ref, row.createdAt, row.channel, row.customerName, row.customerContact, row.region, row.city, row.itemCount, pesewasToDecimal(row.totalPesewas), row.paymentStatus, row.fulfilmentStatus, row.courier ?? ""]));
    }
    case "sales": {
      const report = await salesReport(store, ctx, windowFrom(request));
      const note = toCsv(["note"], [[`Paid orders only (verified payment), ${report.window.from} to ${report.window.to} by paid date (Africa/Accra). Gross ${pesewasToDecimal(report.totals.grossPesewas)} GHS; processed refunds ${pesewasToDecimal(report.totals.refundsPesewas)} GHS; net ${pesewasToDecimal(report.totals.netPesewas)} GHS. ${report.excluded.count} unpaid/failed order(s) excluded.`]]);
      const byDay = toCsv(["day", "paid_orders", "gross_ghs"], report.days.map((day) => [day.day, day.orders, pesewasToDecimal(day.grossPesewas)]));
      const byVariant = toCsv(["sku", "title", "format", "units", "gross_ghs"], report.byVariant.map((row) => [row.sku, row.title, row.format, row.units, pesewasToDecimal(row.grossPesewas)]));
      const byRegion = toCsv(["region", "orders", "gross_ghs", "delivery_ghs"], report.byRegion.map((row) => [row.region, row.orders, pesewasToDecimal(row.grossPesewas), pesewasToDecimal(row.deliveryPesewas)]));
      return [note, byDay, byVariant, byRegion].join("\r\n");
    }
    case "movements": {
      const report = await stockMovementReport(store, ctx, windowFrom(request));
      return toCsv(["created_at", "sku", "type", "on_hand_delta", "reserved_delta", "on_hand_after", "reserved_after", "reason", "reference", "order_id", "actor"], report.movements.map((movement) => [movement.createdAt, movement.sku, movement.type, movement.onHandDelta, movement.reservedDelta, movement.onHandAfter, movement.reservedAfter, movement.reason, movement.reference, movement.orderId ?? "", movement.actorName]));
    }
    case "audit": {
      const events = await listAudit(store, ctx, { limit: 2000 });
      return toCsv(["at", "actor", "role", "action", "entity_type", "entity_id", "summary", "reason", "request_id"], events.map((event) => [event.at, event.actorName, event.actorRole, event.action, event.entityType, event.entityId, event.summary, event.reason ?? "", event.requestId]));
    }
    default:
      return "";
  }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const permission = PERMISSION[kind];
  if (!permission) return NextResponse.json({ error: "Unknown export." }, { status: 404 });
  try {
    const ctx = await requireStaff(permission);
    const csv = await build(kind, ctx, request);
    if (kind !== "import-template") {
      await getAdminStore().runTransaction(async (tx) => {
        recordAudit(tx, ctx, { action: "export.csv", entityType: "export", entityId: kind, summary: `Exported ${kind} CSV` });
      });
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(`﻿${csv}`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bookish-${kind}-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (isAdminError(error)) return NextResponse.json({ error: error.message }, { status: httpStatusFor[error.code] });
    throw error;
  }
}
