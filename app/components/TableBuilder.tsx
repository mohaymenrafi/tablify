import { useCallback, useId, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

const DEFAULT_ROWS = 10;
const DEFAULT_COLS = 6;

export function createEmptyGrid(
  rows = DEFAULT_ROWS,
  cols = DEFAULT_COLS,
): string[][] {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ""),
  );
}

function normalizeGrid(grid: string[][]): string[][] {
  if (!Array.isArray(grid) || grid.length === 0) {
    return createEmptyGrid();
  }
  const cols = grid.reduce((max, row) => Math.max(max, row.length), 0) || 1;
  return grid.map((row) => {
    const next = Array.from({ length: cols }, (_, c) =>
      typeof row[c] === "string" ? row[c] : String(row[c] ?? ""),
    );
    return next;
  });
}

interface DragState {
  type: "row" | "col";
  index: number;
}

interface PendingRemoval {
  type: "row" | "col";
  index: number;
}

interface TableBuilderProps {
  value: string[][];
  onChange: (grid: string[][]) => void;
}

export default function TableBuilder({ value, onChange }: TableBuilderProps) {
  const grid = useMemo(() => normalizeGrid(value), [value]);
  const rowCount = grid.length;
  const colCount = grid[0]?.length ?? 0;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<DragState | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(
    null,
  );
  const [pendingImport, setPendingImport] = useState<string[][] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const removeModalId = useId().replace(/:/g, "");
  const importModalId = `${removeModalId}-import`;

  const setCell = useCallback(
    (r: number, c: number, cellValue: string) => {
      const next = grid.map((row) => row.slice());
      next[r][c] = cellValue;
      onChange(next);
    },
    [grid, onChange],
  );

  const addRow = useCallback(() => {
    const next = grid.map((row) => row.slice());
    next.push(Array.from({ length: colCount || 1 }, () => ""));
    onChange(next);
  }, [grid, colCount, onChange]);

  const addColumn = useCallback(() => {
    const next = grid.map((row) => [...row, ""]);
    onChange(next.length ? next : [[""]]);
  }, [grid, onChange]);

  const removeRow = useCallback(
    (index: number) => {
      if (rowCount <= 1) return;
      onChange(grid.filter((_, r) => r !== index));
    },
    [grid, rowCount, onChange],
  );

  const removeColumn = useCallback(
    (index: number) => {
      if (colCount <= 1) return;
      onChange(grid.map((row) => row.filter((_, c) => c !== index)));
    },
    [grid, colCount, onChange],
  );

  const moveRow = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const next = grid.map((row) => row.slice());
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      onChange(next);
    },
    [grid, onChange],
  );

  const moveColumn = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      const next = grid.map((row) => {
        const copy = row.slice();
        const [moved] = copy.splice(from, 1);
        copy.splice(to, 0, moved);
        return copy;
      });
      onChange(next);
    },
    [grid, onChange],
  );

  const handleDrop = useCallback(() => {
    if (drag && dropTarget && drag.type === dropTarget.type) {
      if (drag.type === "row") {
        moveRow(drag.index, dropTarget.index);
      } else {
        moveColumn(drag.index, dropTarget.index);
      }
    }
    setDrag(null);
    setDropTarget(null);
  }, [drag, dropTarget, moveRow, moveColumn]);

  const confirmRemoval = useCallback(() => {
    if (!pendingRemoval) return;
    if (pendingRemoval.type === "row") {
      removeRow(pendingRemoval.index);
    } else {
      removeColumn(pendingRemoval.index);
    }
    setPendingRemoval(null);
  }, [pendingRemoval, removeRow, removeColumn]);

  const handleFile = useCallback(
    async (file: File) => {
      setImportError(null);
      try {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        if (!firstSheet) {
          setImportError("The file does not contain any sheets.");
          return;
        }
        const sheet = workbook.Sheets[firstSheet];
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          blankrows: false,
          defval: "",
          raw: false,
        });
        const parsed = (rows as unknown as unknown[][]).map((row) =>
          row.map((cell) => (cell == null ? "" : String(cell))),
        );
        if (parsed.length === 0) {
          setImportError("The file appears to be empty.");
          return;
        }
        setPendingImport(normalizeGrid(parsed));
      } catch {
        setImportError(
          "Could not read this file. Please upload a valid .xls, .xlsx, .csv, or .numbers file.",
        );
      }
    },
    [],
  );

  const confirmImport = useCallback(() => {
    if (pendingImport) {
      onChange(pendingImport);
    }
    setPendingImport(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [pendingImport, onChange]);

  const cancelImport = useCallback(() => {
    setPendingImport(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return (
    <s-stack direction="block" gap="base">
      <s-stack direction="inline" gap="base" alignItems="center">
        <s-button
          onClick={() => fileInputRef.current?.click()}
          icon="import"
        >
          Import table file
        </s-button>
        <s-text color="subdued">
          Upload .xls, .xlsx, .csv, or .numbers. This replaces the current
          table content.
        </s-text>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xls,.xlsx,.csv,.numbers,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          style={{ display: "none" }}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleFile(file);
            }
          }}
        />
      </s-stack>

      {importError && (
        <s-banner tone="critical" heading="Import failed">
          <s-paragraph>{importError}</s-paragraph>
        </s-banner>
      )}

      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr>
              <th style={cornerCellStyle} />
              {Array.from({ length: colCount }).map((_, c) => {
                const isDropTarget =
                  dropTarget?.type === "col" && dropTarget.index === c;
                return (
                  <th
                    key={c}
                    style={{
                      ...columnHandleStyle,
                      ...(isDropTarget ? dropHighlightStyle : null),
                    }}
                    onDragOver={(event) => {
                      if (drag?.type === "col") {
                        event.preventDefault();
                        setDropTarget({ type: "col", index: c });
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDrop();
                    }}
                  >
                    <div style={handleInnerStyle}>
                      <span
                        draggable
                        title="Drag to reorder column"
                        onDragStart={() => setDrag({ type: "col", index: c })}
                        onDragEnd={handleDrop}
                        style={dragHandleStyle}
                      >
                        ⠿
                      </span>
                      <button
                        type="button"
                        title="Remove column"
                        aria-label={`Remove column ${c + 1}`}
                        style={removeButtonStyle}
                        onClick={() =>
                          setPendingRemoval({ type: "col", index: c })
                        }
                        disabled={colCount <= 1}
                      >
                        ×
                      </button>
                    </div>
                  </th>
                );
              })}
              <th style={addColumnCellStyle}>
                <button
                  type="button"
                  title="Add column"
                  aria-label="Add column"
                  style={addButtonStyle}
                  onClick={addColumn}
                >
                  +
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => {
              const isRowDropTarget =
                dropTarget?.type === "row" && dropTarget.index === r;
              return (
                <tr key={r}>
                  <td
                    style={{
                      ...rowHandleStyle,
                      ...(isRowDropTarget ? dropHighlightStyle : null),
                    }}
                    onDragOver={(event) => {
                      if (drag?.type === "row") {
                        event.preventDefault();
                        setDropTarget({ type: "row", index: r });
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDrop();
                    }}
                  >
                    <div style={handleInnerStyle}>
                      <span
                        draggable
                        title="Drag to reorder row"
                        onDragStart={() => setDrag({ type: "row", index: r })}
                        onDragEnd={handleDrop}
                        style={dragHandleStyle}
                      >
                        ⠿
                      </span>
                      <button
                        type="button"
                        title="Remove row"
                        aria-label={`Remove row ${r + 1}`}
                        style={removeButtonStyle}
                        onClick={() =>
                          setPendingRemoval({ type: "row", index: r })
                        }
                        disabled={rowCount <= 1}
                      >
                        ×
                      </button>
                    </div>
                  </td>
                  {row.map((cell, c) => (
                    <td key={c} style={cellStyle}>
                      <input
                        type="text"
                        value={cell}
                        onChange={(event) => setCell(r, c, event.target.value)}
                        style={cellInputStyle}
                      />
                    </td>
                  ))}
                  <td style={spacerCellStyle} />
                </tr>
              );
            })}
            <tr>
              <td style={addRowCellStyle}>
                <button
                  type="button"
                  title="Add row"
                  aria-label="Add row"
                  style={addButtonStyle}
                  onClick={addRow}
                >
                  +
                </button>
              </td>
              <td colSpan={colCount + 1} />
            </tr>
          </tbody>
        </table>
      </div>

      <s-text color="subdued">
        {rowCount} rows × {colCount} columns
      </s-text>

      <s-modal id={removeModalId} heading="Remove confirmation">
        <s-paragraph>
          Are you sure you want to remove this{" "}
          {pendingRemoval?.type === "col" ? "column" : "row"}? Any data it
          contains will be lost.
        </s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          command="--hide"
          commandFor={removeModalId}
          onClick={confirmRemoval}
        >
          Remove
        </s-button>
        <s-button
          slot="secondary-actions"
          command="--hide"
          commandFor={removeModalId}
          onClick={() => setPendingRemoval(null)}
        >
          Cancel
        </s-button>
      </s-modal>

      <s-modal id={importModalId} heading="Replace table content?">
        <s-paragraph>
          Importing this file will reset the current table and replace it with
          the uploaded content. This can&apos;t be undone.
        </s-paragraph>
        <s-button
          slot="primary-action"
          variant="primary"
          command="--hide"
          commandFor={importModalId}
          onClick={confirmImport}
        >
          Replace content
        </s-button>
        <s-button
          slot="secondary-actions"
          command="--hide"
          commandFor={importModalId}
          onClick={cancelImport}
        >
          Cancel
        </s-button>
      </s-modal>

      {/* Programmatically open the import confirmation once a file is parsed */}
      {pendingImport && (
        <AutoOpenModal modalId={importModalId} />
      )}
      {/* Programmatically open the remove confirmation when a removal is staged */}
      {pendingRemoval && <AutoOpenModal modalId={removeModalId} />}
    </s-stack>
  );
}

function AutoOpenModal({ modalId }: { modalId: string }) {
  const ref = useRef(false);
  if (!ref.current && typeof document !== "undefined") {
    ref.current = true;
    requestAnimationFrame(() => {
      const modal = document.getElementById(modalId) as
        | (HTMLElement & { show?: () => void })
        | null;
      modal?.show?.();
    });
  }
  return null;
}

const borderColor = "var(--s-color-border, #c9cccf)";
const headerBg = "var(--s-color-surface-subdued, #f6f6f7)";

const cellStyle: React.CSSProperties = {
  border: `1px solid ${borderColor}`,
  padding: 0,
  minWidth: 120,
};

const cellInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "none",
  outline: "none",
  padding: "8px 10px",
  font: "inherit",
  background: "transparent",
};

const cornerCellStyle: React.CSSProperties = {
  border: `1px solid ${borderColor}`,
  background: headerBg,
  width: 56,
};

const handleInnerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
};

const columnHandleStyle: React.CSSProperties = {
  border: `1px solid ${borderColor}`,
  background: headerBg,
  padding: "4px",
  minWidth: 120,
};

const rowHandleStyle: React.CSSProperties = {
  border: `1px solid ${borderColor}`,
  background: headerBg,
  padding: "4px",
  width: 56,
};

const dragHandleStyle: React.CSSProperties = {
  cursor: "grab",
  userSelect: "none",
  fontSize: 14,
  lineHeight: 1,
  color: "var(--s-color-icon-subdued, #6d7175)",
};

const removeButtonStyle: React.CSSProperties = {
  cursor: "pointer",
  border: "none",
  background: "transparent",
  color: "var(--s-color-icon-subdued, #6d7175)",
  fontSize: 16,
  lineHeight: 1,
  padding: "0 2px",
};

const addButtonStyle: React.CSSProperties = {
  cursor: "pointer",
  border: `1px dashed ${borderColor}`,
  background: "transparent",
  color: "var(--s-color-icon, #5c5f62)",
  fontSize: 16,
  lineHeight: 1,
  width: 28,
  height: 28,
  borderRadius: 6,
};

const addColumnCellStyle: React.CSSProperties = {
  border: "none",
  padding: "4px",
  textAlign: "center",
  verticalAlign: "middle",
};

const addRowCellStyle: React.CSSProperties = {
  border: "none",
  padding: "4px",
  textAlign: "center",
};

const spacerCellStyle: React.CSSProperties = {
  border: "none",
  width: 36,
};

const dropHighlightStyle: React.CSSProperties = {
  outline: "2px solid var(--s-color-border-emphasis, #2c6ecb)",
  outlineOffset: -2,
};
