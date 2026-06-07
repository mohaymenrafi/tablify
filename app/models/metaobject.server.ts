import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

/**
 * App-owned metaobject type that mirrors Tablify tables so merchants can pick a
 * table from a native list in the theme editor. Declared in shopify.app.toml
 * under [metaobjects.app.tablify_table]; the `$app:` prefix resolves to the
 * reserved app-owned type at runtime.
 */
const METAOBJECT_TYPE = "$app:tablify_table";

interface TableMetaobjectInput {
  tableId: string;
  name: string;
}

interface UserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

function buildFields(input: TableMetaobjectInput) {
  return [
    { key: "name", value: input.name || "Untitled table" },
    { key: "table_id", value: input.tableId },
  ];
}

async function readJson(response: Response) {
  return (await response.json()) as {
    data?: Record<string, { metaobject?: { id: string } | null; userErrors?: UserError[] }>;
  };
}

/**
 * Creates or updates the metaobject entry that mirrors a table. Returns the GID
 * of the entry, or null when the sync fails (the table still saves either way).
 */
export async function syncTableMetaobject(
  admin: AdminApiContext,
  input: TableMetaobjectInput,
  existingMetaobjectId: string | null,
): Promise<string | null> {
  try {
    if (existingMetaobjectId) {
      const response = await admin.graphql(
        `#graphql
        mutation UpdateTableMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
          metaobjectUpdate(id: $id, metaobject: $metaobject) {
            metaobject { id }
            userErrors { field message code }
          }
        }`,
        {
          variables: {
            id: existingMetaobjectId,
            metaobject: { fields: buildFields(input) },
          },
        },
      );
      const body = await readJson(response);
      const result = body.data?.metaobjectUpdate;
      if (result?.userErrors && result.userErrors.length > 0) {
        // The entry may have been deleted in the admin — fall through to create.
        return createTableMetaobject(admin, input);
      }
      return result?.metaobject?.id ?? existingMetaobjectId;
    }

    return createTableMetaobject(admin, input);
  } catch {
    return existingMetaobjectId;
  }
}

async function createTableMetaobject(
  admin: AdminApiContext,
  input: TableMetaobjectInput,
): Promise<string | null> {
  const response = await admin.graphql(
    `#graphql
    mutation CreateTableMetaobject($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject { id }
        userErrors { field message code }
      }
    }`,
    {
      variables: {
        metaobject: {
          type: METAOBJECT_TYPE,
          handle: input.tableId,
          fields: buildFields(input),
        },
      },
    },
  );
  const body = await readJson(response);
  return body.data?.metaobjectCreate?.metaobject?.id ?? null;
}

/**
 * Deletes the metaobject entry mirroring a table. Failures are swallowed so a
 * table delete never blocks on metaobject cleanup.
 */
export async function deleteTableMetaobject(
  admin: AdminApiContext,
  metaobjectId: string,
): Promise<void> {
  try {
    await admin.graphql(
      `#graphql
      mutation DeleteTableMetaobject($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message code }
        }
      }`,
      { variables: { id: metaobjectId } },
    );
  } catch {
    // ignore
  }
}
