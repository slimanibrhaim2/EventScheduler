const { query } = require("./db");

/**
 * Delete jobs matching a WHERE clause, then remove proxies that were only
 * used by those jobs (account Fleet proxies, etc.). Job request bodies and
 * job_runs (history) go away with the jobs via FK cascade.
 *
 * @param {string} whereSql SQL after WHERE (use $1, $2… for params)
 * @param {any[]} params
 * @param {string} [returning] optional RETURNING clause body, e.g. "batch_id"
 */
async function deleteJobsAndOrphanProxies(whereSql, params = [], returning = "id") {
  const proxyResult = await query(
    `SELECT DISTINCT proxy_id AS id
     FROM jobs
     WHERE (${whereSql})
       AND proxy_id IS NOT NULL`,
    params
  );
  const proxyIds = proxyResult.rows.map((row) => Number(row.id)).filter(Boolean);

  const deletedJobs = await query(
    `DELETE FROM jobs WHERE ${whereSql} RETURNING ${returning}`,
    params
  );

  let deletedProxies = 0;
  if (proxyIds.length > 0) {
    const orphaned = await query(
      `DELETE FROM proxies p
       WHERE p.id = ANY($1::int[])
         AND NOT EXISTS (
           SELECT 1 FROM jobs j WHERE j.proxy_id = p.id
         )
       RETURNING p.id`,
      [proxyIds]
    );
    deletedProxies = orphaned.rowCount || 0;
  }

  return {
    jobs: deletedJobs.rows,
    deletedJobs: deletedJobs.rowCount || 0,
    deletedProxies,
  };
}

module.exports = { deleteJobsAndOrphanProxies };
