import { expect } from "chai";
import { toArray, concat, pipe, tap, from} from '../../src';
import { sleep } from "../../src/utils/sleep";

describe("steams", () => {
  it("writable can buffer until read from", async () => {
    let inputA = [1, 2, 3, 4, 5, 6, 7, 8];
    
    // 4 will be read - but the writer will block trying to write the 4th

    let buffer = new TransformStream<number>({}, {highWaterMark: 3}); 
    let pulled:number[] = [];    

    let source = pipe(from(inputA), tap(x=>pulled.push(x))); 
    
    source.pipeTo(buffer.writable);

    await sleep(10);

    let expected = [1,2,3,4];
    let result = pulled.slice();
    
    let full = await toArray(buffer.readable);
    

    expect(result, "concat result matches expected").to.be.deep.eq(expected);
  })
})