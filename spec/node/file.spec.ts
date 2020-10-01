import { expect } from "chai";
import { toArray, from, defer } from '../../src';
import { toWebReadableStream } from 'web-streams-node';
import * as fs from 'fs';
import * as tempy from 'tempy';

describe("node readable interop", () => {
  it("can chunk from nodejs binary", async () => {
    let contents = "";

    for (let i = 0; i < 2 << 16; i++) {
      contents += (Math.round(Math.random() * 9)).toString();
    }
    let file = tempy.writeSync(contents);

    let input:ReadableStream = toWebReadableStream(fs.createReadStream(file, {highWaterMark: 1024}));

    let result = await toArray(defer(()=>input));

    expect(result.length, "correct number of chunks").to.be.deep.eq((2 << 16) / 1024);
  })
})