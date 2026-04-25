# tip-pool helpers

Small math helpers used by the tip-pool router.

## API

### `divideEvenly(total, n)`

Returns an array of `n` integers that sum to `total`. Throws `RangeError` if
`n <= 0` or `total < 0`.

```ts
import { divideEvenly } from "@x502/demo";

divideEvenly(100, 4); // [25, 25, 25, 25]
```

> ‼️ STALE (planted for x502 demo): the function was renamed to
> `splitEvenly` but this doc still references the old name. The `docs_tests`
> bounty rewards the PR that fixes this drift.
