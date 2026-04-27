# tip-pool helpers

Small math helpers used by the tip-pool router.

## API

### `splitEvenly(total, n)`

Returns an array of `n` integers that sum to `total`. Any leftover units after
integer division are handed out one-per-bucket starting from the front.
Throws `RangeError` if `n <= 0` or `total < 0`.

```ts
import { splitEvenly } from "@x502/demo";

splitEvenly(100, 4); //  [25, 25, 25, 25]
splitEvenly(10, 3);  //  [4, 3, 3]   ← sum is exactly 10
splitEvenly(7, 4);   //  [2, 2, 2, 1]
```
