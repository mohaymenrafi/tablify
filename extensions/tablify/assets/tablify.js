(function () {
  "use strict";

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildTable(rows) {
    var table = el("table", "tablify-table");

    if (!rows || rows.length === 0) {
      return null;
    }

    var thead = el("thead");
    var headerRow = el("tr");
    (rows[0] || []).forEach(function (cell) {
      headerRow.appendChild(el("th", "tablify-table__th", cell));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = el("tbody");
    for (var r = 1; r < rows.length; r++) {
      var tr = el("tr", r % 2 === 0 ? "tablify-table__row--even" : null);
      (rows[r] || []).forEach(function (cell) {
        tr.appendChild(el("td", "tablify-table__td", cell));
      });
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);

    return table;
  }

  function spreadsheetIdFromUrl(url) {
    var match = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/.exec(url || "");
    return match ? match[1] : null;
  }

  // Fetches a public Google Sheet via the gviz endpoint and returns rows.
  function fetchGoogleSheet(url) {
    var id = spreadsheetIdFromUrl(url);
    if (!id) return Promise.reject(new Error("Invalid spreadsheet URL"));

    var gvizUrl =
      "https://docs.google.com/spreadsheets/d/" + id + "/gviz/tq?tqx=out:json";

    return fetch(gvizUrl)
      .then(function (res) {
        if (!res.ok) throw new Error("Sheet request failed");
        return res.text();
      })
      .then(function (text) {
        var start = text.indexOf("{");
        var end = text.lastIndexOf("}");
        if (start === -1 || end === -1) throw new Error("Unexpected response");
        var data = JSON.parse(text.slice(start, end + 1));
        var cols = (data.table.cols || []).map(function (col) {
          return col.label || "";
        });
        var rows = [];
        if (
          cols.some(function (c) {
            return c !== "";
          })
        ) {
          rows.push(cols);
        }
        (data.table.rows || []).forEach(function (row) {
          rows.push(
            (row.c || []).map(function (cell) {
              return cell && cell.v != null ? String(cell.v) : "";
            }),
          );
        });
        return rows;
      });
  }

  function renderTable(container, tableConfig, showHeading) {
    var wrapper = el("div", "tablify-table-wrapper");

    if (showHeading && tableConfig.name) {
      wrapper.appendChild(el("h2", "tablify-table__heading", tableConfig.name));
    }

    function mount(rows) {
      var node = buildTable(rows);
      if (node) {
        wrapper.appendChild(node);
      } else {
        wrapper.appendChild(el("p", "tablify-block__notice", "No data."));
      }
      container.appendChild(wrapper);
    }

    if (tableConfig.type === "gsheet") {
      fetchGoogleSheet(tableConfig.googleSheetUrl)
        .then(mount)
        .catch(function () {
          wrapper.appendChild(
            el(
              "p",
              "tablify-block__notice",
              "Unable to load the Google Sheet. Make sure it is shared publicly.",
            ),
          );
          container.appendChild(wrapper);
        });
    } else {
      mount(tableConfig.tableData || []);
    }
  }

  function init(block) {
    var type = block.getAttribute("data-resource-type");
    var id = block.getAttribute("data-resource-id");
    var tableId = block.getAttribute("data-table-id");
    var proxyUrl = block.getAttribute("data-proxy-url");
    var showHeading = block.getAttribute("data-show-heading") === "true";
    var status = block.querySelector("[data-tablify-status]");

    if (!proxyUrl) {
      return;
    }

    var requestUrl;
    if (tableId) {
      // Merchant pinned a specific table to this block.
      requestUrl = proxyUrl + "?tableId=" + encodeURIComponent(tableId);
    } else if (type && id) {
      requestUrl =
        proxyUrl +
        "?type=" +
        encodeURIComponent(type) +
        "&id=" +
        encodeURIComponent(id);
    } else {
      return;
    }

    fetch(requestUrl, { headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("Request failed");
        return res.json();
      })
      .then(function (data) {
        var tables = (data && data.tables) || [];
        if (status) status.remove();

        if (tables.length === 0) {
          block.classList.add("tablify-block--empty");
          return;
        }

        tables.forEach(function (tableConfig) {
          renderTable(block, tableConfig, showHeading);
        });
      })
      .catch(function () {
        if (status) {
          status.textContent = "Unable to load table.";
        }
      });
  }

  function boot() {
    document.querySelectorAll("[data-tablify]").forEach(init);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
