import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteTable, getTable, getTables } from "../models/table.server";
import { deleteTableMetaobject } from "../models/metaobject.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const tables = await getTables(session.shop);
  return { tables };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const id = formData.get("id");
    if (typeof id === "string") {
      const existing = await getTable(session.shop, id);
      if (existing?.metaobjectId) {
        await deleteTableMetaobject(admin, existing.metaobjectId);
      }
      await deleteTable(session.shop, id);
    }
  }

  return { ok: true };
};

function displayOnLabels(table: {
  displayPages: boolean;
  displayCollections: boolean;
  displayProducts: boolean;
}) {
  const labels: string[] = [];
  if (table.displayPages) labels.push("Pages");
  if (table.displayCollections) labels.push("Collections");
  if (table.displayProducts) labels.push("Products");
  return labels;
}

interface TableRow {
  id: string;
  name: string;
  displayPages: boolean;
  displayCollections: boolean;
  displayProducts: boolean;
  type: "build" | "gsheet";
}

export default function TablesIndex() {
  const { tables } = useLoaderData<typeof loader>() as { tables: TableRow[] };
  const fetcher = useFetcher();
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const confirmDelete = () => {
    if (!pendingDelete) return;
    fetcher.submit(
      { intent: "delete", id: pendingDelete.id },
      { method: "POST" },
    );
    setPendingDelete(null);
  };

  return (
    <s-page heading="Tables">
      <s-button slot="primary-action" variant="primary" href="/app/tables/new">
        Add New
      </s-button>

      {tables.length === 0 ? (
        <s-section heading="No tables yet">
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Create your first table to display custom content on your
              store&apos;s pages, collections, or products.
            </s-paragraph>
            <s-box>
              <s-button variant="primary" href="/app/tables/new">
                Add New
              </s-button>
            </s-box>
          </s-stack>
        </s-section>
      ) : (
        <s-section heading="Your tables">
          <s-table>
            <s-table-header-row>
              <s-table-header>Name</s-table-header>
              <s-table-header>Display On</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {tables.map((table) => (
                <s-table-row key={table.id}>
                  <s-table-cell>
                    <s-stack direction="block" gap="small-500">
                      <s-link href={`/app/tables/${table.id}`}>
                        {table.name || "Untitled table"}
                      </s-link>
                      <s-text color="subdued">ID: {table.id}</s-text>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-300">
                      {displayOnLabels(table).length === 0 ? (
                        <s-text color="subdued">—</s-text>
                      ) : (
                        displayOnLabels(table).map((label) => (
                          <s-badge key={label}>{label}</s-badge>
                        ))
                      )}
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    {table.type === "gsheet" ? "Google Sheets" : "Build Table"}
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-300">
                      <s-button
                        variant="tertiary"
                        href={`/app/tables/${table.id}`}
                      >
                        Edit
                      </s-button>
                      <s-button
                        variant="tertiary"
                        tone="critical"
                        command="--show"
                        commandFor="delete-table-modal"
                        onClick={() =>
                          setPendingDelete({ id: table.id, name: table.name })
                        }
                      >
                        Delete
                      </s-button>
                    </s-stack>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      <s-modal id="delete-table-modal" heading="Delete table">
        <s-paragraph>
          Are you sure you want to delete{" "}
          <s-text type="strong">{pendingDelete?.name || "this table"}</s-text>?
          This action can&apos;t be undone.
        </s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          command="--hide"
          commandFor="delete-table-modal"
          onClick={confirmDelete}
        >
          Delete
        </s-button>
        <s-button
          slot="secondary-actions"
          command="--hide"
          commandFor="delete-table-modal"
          onClick={() => setPendingDelete(null)}
        >
          Cancel
        </s-button>
      </s-modal>
    </s-page>
  );
}
