import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  getPublicTableById,
  getTablesForResource,
  type StorefrontResourceType,
} from "../models/table.server";

const VALID_TYPES: StorefrontResourceType[] = ["product", "collection", "page"];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    return jsonResponse({ tables: [] });
  }

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const id = url.searchParams.get("id");
  const tableId = url.searchParams.get("tableId");

  // When the merchant pins a specific table to the block via its Table ID,
  // return that table directly so it can render on any template.
  if (tableId) {
    const table = await getPublicTableById(session.shop, tableId);
    return jsonResponse({ tables: table ? [table] : [] });
  }

  if (!type || !id || !VALID_TYPES.includes(type as StorefrontResourceType)) {
    return jsonResponse({ tables: [] });
  }

  const tables = await getTablesForResource(
    session.shop,
    type as StorefrontResourceType,
    id,
  );

  return jsonResponse({ tables });
};
