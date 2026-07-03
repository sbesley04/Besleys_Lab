// The field notebook's out-of-the-box entries. Used until FieldNote rows exist
// in the database — /admin/field-notes can seed from these, and the home page
// falls back to them when the table is empty (so a fresh install still has a
// personal photo strip).

export interface FieldNoteEntry {
  id: string;
  image: string;
  alt: string;
  caption: string;
  tilt: number;
}

export const DEFAULT_FIELD_NOTES: FieldNoteEntry[] = [
  {
    id: "default-volleyball",
    image: "/photos/volleyball.jpg",
    alt: "A volleyball player mid-jump at a tournament",
    caption: "tournament day",
    tilt: -2,
  },
  {
    id: "default-blue-grotto",
    image: "/photos/blue-grotto.jpg",
    alt: "Sea arch and cliffs at the Blue Grotto in Malta",
    caption: "Blue Grotto, Malta",
    tilt: 1.5,
  },
  {
    id: "default-color-run",
    image: "/photos/color-run.jpg",
    alt: "Friends covered in colored powder on a campus lawn",
    caption: "color wars on the quad",
    tilt: -1,
  },
  {
    id: "default-zinnias",
    image: "/photos/zinnias.jpg",
    alt: "Zinnias blooming in front of a red chicken coop",
    caption: "zinnias by the coop",
    tilt: 2,
  },
  {
    id: "default-night-sky",
    image: "/photos/night-sky.jpg",
    alt: "A star-filled night sky over two dark mountain peaks",
    caption: "zero light pollution",
    tilt: -1.5,
  },
];
