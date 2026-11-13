import ExcelJS from "exceljs";

function accountName(job) {
  return String(job.name || "").split(" · ")[0].trim() || job.name || "account";
}

function eventLabel(job) {
  const parts = String(job.name || "").split(" · ");
  if (parts.length > 1) {
    const task = parts.slice(1).join(" · ").trim();
    if (task && !/^day\s+\d+\s+session/i.test(task)) return task;
  }
  return "event";
}

function isEventJob(job) {
  const kind =
    job.request_kind ||
    (String(job.url || "").toLowerCase().includes("/session")
      ? "session"
      : String(job.url || "").toLowerCase().includes("/event")
        ? "event"
        : "");
  return kind === "event";
}

function shortDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function sheetName(parts) {
  const raw = parts.filter(Boolean).join(" · ") || "Sheet";
  return raw.replace(/[\\/?*[\]]/g, " ").slice(0, 31);
}

function accountKey(job) {
  return job.batch_id || accountName(job);
}

function uniqueSheetName(used, base) {
  let name = sheetName([base]);
  if (!used.has(name)) {
    used.add(name);
    return name;
  }
  let i = 2;
  while (used.has(`${name.slice(0, 28)} ${i}`)) i += 1;
  const next = `${name.slice(0, 28)} ${i}`;
  used.add(next);
  return next;
}

const headerFill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F6B4A" },
};
const headerFont = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
const doneFill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF2A8" },
};
const pendingFill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFFFF" },
};
const startedFill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE8E8E8" },
};
const thinBorder = {
  top: { style: "thin", color: { argb: "FFB0B0B0" } },
  left: { style: "thin", color: { argb: "FFB0B0B0" } },
  bottom: { style: "thin", color: { argb: "FFB0B0B0" } },
  right: { style: "thin", color: { argb: "FFB0B0B0" } },
};

/**
 * One sheet per game + plan.
 * Rows = unfinished accounts on that plan.
 * Columns = event/level.
 * Done = yellow + done date.
 * Pending/future = scheduled send date.
 */
export async function exportUnfinishedEventsExcel(
  jobs,
  filename = "unfinished-accounts.xlsx"
) {
  const list = jobs || [];
  const unfinishedKeys = new Set();
  for (const job of list) {
    if (job.status === "pending" || job.status === "running") {
      unfinishedKeys.add(accountKey(job));
    }
  }

  const eventJobs = list.filter(
    (job) => unfinishedKeys.has(accountKey(job)) && isEventJob(job)
  );
  if (eventJobs.length === 0) {
    throw new Error("No unfinished accounts with events to export");
  }

  // Group by game + plan so different plans get different sheets.
  const groups = new Map();
  for (const job of eventJobs) {
    const gameId = job.game_id ? String(job.game_id) : "none";
    const planId = job.plan_id ? String(job.plan_id) : "none";
    const key = `${gameId}::${planId}`;
    if (!groups.has(key)) {
      groups.set(key, {
        gameName: job.game_name || "No game",
        planName: job.plan_name || "No plan",
        jobs: [],
      });
    }
    groups.get(key).jobs.push(job);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Event Scheduler";
  workbook.created = new Date();
  const usedNames = new Set();

  for (const { gameName, planName, jobs: sheetJobs } of groups.values()) {
    const accounts = [
      ...new Set(sheetJobs.map(accountName).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const levelMeta = new Map();
    for (const job of sheetJobs) {
      const level = eventLabel(job);
      const runAt = job.run_at ? new Date(job.run_at).getTime() : Number.MAX_SAFE_INTEGER;
      const prev = levelMeta.get(level);
      if (!prev || runAt < prev) levelMeta.set(level, runAt);
    }
    const levels = [...levelMeta.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], undefined, { numeric: true }))
      .map(([level]) => level);

    const matrix = new Map();
    for (const job of sheetJobs) {
      const account = accountName(job);
      const level = eventLabel(job);
      if (!matrix.has(account)) matrix.set(account, new Map());
      const row = matrix.get(account);
      // HTTP errors were historically saved as status=done with last_ok=false.
      const httpFailed = job.last_ok === false || job.last_ok === "false";
      const failed = job.status === "failed" || (job.status === "done" && httpFailed);
      const done = job.status === "done" && !httpFailed;
      const pending = job.status === "pending" || job.status === "running";
      const current = row.get(level);

      let text = "";
      let kind = "empty";
      if (failed) {
        text = shortDate(job.updated_at || job.run_at);
        kind = "failed";
      } else if (done) {
        text = shortDate(job.updated_at || job.run_at);
        kind = "done";
      } else if (pending) {
        text = shortDate(job.run_at);
        kind = "pending";
      }

      // Prefer failed over done/pending so HTTP failures stay red.
      const rank = { empty: 0, pending: 1, done: 2, failed: 3 };
      const nextRank = rank[kind] ?? 0;
      const curRank = rank[current?.kind] ?? -1;
      if (!current || nextRank >= curRank) {
        row.set(level, { kind, text });
      }
    }

    const title = planName && planName !== "No plan" ? `${gameName} · ${planName}` : gameName;
    const sheet = workbook.addWorksheet(uniqueSheetName(usedNames, title), {
      views: [{ state: "frozen", xSplit: 2, ySplit: 1 }],
    });

    sheet.columns = [
      { header: "Account", key: "account", width: 30 },
      { header: "Started", key: "started", width: 12 },
      ...levels.map((level, index) => ({
        header: level,
        key: `lvl_${index}`,
        width: Math.max(12, Math.min(18, level.length + 2)),
      })),
    ];

    const headerRow = sheet.getRow(1);
    headerRow.height = 22;
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      cell.border = thinBorder;
    });
    headerRow.getCell(1).alignment = { vertical: "middle", horizontal: "left" };

    for (const account of accounts) {
      const accountJobs = sheetJobs.filter((job) => accountName(job) === account);
      const started = accountJobs.reduce((best, job) => {
        if (!job.created_at) return best;
        if (!best) return job.created_at;
        return new Date(job.created_at) < new Date(best) ? job.created_at : best;
      }, null);

      const rowMap = matrix.get(account) || new Map();
      const values = [
        account,
        shortDate(started),
        ...levels.map((level) => rowMap.get(level)?.text || ""),
      ];
      const row = sheet.addRow(values);
      row.height = 18;

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.border = thinBorder;
        cell.alignment = {
          vertical: "middle",
          horizontal: colNumber <= 2 ? "left" : "center",
        };
      });

      row.getCell(2).fill = startedFill;

      levels.forEach((level, index) => {
        const cell = row.getCell(index + 3);
        const meta = rowMap.get(level);
        if (!meta || meta.kind === "empty") {
          cell.fill = pendingFill;
          return;
        }
        if (meta.kind === "done") {
          cell.fill = doneFill;
          cell.font = { bold: true, color: { argb: "FF333333" } };
        } else if (meta.kind === "failed") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFF6B6B" },
          };
          cell.font = { bold: true, color: { argb: "FF5C0000" } };
        } else {
          // Future / not done yet — show scheduled send date.
          cell.fill = pendingFill;
          cell.font = { color: { argb: "FF1F4E79" } };
        }
      });
    }

    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 2 + levels.length },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
