import { useCallback, useMemo, useState } from "react";
import { useNavigate, useNavigation, useSubmit } from "react-router";
import type { SelectedResource, TableConfig } from "../models/table.server";
import TableBuilder, { createEmptyGrid } from "./TableBuilder";
import ResourceSelector from "./ResourceSelector";

interface TableFormProps {
  mode: "create" | "edit";
  table?: TableConfig;
  errors?: Record<string, string>;
}

interface FormState {
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

export default function TableForm({ mode, table, errors }: TableFormProps) {
  const submit = useSubmit();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const [state, setState] = useState<FormState>(() => ({
    name: table?.name ?? "",
    displayPages: table?.displayPages ?? false,
    displayCollections: table?.displayCollections ?? false,
    displayProducts: table?.displayProducts ?? false,
    pages: table?.pages ?? [],
    collections: table?.collections ?? [],
    products: table?.products ?? [],
    type: table?.type ?? "build",
    tableData:
      table?.tableData && table.tableData.length > 0
        ? table.tableData
        : createEmptyGrid(),
    googleSheetUrl: table?.googleSheetUrl ?? "",
    googleSheetJson: table?.googleSheetJson ?? "",
  }));

  const update = useCallback(<K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => {
    setState((current) => ({ ...current, [key]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    const payload: Record<string, string> = {
      name: state.name,
      displayPages: String(state.displayPages),
      displayCollections: String(state.displayCollections),
      displayProducts: String(state.displayProducts),
      pages: JSON.stringify(state.pages),
      collections: JSON.stringify(state.collections),
      products: JSON.stringify(state.products),
      type: state.type,
      tableData: JSON.stringify(state.tableData),
      googleSheetUrl: state.googleSheetUrl,
      googleSheetJson: state.googleSheetJson,
    };
    submit(payload, { method: "POST" });
  }, [state, submit]);

  const heading = mode === "create" ? "Add new table" : "Edit table";

  const hasErrors = useMemo(
    () => errors && Object.keys(errors).length > 0,
    [errors],
  );

  return (
    <s-page heading={heading}>
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={handleSubmit}
        {...(isSaving ? { loading: true } : {})}
      >
        Save
      </s-button>
      <s-button slot="secondary-actions" onClick={() => navigate("/app")}>
        Cancel
      </s-button>

      {hasErrors && (
        <s-banner tone="critical" heading="Please fix the following">
          <s-unordered-list>
            {Object.values(errors ?? {}).map((message) => (
              <s-list-item key={message}>{message}</s-list-item>
            ))}
          </s-unordered-list>
        </s-banner>
      )}

      <s-section heading="Details">
        <s-stack direction="block" gap="large">
          <s-text-field
            label="Name"
            placeholder="My pricing table"
            value={state.name}
            error={errors?.name}
            onInput={(event) =>
              update("name", (event.target as HTMLInputElement).value)
            }
          />

          <s-stack direction="block" gap="base">
            <s-text type="strong">Display On</s-text>
            <s-stack direction="block" gap="small-300">
              <s-checkbox
                label="Pages"
                checked={state.displayPages}
                onChange={(event) =>
                  update(
                    "displayPages",
                    (event.target as HTMLInputElement).checked,
                  )
                }
              />
              <s-checkbox
                label="Collections"
                checked={state.displayCollections}
                onChange={(event) =>
                  update(
                    "displayCollections",
                    (event.target as HTMLInputElement).checked,
                  )
                }
              />
              <s-checkbox
                label="Products"
                checked={state.displayProducts}
                onChange={(event) =>
                  update(
                    "displayProducts",
                    (event.target as HTMLInputElement).checked,
                  )
                }
              />
            </s-stack>

            {state.displayPages && (
              <ResourceSelector
                kind="page"
                label="Pages"
                selected={state.pages}
                onChange={(value) => update("pages", value)}
              />
            )}
            {state.displayCollections && (
              <ResourceSelector
                kind="collection"
                label="Collections"
                selected={state.collections}
                onChange={(value) => update("collections", value)}
              />
            )}
            {state.displayProducts && (
              <ResourceSelector
                kind="product"
                label="Products"
                selected={state.products}
                onChange={(value) => update("products", value)}
              />
            )}
          </s-stack>

          <s-select
            label="Type"
            value={state.type}
            onChange={(event) =>
              update(
                "type",
                (event.target as HTMLSelectElement).value as
                  | "build"
                  | "gsheet",
              )
            }
          >
            <s-option value="build">Build Table</s-option>
            <s-option value="gsheet">Table from Google Sheets</s-option>
          </s-select>
        </s-stack>
      </s-section>

      {state.type === "build" ? (
        <s-section heading="Table builder">
          <TableBuilder
            value={state.tableData}
            onChange={(grid) => update("tableData", grid)}
          />
        </s-section>
      ) : (
        <s-section heading="Google Sheets">
          <s-stack direction="block" gap="large">
            <s-url-field
              label="Google Spreadsheet URL"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={state.googleSheetUrl}
              error={errors?.gsheet}
              onInput={(event) =>
                update(
                  "googleSheetUrl",
                  (event.target as HTMLInputElement).value,
                )
              }
            />
            <s-text-area
              label="JSON file"
              details="Paste the JSON you generated from the Google Cloud Console, or upload it below."
              rows={6}
              value={state.googleSheetJson}
              onInput={(event) =>
                update(
                  "googleSheetJson",
                  (event.target as HTMLTextAreaElement).value,
                )
              }
            />
            <JsonFileUpload
              onLoaded={(content) => update("googleSheetJson", content)}
            />
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

function JsonFileUpload({
  onLoaded,
}: {
  onLoaded: (content: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const text = await file.text();
        JSON.parse(text);
        onLoaded(text);
      } catch {
        setError("That file isn't valid JSON.");
      }
    },
    [onLoaded],
  );

  return (
    <s-stack direction="block" gap="small-300">
      <label>
        <s-button
          onClick={(event) => {
            const input = (
              event.currentTarget as HTMLElement
            ).parentElement?.querySelector("input");
            (input as HTMLInputElement | null)?.click();
          }}
        >
          Upload JSON file
        </s-button>
        <input
          type="file"
          accept="application/json,.json"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleFile(file);
            }
            event.target.value = "";
          }}
        />
      </label>
      {error && (
        <s-banner tone="critical" heading="Invalid file">
          <s-paragraph>{error}</s-paragraph>
        </s-banner>
      )}
    </s-stack>
  );
}
