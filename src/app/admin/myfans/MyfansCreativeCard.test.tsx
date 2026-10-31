import assert from "node:assert/strict";
import test from "node:test";
import { buildCreativeCardCopy } from "./MyfansCreativeCard.tsx";

test("creative card copy keeps payload fields and chip order", () => {
  assert.deepEqual(
    buildCreativeCardCopy({
      subtitle: "subtitle",
      headline: "headline",
      primary: "primary",
      angle: "ignored angle",
      audienceLine: "audience line",
      audience: "ignored audience",
      chip1: "first",
      chip2: "",
      chip3: "third",
      check: "check",
      title: "card title",
      footer: "footer",
    }, "product title"),
    {
      subtitle: "subtitle",
      headline: "headline",
      primary: "primary",
      audience: "audience line",
      chips: ["first", "third"],
      check: "check",
      title: "card title",
      footer: "footer",
    },
  );
});

test("creative card fallback order keeps product title out of the headline", () => {
  assert.deepEqual(
    buildCreativeCardCopy({ angle: "angle", audience: "audience" }, "product title"),
    {
      subtitle: "myfans発掘・比較",
      headline: "見るポイントは1つ",
      primary: "angle",
      audience: "audience",
      chips: [],
      check: "",
      title: "product title",
      footer: "myfans発掘・比較",
    },
  );
});
