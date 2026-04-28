const repoSlug = args[0];
const externalId = args[1];
const kind = parseInt(args[2], 10);
const { owner, repo } = parseRepoSlug(repoSlug);

const isPr = kind === 2 || kind === 3;
const endpoint = isPr ? "pulls" : "issues";

const headers = {
  Authorization: `Bearer ${secrets.GITHUB_PAT}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "x502-fact-receiver",
};

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
const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
  ["uint8", "uint64", "bytes32", "address"],
  [fact.status, fact.mergedBlock, fact.labelMask, fact.ghAuthorBinding],
);
return ethers.getBytes(encoded);
