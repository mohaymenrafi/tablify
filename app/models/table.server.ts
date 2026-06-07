import prisma from "../db.server";

export interface SelectedResource {
  id: string;
  title: string;
}

export interface TableConfigData {
  name: string;
  displayPages: boolean;
  displayCollections: boolean;
  displayProducts: boolean;
  pages: SelectedResource[];
  collections: SelectedResource[];
  products: SelectedResource[];
  type: "build" | "gsheet";
  tableData: string[][];
  googleSheetUrl: string;
  googleSheetJson: string;
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function deserialize(record: {
  id: string;
  shop: string;
  name: string;
  displayPages: boolean;
  displayCollections: boolean;
  displayProducts: boolean;
  pages: string;
  collections: string;
  products: string;
  type: string;
  tableData: string;
  googleSheetUrl: string;
  googleSheetJson: string;
  metaobjectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: record.id,
    shop: record.shop,
    name: record.name,
    displayPages: record.displayPages,
    displayCollections: record.displayCollections,
    displayProducts: record.displayProducts,
    pages: safeParse<SelectedResource[]>(record.pages, []),
    collections: safeParse<SelectedResource[]>(record.collections, []),
    products: safeParse<SelectedResource[]>(record.products, []),
    type: record.type === "gsheet" ? ("gsheet" as const) : ("build" as const),
    tableData: safeParse<string[][]>(record.tableData, []),
    googleSheetUrl: record.googleSheetUrl,
    googleSheetJson: record.googleSheetJson,
    metaobjectId: record.metaobjectId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export type TableConfig = ReturnType<typeof deserialize>;

export async function getTables(shop: string) {
  const records = await prisma.tableConfig.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
  });
  return records.map(deserialize);
}

export async function getTable(shop: string, id: string) {
  const record = await prisma.tableConfig.findFirst({ where: { id, shop } });
  return record ? deserialize(record) : null;
}

/**
 * Extracts the trailing numeric id from a Shopify GID
 * (e.g. "gid://shopify/Product/123" -> "123").
 */
function numericIdOf(gid: string): string {
  const match = /(\d+)\s*$/.exec(gid);
  return match ? match[1] : gid;
}

export type StorefrontResourceType = "product" | "collection" | "page";

export interface PublicTable {
  id: string;
  name: string;
  type: "build" | "gsheet";
  tableData: string[][];
  googleSheetUrl: string;
}

/**
 * Returns the tables that should be displayed for a given storefront resource.
 * Matching is done by the numeric id so it works regardless of GID prefix.
 * Note: `googleSheetJson` is intentionally never exposed to the storefront.
 */
export async function getTablesForResource(
  shop: string,
  type: StorefrontResourceType,
  resourceId: string,
): Promise<PublicTable[]> {
  const target = numericIdOf(resourceId);
  const tables = await getTables(shop);

  return tables
    .filter((table) => {
      const enabled =
        type === "product"
          ? table.displayProducts
          : type === "collection"
            ? table.displayCollections
            : table.displayPages;
      if (!enabled) return false;

      const list =
        type === "product"
          ? table.products
          : type === "collection"
            ? table.collections
            : table.pages;

      return list.some((item) => numericIdOf(item.id) === target);
    })
    .map((table) => ({
      id: table.id,
      name: table.name,
      type: table.type,
      tableData: table.tableData,
      googleSheetUrl: table.googleSheetUrl,
    }));
}

/**
 * Returns a single table by its id, regardless of the resource it is assigned
 * to. Used when a merchant pins a specific table to the Tablify block via its
 * Table ID setting, so the table can be shown on any template.
 * Note: `googleSheetJson` is intentionally never exposed to the storefront.
 */
export async function getPublicTableById(
  shop: string,
  id: string,
): Promise<PublicTable | null> {
  const record = await prisma.tableConfig.findFirst({ where: { id, shop } });
  if (!record) return null;
  const table = deserialize(record);
  return {
    id: table.id,
    name: table.name,
    type: table.type,
    tableData: table.tableData,
    googleSheetUrl: table.googleSheetUrl,
  };
}

function serialize(data: TableConfigData) {
  return {
    name: data.name,
    displayPages: data.displayPages,
    displayCollections: data.displayCollections,
    displayProducts: data.displayProducts,
    pages: JSON.stringify(data.displayPages ? data.pages : []),
    collections: JSON.stringify(
      data.displayCollections ? data.collections : [],
    ),
    products: JSON.stringify(data.displayProducts ? data.products : []),
    type: data.type,
    tableData: JSON.stringify(data.type === "build" ? data.tableData : []),
    googleSheetUrl: data.type === "gsheet" ? data.googleSheetUrl : "",
    googleSheetJson: data.type === "gsheet" ? data.googleSheetJson : "",
  };
}

export async function createTable(shop: string, data: TableConfigData) {
  const record = await prisma.tableConfig.create({
    data: { shop, ...serialize(data) },
  });
  return deserialize(record);
}

export async function updateTable(
  shop: string,
  id: string,
  data: TableConfigData,
) {
  const result = await prisma.tableConfig.updateMany({
    where: { id, shop },
    data: serialize(data),
  });
  return result.count > 0;
}

export async function deleteTable(shop: string, id: string) {
  await prisma.tableConfig.deleteMany({ where: { id, shop } });
}

/**
 * Stores the GID of the mirrored Shopify metaobject entry on the table record.
 */
export async function setTableMetaobjectId(
  shop: string,
  id: string,
  metaobjectId: string | null,
) {
  await prisma.tableConfig.updateMany({
    where: { id, shop },
    data: { metaobjectId },
  });
}

export interface ParsedForm {
  data: TableConfigData;
  errors: Record<string, string>;
}

export function parseTableForm(formData: FormData): ParsedForm {
  const errors: Record<string, string> = {};

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) {
    errors.name = "Name is required";
  }

  const displayPages = formData.get("displayPages") === "true";
  const displayCollections = formData.get("displayCollections") === "true";
  const displayProducts = formData.get("displayProducts") === "true";

  const pages = safeParse<SelectedResource[]>(
    (formData.get("pages") as string | null) ?? "[]",
    [],
  );
  const collections = safeParse<SelectedResource[]>(
    (formData.get("collections") as string | null) ?? "[]",
    [],
  );
  const products = safeParse<SelectedResource[]>(
    (formData.get("products") as string | null) ?? "[]",
    [],
  );

  const type =
    (formData.get("type") as string | null) === "gsheet" ? "gsheet" : "build";

  const tableData = safeParse<string[][]>(
    (formData.get("tableData") as string | null) ?? "[]",
    [],
  );

  const googleSheetUrl = (
    (formData.get("googleSheetUrl") as string | null) ?? ""
  ).trim();
  const googleSheetJson = (
    (formData.get("googleSheetJson") as string | null) ?? ""
  ).trim();

  if (type === "gsheet" && !googleSheetUrl && !googleSheetJson) {
    errors.gsheet = "Provide a Google Spreadsheet URL or a JSON configuration";
  }

  return {
    data: {
      name,
      displayPages,
      displayCollections,
      displayProducts,
      pages,
      collections,
      products,
      type,
      tableData,
      googleSheetUrl,
      googleSheetJson,
    },
    errors,
  };
}
