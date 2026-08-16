import {
  bookProblems,
  decorProblems,
  nextShelfPosition,
  reviewProblems,
} from "./library.ts";

let failures = 0;
function ok(condition: boolean, name: string) {
  if (!condition) {
    failures += 1;
    console.log("FAIL:", name);
  }
}

ok(nextShelfPosition() === 0, "empty shelves start at position zero");
ok(nextShelfPosition(2, 7) === 8, "books and decor share the next shelf position");
ok(nextShelfPosition(null, undefined, -4, 3) === 4, "invalid position values are ignored");

const validBook = { title: "Dune", author: "Frank Herbert", bookcase: 0, shelf: 0, position: 0 };
ok(bookProblems(validBook).length === 0, "valid book placement passes validation");
ok(bookProblems({ ...validBook, shelf: -1 }).length > 0, "negative book shelves are rejected");
ok(bookProblems({ ...validBook, position: 1.5 }).length > 0, "fractional book positions are rejected");
ok(bookProblems({ ...validBook, bookcase: "1" as unknown as number }).length > 0, "string bookcase values are rejected");

ok(
  decorProblems({ kind: "snake-plant", bookcase: 0, shelf: 0, position: 0 }).length === 0,
  "valid decor placement passes validation",
);
ok(
  decorProblems({ kind: "snake-plant", bookcase: 0, shelf: 0, position: -1 }).length > 0,
  "negative decor positions are rejected",
);
ok(
  decorProblems({ kind: "snake-plant", shelf: "1" }).length > 0,
  "string decor shelf values are rejected",
);
ok(decorProblems({ kind: "unknown" }).length > 0, "unknown decor kinds are rejected");

ok(reviewProblems("Worth reading.", 5).length === 0, "valid reader reviews pass validation");
ok(reviewProblems("   ", null).length > 0, "blank reader reviews are rejected");
ok(reviewProblems("Worth reading.", 6).length > 0, "out-of-range ratings are rejected");

console.log(failures === 0 ? "\nALL LIBRARY TESTS PASSED" : `\n${failures} failed`);
process.exit(failures ? 1 : 0);
