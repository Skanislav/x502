const repoSlug = args[0];
const externalId = args[1];
const kind = parseInt(args[2], 10);
const { owner, repo } = parseRepoSlug(repoSlug);

const isPr = kind === 2 || kind === 3;
const endpoint = isPr ? "pulls" : "issues";

const headers = githubHeaders(secrets.GITHUB_PAT);

const r = await Functions.makeHttpRequest({
  url: `https://api.github.com/repos/${owner}/${repo}/${endpoint}/${externalId}`,
  headers,
  timeout: 9000,
});
if (r.error) throw Error(`gh ${endpoint}/${externalId} fetch failed: ${r.error}`);

let files = [];
if (kind === 3 && r.data && r.data.merged === true) {
  const fr = await Functions.makeHttpRequest({
    url: `https://api.github.com/repos/${owner}/${repo}/pulls/${externalId}/files`,
    headers,
    timeout: 9000,
  });
  if (!fr.error) files = fr.data ?? [];
}

const fact = decideFact({ kind, item: r.data, files });
return hexToBytes(encodeFact(fact));
