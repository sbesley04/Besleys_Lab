import {
  bookProblems,
  coverEdge,
  coverWidth,
  decorProblems,
  isPeriodical,
  nextShelfPosition,
  reviewProblems,
  BOOK_DESIGNS,
  BOOK_DESIGN_LABELS,
  LABEL_MAX_LENGTH,
  SPINE_THICKNESS,
  type BookDesign,
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

ok(bookProblems({ ...validBook, design: "journal" }).length === 0, "periodical designs are accepted");
ok(bookProblems({ ...validBook, design: "pamphlet" }).length > 0, "unknown spine designs are rejected");
ok(bookProblems({ ...validBook, label: "Vol. 12 · No. 3" }).length === 0, "issue labels are accepted");
ok(
  bookProblems({ ...validBook, label: "x".repeat(LABEL_MAX_LENGTH + 1) }).length > 0,
  "over-long issue labels are rejected",
);
ok(bookProblems({ ...validBook, faceOut: true }).length === 0, "face-out books pass validation");
ok(
  bookProblems({ ...validBook, faceOut: "yes" as unknown as boolean }).length > 0,
  "non-boolean face-out values are rejected",
);
ok(
  bookProblems({ ...validBook, thickness: SPINE_THICKNESS.min }).length === 0,
  "a paper-thin preprint is within the thickness range",
);
ok(
  bookProblems({ ...validBook, thickness: SPINE_THICKNESS.min - 1 }).length > 0,
  "thinner than the minimum is rejected",
);

ok(
  BOOK_DESIGNS.every((d) => Boolean(BOOK_DESIGN_LABELS[d as BookDesign])),
  "every spine design has an admin label",
);
ok(
  new Set(BOOK_DESIGNS).size === BOOK_DESIGNS.length,
  "spine design keys are unique",
);
ok(isPeriodical("magazine") && !isPeriodical("ornate"), "periodicals are told apart from books");
ok(isPeriodical(undefined) === false, "a missing design is not a periodical");
ok(coverWidth(200, "plain") < coverWidth(200, "magazine"), "magazines sit wider face-out than books");
ok(coverEdge(13) >= 3 && coverEdge(72) <= 11, "the cover page-edge stripe stays within bounds");

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
