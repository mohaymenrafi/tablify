import { useCallback, useEffect, useId, useState } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { SelectedResource } from "../models/table.server";

type ResourceKind = "page" | "collection" | "product";

interface ResourceSelectorProps {
  kind: ResourceKind;
  label: string;
  selected: SelectedResource[];
  onChange: (selected: SelectedResource[]) => void;
}

const LABELS: Record<ResourceKind, { add: string; empty: string }> = {
  page: { add: "Select pages", empty: "No pages selected" },
  collection: { add: "Select collections", empty: "No collections selected" },
  product: { add: "Select products", empty: "No products selected" },
};

export default function ResourceSelector({
  kind,
  label,
  selected,
  onChange,
}: ResourceSelectorProps) {
  const shopify = useAppBridge();
  const pagesFetcher = useFetcher<{ pages: SelectedResource[] }>();
  const pickerModalId = useId().replace(/:/g, "");

  const [pageQuery, setPageQuery] = useState("");
  const [draftSelected, setDraftSelected] = useState<SelectedResource[]>([]);

  const removeItem = useCallback(
    (id: string) => {
      onChange(selected.filter((item) => item.id !== id));
    },
    [selected, onChange],
  );

  const openShopifyPicker = useCallback(async () => {
    const picked = await shopify.resourcePicker({
      type: kind === "collection" ? "collection" : "product",
      multiple: true,
      selectionIds: selected.map((item) => ({ id: item.id })),
    });

    if (picked) {
      onChange(
        picked.map((item) => ({
          id: item.id,
          title: "title" in item && item.title ? item.title : item.id,
        })),
      );
    }
  }, [shopify, kind, selected, onChange]);

  const openPagePicker = useCallback(() => {
    setDraftSelected(selected);
    setPageQuery("");
    pagesFetcher.load("/app/api/pages");
    const modal = document.getElementById(pickerModalId) as
      | (HTMLElement & { show?: () => void })
      | null;
    modal?.show?.();
  }, [selected, pagesFetcher, pickerModalId]);

  const handleOpen = useCallback(() => {
    if (kind === "page") {
      openPagePicker();
    } else {
      void openShopifyPicker();
    }
  }, [kind, openPagePicker, openShopifyPicker]);

  useEffect(() => {
    if (kind !== "page") return;
    const handle = setTimeout(() => {
      pagesFetcher.load(
        `/app/api/pages?query=${encodeURIComponent(pageQuery)}`,
      );
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageQuery, kind]);

  const togglePage = useCallback((page: SelectedResource) => {
    setDraftSelected((current) => {
      const exists = current.some((item) => item.id === page.id);
      if (exists) {
        return current.filter((item) => item.id !== page.id);
      }
      return [...current, page];
    });
  }, []);

  const confirmPages = useCallback(() => {
    onChange(draftSelected);
  }, [draftSelected, onChange]);

  const availablePages = pagesFetcher.data?.pages ?? [];

  return (
    <s-stack direction="block" gap="small-300">
      <s-stack direction="inline" gap="base" alignItems="center">
        <s-text type="strong">{label}</s-text>
        <s-button variant="tertiary" onClick={handleOpen}>
          {LABELS[kind].add}
        </s-button>
      </s-stack>

      {selected.length === 0 ? (
        <s-text color="subdued">{LABELS[kind].empty}</s-text>
      ) : (
        <s-stack direction="inline" gap="small-300">
          {selected.map((item) => (
            <s-badge key={item.id}>
              {item.title}
              <s-button
                slot="action"
                variant="tertiary"
                icon="x"
                accessibilityLabel={`Remove ${item.title}`}
                onClick={() => removeItem(item.id)}
              />
            </s-badge>
          ))}
        </s-stack>
      )}

      {kind === "page" && (
        <s-modal id={pickerModalId} heading="Select pages">
          <s-stack direction="block" gap="base">
            <s-search-field
              label="Search pages"
              labelAccessibilityVisibility="exclusive"
              placeholder="Search pages"
              value={pageQuery}
              onInput={(event) =>
                setPageQuery((event.target as HTMLInputElement).value ?? "")
              }
            />
            {pagesFetcher.state === "loading" ? (
              <s-stack direction="inline" gap="base" alignItems="center">
                <s-spinner accessibilityLabel="Loading pages" />
                <s-text color="subdued">Loading pages…</s-text>
              </s-stack>
            ) : availablePages.length === 0 ? (
              <s-text color="subdued">No pages found.</s-text>
            ) : (
              <s-stack direction="block" gap="small-300">
                {availablePages.map((page) => (
                  <s-checkbox
                    key={page.id}
                    label={page.title}
                    checked={draftSelected.some((item) => item.id === page.id)}
                    onChange={() => togglePage(page)}
                  />
                ))}
              </s-stack>
            )}
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            command="--hide"
            commandFor={pickerModalId}
            onClick={confirmPages}
          >
            Done
          </s-button>
          <s-button
            slot="secondary-actions"
            command="--hide"
            commandFor={pickerModalId}
          >
            Cancel
          </s-button>
        </s-modal>
      )}
    </s-stack>
  );
}
