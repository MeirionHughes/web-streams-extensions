import { expect } from "chai";
import { sleep } from "../../src/utils/sleep.js";
import { toArray, from, pipe,  buffer, take, debounceTime, tap } from '../../src/index.js';

describe("debounceTime", () => {
  it("can buffer T while producing faster than duration", async () => {

    let input = [1,2,3,4,5,6,7,8];
    let expected = [input.slice(0, input.length)];

    let src = from(async function*(){
      for(let item of input){
        await sleep(5);
        yield item;
      }
    }());

    let result = await toArray(
      pipe(
        src,
        debounceTime(10)
      )
    )

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can debounce and yield buffer if duration expires", async () => {

    let input = [1,2,3,4,5,6,7,8];
    let mid = 4;
    let expected = [input.slice(0, mid), input.slice(mid)];

    let src = from(async function*(){
      for(let index = 0; index < input.length; index++){
        let item = input[index];
        if(index == mid){
          await sleep(15);
        }else{
          await sleep(5);
        }
        yield item;
      }
    }());

    let result = await toArray(
      pipe(
        src,
        debounceTime(10)
      )
    )

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
  })

  it("can debounce and yield buffer if duration expires, exit early", async () => {

    let input = [1,2,3,4,5,6,7,8];
    let pulled = [];
    let mid = 4;
    let expected = [input.slice(0, mid)];

    let src = from(async function*(){
      for(let index = 0; index < input.length; index++){
        let item = input[index];
        if(index == mid){
          await sleep(15);
        }else{
          await sleep(5);
        }
        yield item;
      }
    }());

    let result = await toArray(
      pipe(
        src,
        debounceTime(10),
        tap(x=>pulled.push(x)),
        take(1)
      )
    )

    expect(result, "stream result matches expected").to.be.deep.eq(expected);
    expect(pulled, "only pulled one").to.be.deep.eq(expected);
  })
});
